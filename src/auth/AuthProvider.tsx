/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'
import type { MemberAccess, ModuleKey, PermissionSet } from '../lib/permissions'

type Profile = {
  fullName: string
  email: string
  avatarUrl: string | null
}

type WorkspaceMembership = MemberAccess & {
  id: string
  workspaceId: string
  workspaceName: string
  email: string
}

type AuthContextValue = {
  user: User | null
  session: Session | null
  profile: Profile | null
  membership: WorkspaceMembership | null
  isLoading: boolean
  authError: string | null
  isDemoMode: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const demoUser = {
  id: 'demo-user',
  email: 'ops@luminails.local',
  user_metadata: { full_name: 'Luminails Ops' }
} as unknown as User

const demoMembership: WorkspaceMembership = {
  id: 'demo-member',
  workspaceId: 'demo-workspace',
  workspaceName: 'Luminails',
  email: 'ops@luminails.local',
  role: 'OWNER',
  permissions: {}
}

function mapPermission(row: Record<string, boolean>): PermissionSet {
  return {
    canView: Boolean(row.can_view),
    canCreate: Boolean(row.can_create),
    canEdit: Boolean(row.can_edit),
    canPost: Boolean(row.can_post),
    canExport: Boolean(row.can_export)
  }
}

async function loadWorkspaceMembership(userId: string): Promise<WorkspaceMembership | null> {
  if (!supabase) return null

  const { data: membershipRow, error: membershipError } = await supabase
    .from('workspace_members')
    .select('id, workspace_id, email, role, is_active, workspaces(name)')
    .eq('user_id', userId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (membershipError || !membershipRow) return null

  const { data: permissionRows } = await supabase
    .from('member_permissions')
    .select('module, can_view, can_create, can_edit, can_post, can_export')
    .eq('workspace_member_id', membershipRow.id)

  const permissions: Partial<Record<ModuleKey, PermissionSet>> = {}
  for (const row of permissionRows ?? []) {
    permissions[row.module as ModuleKey] = mapPermission(row)
  }

  const workspace = Array.isArray(membershipRow.workspaces)
    ? membershipRow.workspaces[0]
    : membershipRow.workspaces

  return {
    id: membershipRow.id,
    workspaceId: membershipRow.workspace_id,
    workspaceName: workspace?.name ?? 'Luminails',
    email: membershipRow.email,
    role: membershipRow.role,
    permissions
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true' || !isSupabaseConfigured
  const [user, setUser] = useState<User | null>(isDemoMode ? demoUser : null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(
    isDemoMode ? { fullName: 'Luminails Ops', email: 'ops@luminails.local', avatarUrl: null } : null
  )
  const [membership, setMembership] = useState<WorkspaceMembership | null>(isDemoMode ? demoMembership : null)
  const [isLoading, setIsLoading] = useState(!isDemoMode)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode || !supabase) {
      setIsLoading(false)
      return
    }

    let isMounted = true

    const hydrate = async (nextSession: Session | null) => {
      if (!isMounted) return
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      if (!nextSession?.user) {
        setProfile(null)
        setMembership(null)
        setIsLoading(false)
        return
      }

      const nextUser = nextSession.user
      const nextMembership = await loadWorkspaceMembership(nextUser.id)
      if (!isMounted) return
      setProfile({
        fullName: nextUser.user_metadata.full_name ?? nextUser.user_metadata.name ?? 'Pengguna Luminails',
        email: nextUser.email ?? '',
        avatarUrl: nextUser.user_metadata.avatar_url ?? null
      })
      setMembership(nextMembership)
      setIsLoading(false)
    }

    void supabase.auth.getSession().then(({ data }) => hydrate(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void hydrate(nextSession)
    })

    return () => {
      isMounted = false
      listener.subscription.unsubscribe()
    }
  }, [isDemoMode])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    session,
    profile,
    membership,
    isLoading,
    authError,
    isDemoMode,
    signInWithGoogle: async () => {
      setAuthError(null)
      if (isDemoMode) {
        setUser(demoUser)
        setMembership(demoMembership)
        return
      }
      if (!supabase || !isSupabaseConfigured) {
        setAuthError('Supabase belum dikonfigurasi. Isi file .env.local terlebih dahulu.')
        return
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` }
      })
      if (error) setAuthError('Login Google belum dapat dimulai. Periksa konfigurasi Supabase.')
    },
    signOut: async () => {
      if (isDemoMode) {
        setUser(null)
        setMembership(null)
        return
      }
      await supabase?.auth.signOut()
    }
  }), [authError, isDemoMode, isLoading, membership, profile, session, user])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
