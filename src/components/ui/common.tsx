import type { ReactNode } from 'react';
import { AlertCircle, Inbox } from 'lucide-react';
import { friendlyError } from '../../lib/errors';
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow ?? 'LUMINAILS OPERATION'}</div>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      <div className="actions">{actions}</div>
    </header>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  const text = String(children);
  return (
    <span
      className={`badge ${['POSTED', 'PAID', 'Aman', 'MATCHED', 'RECEIVED', 'Aktif', 'Hijau'].includes(text) ? 'badge-green' : ['REVERSED', 'VOID', 'CONFLICT', 'Out of Stock', 'ERROR', 'Merah'].includes(text) ? 'badge-red' : 'badge-amber'}`}
    >
      {children}
    </span>
  );
}
export function Loading() {
  return (
    <div aria-label="Memuat data" className="space-y-4">
      <div className="skeleton h-20" />
      <div className="skeleton h-64" />
    </div>
  );
}
export function ErrorState({ error }: { error: unknown }) {
  return (
    <div role="alert" className="notice notice-error">
      <AlertCircle size={20} />
      {friendlyError(error)}
    </div>
  );
}
export function Empty({
  text = 'Belum ada data. Tambahkan transaksi pertama Anda.',
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <strong>Belum ada data</strong>
      <p>{text}</p>
    </div>
  );
}
export function Stat({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="stat">
      <div className="stat-label">
        {label}
        <span className="stat-icon">{icon}</span>
      </div>
      <div className="stat-value">{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
    </div>
  );
}
