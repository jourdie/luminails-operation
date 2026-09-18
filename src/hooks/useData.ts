import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listRows, rpc, getWorkspace } from '../lib/supabase/gateway';
import { friendlyError } from '../lib/errors';
import { useAuth } from '../features/auth/AuthProvider';
export function useRows(table: string, filters: Record<string, string> = {}, enabled = true) {
  const { member } = useAuth();
  return useQuery({
    queryKey: [member?.workspace_id, table, filters],
    queryFn: () => listRows(table, member!.workspace_id, filters),
    enabled: !!member && enabled,
  });
}
export function useCommand() {
  const client = useQueryClient();
  const { member } = useAuth();
  return useMutation({
    mutationFn: ({ name, args = {} }: { name: string; args?: Record<string, unknown> }) =>
      rpc(name, { w: member!.workspace_id, ...args }),
    onSuccess: async () => {
      await client.invalidateQueries();
      toast.success('Data berhasil disimpan.');
    },
    onError: (e) => toast.error(friendlyError(e)),
  });
}
export function useWorkspace() {
  const { member } = useAuth();
  return useQuery({
    queryKey: [member?.workspace_id, 'workspace'],
    queryFn: () => getWorkspace(member!.workspace_id),
    enabled: !!member,
  });
}
