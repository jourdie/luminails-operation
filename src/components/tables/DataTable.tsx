import { useMemo, useState, type ReactNode } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/button';
import { Empty } from '../ui/common';
import type { Row } from '../../types/domain';
export type Column = {
  key: string;
  label: string;
  render?: (value: unknown, row: Row) => ReactNode;
};
export function DataTable({
  rows,
  columns,
  actions,
  searchable = true,
}: {
  rows: Row[];
  columns: Column[];
  actions?: (row: Row) => ReactNode;
  searchable?: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([]),
    [search, setSearch] = useState('');
  const defs = useMemo<ColumnDef<Row>[]>(
    () => [
      ...columns.map((c) => ({
        accessorKey: c.key,
        header: c.label,
        cell: ({ row, getValue }: { row: { original: Row }; getValue: () => unknown }) =>
          c.render ? c.render(getValue(), row.original) : String(getValue() ?? '—'),
      })),
      ...(actions
        ? [
            {
              id: 'actions',
              header: '',
              cell: ({ row }: { row: { original: Row } }) => actions(row.original),
            },
          ]
        : []),
    ],
    [columns, actions],
  );
  const table = useReactTable({
    data: rows,
    columns: defs,
    state: { sorting, globalFilter: search },
    onSortingChange: setSorting,
    onGlobalFilterChange: setSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 15 } },
  });
  return (
    <div className="table-card">
      {searchable && (
        <div className="table-toolbar">
          <div className="search-input">
            <Search size={16} />
            <input
              aria-label="Cari data"
              placeholder="Cari di tabel..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="muted text-sm">{table.getFilteredRowModel().rows.length} data</span>
        </div>
      )}
      <div className="table-scroll">
        <table>
          <thead>
            {table.getHeaderGroups().map((h) => (
              <tr key={h.id}>
                {h.headers.map((c) => (
                  <th key={c.id}>
                    <button onClick={c.column.getToggleSortingHandler()} className="th-button">
                      {flexRender(c.column.columnDef.header, c.getContext())}
                      {c.column.getCanSort() && <ArrowUpDown size={11} />}
                    </button>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((c) => (
                  <td key={c.id}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <Empty />}
      <div className="table-footer">
        <span>
          Halaman {table.getState().pagination.pageIndex + 1} dari{' '}
          {Math.max(table.getPageCount(), 1)}
        </span>
        <div className="actions">
          <Button
            variant="ghost"
            size="sm"
            aria-label="Halaman sebelumnya"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            <ChevronLeft size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Halaman berikutnya"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
