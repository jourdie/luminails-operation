import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Settings, Users, Landmark, History, FileText, Database, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useRows, useCommand, useWorkspace } from '../../hooks/useData';
import { modules } from '../../types/domain';
import { can } from '../../lib/permissions';
import { localMode, supabase } from '../../lib/supabase/client';
import { toast } from 'sonner';
import { cleanseLocalData } from '../../lib/supabase/local';
import { PageHeader } from '../../components/ui/common';
import { Button } from '../../components/ui/button';
import { Dialog } from '../../components/ui/dialog';
import { DataTable } from '../../components/tables/DataTable';
export function SettingsPage() {
  const auth = useAuth();
  const [confirmCleansing, setConfirmCleansing] = useState(false);
  const [cleansing, setCleansing] = useState(false);
  const owner = auth.member?.role === 'OWNER';
  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Konfigurasi workspace, akses pengguna, dan referensi operasional."
      />
      <div className="settings-grid">
        {[
          {
            title: 'Pengguna & Akses',
            to: '/settings/users',
            icon: Users,
            description: 'Allowlist email dan izin per modul',
          },
          {
            title: 'Workspace & Invoice',
            to: '/settings/workspace',
            icon: FileText,
            description: 'Identitas dan informasi pembayaran invoice',
          },
          {
            title: 'Akun Keuangan',
            to: '/finance/accounts',
            icon: Landmark,
            description: 'Bank, aset, dan kewajiban',
          },
          {
            title: 'Audit Log',
            to: '/settings/audit',
            icon: History,
            description: 'Riwayat perubahan dan posting',
          },
          {
            title: 'Saldo Awal',
            to: '/settings/opening',
            icon: Database,
            description: 'Mulai ledger dari posisi bisnis saat ini',
          },
        ].map((s) => (
          <Link className="panel settings-link" key={s.to} to={s.to}>
            <s.icon size={24} />
            <h2>{s.title}</h2>
            <p className="muted text-sm">{s.description}</p>
          </Link>
        ))}
      </div>
      {localMode && owner && (
        <section className="panel settings-danger mt-6">
          <div className="settings-danger-copy">
            <Trash2 size={24} />
            <div>
              <h2>Cleansing data browser</h2>
              <p className="muted text-sm">
                Hapus seluruh data transaksi, master produk, stok, supplier, pelanggan, dan saldo
                yang tersimpan di browser ini. Workspace dan akun akses akan dibuat kembali dalam
                keadaan kosong.
              </p>
            </div>
          </div>
          <Button variant="destructive" onClick={() => setConfirmCleansing(true)}>
            Bersihkan data lokal
          </Button>
        </section>
      )}
      <Dialog
        open={confirmCleansing}
        onOpenChange={setConfirmCleansing}
        title="Bersihkan seluruh data lokal?"
        description="Tindakan ini tidak bisa dibatalkan dan hanya memengaruhi data browser ini."
      >
        <div className="notice notice-warning">
          Semua transaksi, SKU, supplier, pelanggan, stok, invoice, dan laporan lokal akan dihapus.
          Setelah selesai aplikasi memuat workspace kosong.
        </div>
        <div className="form-footer">
          <Button variant="ghost" onClick={() => setConfirmCleansing(false)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={cleansing}
            onClick={async () => {
              setCleansing(true);
              try {
                await cleanseLocalData();
                window.location.assign('/');
              } catch (error) {
                setCleansing(false);
                toast.error(error instanceof Error ? error.message.replace(/^Error:\s*/, '') : String(error));
              }
            }}
          >
            {cleansing ? 'Membersihkan...' : 'Ya, bersihkan data'}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
export function UsersPage() {
  const members = useRows('workspace_members'),
    allPermissions = useRows('member_permissions'),
    command = useCommand(),
    auth = useAuth();
  const [email, setEmail] = useState(''),
    [active, setActive] = useState(true),
    [values, setValues] = useState<Record<string, boolean>>({}),
    [confirm, setConfirm] = useState(false);
  const owner = auth.member?.role === 'OWNER';
  return (
    <>
      <PageHeader
        title="Pengguna & Akses"
        description="Hanya pemilik yang dapat mengubah allowlist dan hak akses. Tidak ada email yang dikirim otomatis."
      />
      <DataTable
        rows={members.data ?? []}
        columns={[
          { key: 'email', label: 'Email' },
          { key: 'role', label: 'Peran' },
          { key: 'active', label: 'Aktif', render: (v) => (v ? 'Aktif' : 'Nonaktif') },
        ]}
        actions={
          owner
            ? (r) =>
                r.role !== 'OWNER' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEmail(String(r.email));
                      setActive(Boolean(r.active));
                      const next: Record<string, boolean> = {};
                      for (const p of allPermissions.data?.filter((p) => p.member_id === r.id) ??
                        []) {
                        for (const a of ['view', 'create', 'edit', 'post', 'export'])
                          next[`${p.module}.${a}`] = Boolean(p[`can_${a}`]);
                      }
                      setValues(next);
                    }}
                  >
                    Kelola akses
                  </Button>
                )
            : undefined
        }
      />
      {owner && (
        <section className="panel mt-6">
          <h2>Allowlist / perbarui anggota</h2>
          <div className="form-grid my-5">
            <label>
              Email Google
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value.toLowerCase())}
                placeholder="nama@perusahaan.com"
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Anggota aktif
            </label>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Modul</th>
                  {['Lihat', 'Buat', 'Edit', 'Posting', 'Export'].map((a) => (
                    <th key={a}>{a}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((m) => (
                  <tr key={m}>
                    <td>{m}</td>
                    {['view', 'create', 'edit', 'post', 'export'].map((a) => (
                      <td key={a}>
                        <input
                          type="checkbox"
                          aria-label={`${m} ${a}`}
                          checked={values[`${m}.${a}`] ?? false}
                          onChange={(e) =>
                            setValues({ ...values, [`${m}.${a}`]: e.target.checked })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="form-footer">
            <p className="muted text-sm">Izin lain memerlukan izin Lihat.</p>
            <Button
              disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)}
              onClick={() => setConfirm(true)}
            >
              Simpan akses
            </Button>
          </div>
        </section>
      )}
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Konfirmasi perubahan akses"
        description={`Hak akses ${email} akan diperbarui dan dicatat di audit log.`}
      >
        <Button
          disabled={command.isPending}
          onClick={async () => {
            try {
              await command.mutateAsync({
                name: 'manage_member',
                args: {
                  payload: {
                    email,
                    active,
                    permissions: modules.map((m) => ({
                      module: m,
                      ...Object.fromEntries(
                        ['view', 'create', 'edit', 'post', 'export'].map((a) => [
                          `can_${a}`,
                          values[`${m}.${a}`] ?? false,
                        ]),
                      ),
                    })),
                  },
                },
              });
              setConfirm(false);
              await auth.reload();
            } catch {
              /* translated by mutation */
            }
          }}
        >
          Konfirmasi perubahan
        </Button>
      </Dialog>
    </>
  );
}
export function WorkspacePage() {
  const auth = useAuth(),
    command = useCommand();
  const workspace = useWorkspace();
  const [name, setName] = useState('Luminails'),
    [paymentInfo, setPaymentInfo] = useState(''),
    [notes, setNotes] = useState('');
  useEffect(() => {
    if (workspace.data) {
      setName(String(workspace.data.name));
      const settings = workspace.data.invoice_settings as Record<string, unknown>;
      setPaymentInfo(String(settings.payment_info ?? ''));
      setNotes(String(settings.notes ?? ''));
    }
  }, [workspace.data]);
  return (
    <>
      <PageHeader
        title="Workspace & Invoice"
        description="Informasi ini disalin ke invoice baru pada saat penerbitan."
      />
      <form
        className="panel record-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await command.mutateAsync({
              name: 'save_workspace',
              args: { payload: { name, invoice_settings: { payment_info: paymentInfo, notes } } },
            });
          } catch {
            /* translated by mutation */
          }
        }}
      >
        <label>
          Nama workspace
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Informasi rekening pembayaran
          <textarea
            value={paymentInfo}
            onChange={(e) => setPaymentInfo(e.target.value)}
            placeholder="Nama bank, nomor rekening, nama pemilik"
          />
        </label>
        <label>
          Catatan invoice
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <Button
          disabled={!can(auth.member, auth.permissions, 'settings', 'edit') || command.isPending}
        >
          <Settings size={15} />
          Simpan pengaturan
        </Button>
      </form>
      <p className="muted text-sm mt-4">
        Mode koneksi: {supabase ? 'Supabase' : 'PostgreSQL lokal (data uji)'}
      </p>
    </>
  );
}
export function OpeningPage() {
  return (
    <>
      <PageHeader
        title="Persiapan Saldo Awal"
        description="Gunakan tanggal cutover yang sama dan cocokkan dengan catatan bisnis sebelum memulai transaksi harian."
      />
      <div className="settings-grid">
        {[
          ['Deposit supplier', '/deposits', 'Pilih jenis OPENING untuk setiap supplier.'],
          ['Stok awal', '/inventory', 'Download template SKU, isi penyesuaian, lalu upload untuk posting stok.'],
          [
            'Akun & kewajiban',
            '/finance/accounts',
            'Buat akun bank, aset, atau LIABILITY terlebih dahulu.',
          ],
          [
            'Snapshot keuangan',
            '/finance/snapshots',
            'Catat saldo per akun dan kurs pada tanggal awal.',
          ],
          [
            'Piutang awal',
            '/finance/receivables',
            'Catat tagihan historis yang belum lunas per pelanggan.',
          ],
        ].map(([title, to, description]) => (
          <Link key={to} className="panel settings-link" to={to}>
            <Database size={23} />
            <h2>{title}</h2>
            <p className="muted text-sm">{description}</p>
          </Link>
        ))}
      </div>
      <div className="notice mt-6">
        Jangan masukkan deposit supplier atau nilai stok lagi sebagai akun keuangan. Posisi bisnis
        sudah mengambil keduanya dari ledger.
      </div>
    </>
  );
}
