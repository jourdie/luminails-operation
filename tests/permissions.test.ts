import { describe, it, expect } from 'vitest';
import { can } from '../src/lib/permissions';
import type { Membership } from '../src/types/domain';
describe('UI permission guard', () => {
  const member: Membership = {
    id: 'm',
    workspace_id: 'w',
    role: 'MEMBER',
    email: 'member@example.test',
    active: true,
  };
  it('denies finance when not granted', () => expect(can(member, [], 'finance')).toBe(false));
  it('owner has all actions, inactive owner has none', () => {
    expect(can({ ...member, role: 'OWNER' }, [], 'finance', 'post')).toBe(true);
    expect(can({ ...member, role: 'OWNER', active: false }, [], 'finance')).toBe(false);
  });
});
