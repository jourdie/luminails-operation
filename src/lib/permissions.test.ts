import { describe, expect, it } from 'vitest'
import { hasPermission, type MemberAccess } from './permissions'

describe('hasPermission', () => {
  it('grants owners every action', () => {
    const owner: MemberAccess = { role: 'OWNER', permissions: {} }
    expect(hasPermission(owner, 'finance', 'export')).toBe(true)
  })

  it('limits members to the configured module action', () => {
    const member: MemberAccess = {
      role: 'MEMBER',
      permissions: {
        inventory: {
          canView: true,
          canCreate: false,
          canEdit: false,
          canPost: false,
          canExport: true
        }
      }
    }

    expect(hasPermission(member, 'inventory', 'view')).toBe(true)
    expect(hasPermission(member, 'inventory', 'post')).toBe(false)
    expect(hasPermission(member, 'finance', 'view')).toBe(false)
  })

  it('denies access when no membership exists', () => {
    expect(hasPermission(null, 'dashboard', 'view')).toBe(false)
  })
})
