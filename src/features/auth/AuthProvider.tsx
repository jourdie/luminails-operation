import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Membership, Permission } from '../../types/domain';
import { configurationError, localMode, supabase } from '../../lib/supabase/client';
import { rpc } from '../../lib/supabase/gateway';
import { friendlyError } from '../../lib/errors';
type AuthState = {
  member: Membership | null;
  permissions: Permission[];
  members: Membership[];
  loading: boolean;
  loggedIn: boolean;
  error: string;
  switchWorkspace: (id: string) => void;
  reload: () => Promise<void>;
};
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [members, setMembers] = useState<Membership[]>([]);
  const [selected, setSelected] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [error, setError] = useState('');
  async function reload() {
    setError('');
    try {
      if (configurationError) throw new Error('Konfigurasi Supabase belum lengkap.');
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setLoggedIn(!!session);
        if (!session) {
          setMembers([]);
          return;
        }
        await rpc('claim_memberships', {});
        const { data, error } = await supabase
          .from('workspace_members')
          .select('*')
          .eq('user_id', session.user.id)
          .eq('active', true);
        if (error) throw error;
        setMembers(data as Membership[]);
        const ids = data.map((m) => m.id);
        if (ids.length) {
          const p = await supabase.from('member_permissions').select('*').in('member_id', ids);
          if (p.error) throw p.error;
          setPermissions(p.data as Permission[]);
        }
      } else if (localMode) {
        const { localDatabase } = await import('../../lib/supabase/local');
        const db = await localDatabase();
        const m = await db.query<Membership>(
          'select * from public.workspace_members where user_id=auth.uid() and active',
        );
        setMembers(m.rows);
        setLoggedIn(true);
      } else
        throw new Error(
          'Supabase belum dikonfigurasi. Isi variabel lingkungan untuk menjalankan aplikasi.',
        );
    } catch (e) {
      if (localMode) {
        console.error('Local database initialization failed', e);
        setError(`Database lokal gagal dimuat. ${e instanceof Error ? e.message : String(e)}`);
      } else {
        setError(e instanceof Error && /konfigurasi/i.test(e.message) ? e.message : friendlyError(e));
      }
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
    const listener = supabase?.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        client.clear();
        void reload();
      }, 0);
    });
    return () => listener?.data.subscription.unsubscribe();
  }, []);
  const member = members.find((m) => m.workspace_id === selected) ?? members[0] ?? null;
  const scopedPermissions = permissions.filter(
    (p) => !('member_id' in p) || p.member_id === member?.id,
  );
  return (
    <AuthContext.Provider
      value={{
        member,
        members,
        permissions: scopedPermissions,
        loading,
        loggedIn,
        error,
        reload,
        switchWorkspace: (id) => {
          setSelected(id);
          client.clear();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider required');
  return value;
}
