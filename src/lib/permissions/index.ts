import type { Action, Membership, Module, Permission } from '../../types/domain';
export function can(
  member: Membership | null,
  permissions: Permission[],
  module: Module,
  action: Action = 'view',
): boolean {
  return (
    !!member?.active &&
    (member.role === 'OWNER' ||
      permissions.some((p) => p.module === module && p.can_view && p[`can_${action}`]))
  );
}
export function salesModule(channel: string): Module {
  return channel === 'SHOPEE' ? 'shopee' : channel === 'RESELLER' ? 'reseller' : 'b2b';
}
