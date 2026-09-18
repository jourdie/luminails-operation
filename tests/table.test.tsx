// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DataTable } from '../src/components/tables/DataTable';
describe('Operational table', () => {
  it('searches real row data and reports the filtered count', () => {
    render(
      <DataTable
        rows={[
          { id: '1', name: 'PARTY Base Coat' },
          { id: '2', name: 'Bluesky Rubber Base' },
        ]}
        columns={[{ key: 'name', label: 'Produk' }]}
      />,
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Cari data' }), {
      target: { value: 'Bluesky' },
    });
    expect(screen.getByText('Bluesky Rubber Base')).toBeInTheDocument();
    expect(screen.queryByText('PARTY Base Coat')).not.toBeInTheDocument();
    expect(screen.getByText('1 data')).toBeInTheDocument();
  });
});
