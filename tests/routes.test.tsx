// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';
vi.mock('../src/features/auth/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    member: {
      id: 'member',
      workspace_id: 'workspace',
      role: 'MEMBER',
      active: true,
      email: 'member@example.test',
    },
    members: [],
    permissions: [{ module: 'inventory', can_view: true }],
    loading: false,
    loggedIn: true,
    error: '',
    reload: async () => {},
    switchWorkspace: () => {},
  }),
}));
import { App } from '../src/app/App';
it('blocks a direct /finance visit and hides finance navigation for an inventory-only member', () => {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/finance']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByRole('heading', { name: 'Akses ditolak' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Keuangan' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Stok' })).toBeInTheDocument();
});
