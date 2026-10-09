export const modules = [
  'dashboard',
  'shopee_orders',
  'manual_orders',
  'b2b',
  'inventory',
  'restock',
  'supplier_deposit',
  'finance',
  'reports',
  'settings'
] as const

export type ModuleKey = (typeof modules)[number]
export type MemberRole = 'OWNER' | 'MEMBER'
export type PermissionAction = 'view' | 'create' | 'edit' | 'post' | 'export'

export type PermissionSet = {
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canPost: boolean
  canExport: boolean
}

export type MemberAccess = {
  role: MemberRole
  permissions: Partial<Record<ModuleKey, PermissionSet>>
}

export function hasPermission(
  access: MemberAccess | null,
  module: ModuleKey,
  action: PermissionAction
): boolean {
  if (!access) return false
  if (access.role === 'OWNER') return true

  const permission = access.permissions[module]
  if (!permission) return false

  const actionKeys: Record<PermissionAction, keyof PermissionSet> = {
    view: 'canView',
    create: 'canCreate',
    edit: 'canEdit',
    post: 'canPost',
    export: 'canExport'
  }
  const key = actionKeys[action]

  return permission[key]
}
