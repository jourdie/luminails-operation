import { useMemo, useState } from 'react';
import { PageHeader, Loading, ErrorState } from '../../components/ui/common';
import { Button } from '../../components/ui/button';
import { Trash2 } from 'lucide-react';
import { DataTable } from '../../components/tables/DataTable';
import { Dialog } from '../../components/ui/dialog';
import { useCommand, useRows } from '../../hooks/useData';
import { rupiah } from '../../lib/formatting';
import type { Row } from '../../types/domain';

type Tier = { min_qty: number; unit_price: number };
const blank = (): { name: string; product_class: string; sku_id: string; min_spend: string; free_qty: string; start_date: string; end_date: string; active: boolean; tiers: Tier[] } => ({ name: '', product_class: '', sku_id: '', min_spend: '', free_qty: '', start_date: '', end_date: '', active: true, tiers: [{ min_qty: 12, unit_price: 120000 }, { min_qty: 24, unit_price: 117000 }, { min_qty: 36, unit_price: 114000 }] });
export function PromotionPage() {
  const rules = useRows('promotion_rules'), tiers = useRows('promotion_tiers'), skus = useRows('skus'), products = useRows('products');
  const command = useCommand(); const [editing, setEditing] = useState<Row>(); const [open, setOpen] = useState(false); const [deleting, setDeleting] = useState<Row>();
  const [form, setForm] = useState(blank());
  const classes = useMemo(() => [...new Set((products.data ?? []).map((p) => String(p.product_class ?? p.category ?? '')).filter(Boolean))], [products.data]);
  function start(row?: Row) {
    if (!row) { setEditing(undefined); setForm(blank()); setOpen(true); return; }
    const ruleTiers = (tiers.data ?? []).filter((t) => t.promotion_rule_id === row.id).sort((a,b) => Number(a.min_qty)-Number(b.min_qty));
    setEditing(row); setForm({ name: String(row.name ?? ''), product_class: String(row.product_class ?? ''), sku_id: String(row.sku_id ?? ''), min_spend: row.min_spend == null ? '' : String(row.min_spend), free_qty: String(row.free_qty ?? ''), start_date: String(row.start_date ?? ''), end_date: String(row.end_date ?? ''), active: row.active !== false, tiers: ruleTiers.length ? ruleTiers.map((t) => ({ min_qty: Number(t.min_qty), unit_price: Number(t.unit_price) })) : [{ min_qty: 1, unit_price: 0 }] }); setOpen(true);
  }
  const productName = (id: unknown) => products.data?.find((p) => p.id === id)?.name;
  return <>
    <PageHeader title="Promotion Rule" description="Atur harga bertingkat dan bonus barang untuk pesanan B2B." actions={<Button onClick={() => start()}>Tambah promotion</Button>} />
    {rules.isLoading ? <Loading /> : rules.error ? <ErrorState error={rules.error} /> : <DataTable rows={(rules.data ?? []).map((r) => ({ ...r, scope: r.sku_id ? String(productName(skus.data?.find((s) => s.id === r.sku_id)?.product_id) ?? '') : String(r.product_class ?? ''), periode: r.start_date ? `${r.start_date} - ${r.end_date || 'tanpa batas'}` : 'tanpa batas' }))} columns={[{ key: 'name', label: 'Nama promo' }, { key: 'scope', label: 'Produk' }, { key: 'min_spend', label: 'Min. belanja', render: (v) => v ? rupiah(String(v)) : '-' }, { key: 'free_qty', label: 'Bonus qty' }, { key: 'periode', label: 'Periode' }, { key: 'active', label: 'Aktif' }]} actions={(r) => <><Button size="sm" variant="outline" onClick={() => start(r)}>Edit</Button><Button size="sm" variant="ghost" onClick={() => setDeleting(r)}><Trash2 size={14} />Hapus</Button></>} />}
    <Dialog open={open} onOpenChange={setOpen} title={editing ? 'Edit promotion rule' : 'Tambah promotion rule'} description="Promo yang tanggalnya overlap pada produk/scope yang sama akan ditolak." wide>
      {open && <form className="form-grid" onSubmit={async (e) => { e.preventDefault(); await command.mutateAsync({ name: 'save_promotion_rule', args: { payload: { name: form.name, product_class: form.product_class, sku_id: form.sku_id, min_spend: form.min_spend, free_qty: form.free_qty, start_date: form.start_date, end_date: form.end_date, active: form.active, tiers: form.tiers }, ...(editing?.id ? { record_id: editing.id } : {}) } }); setOpen(false); }}>
        <label>Nama promo<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Gel Polish Promo" /></label>
        <label>Product class<select value={form.product_class} onChange={(e) => setForm({ ...form, product_class: e.target.value })}><option value="">Semua product</option>{classes.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label>SKU spesifik (opsional)<select value={form.sku_id} onChange={(e) => setForm({ ...form, sku_id: e.target.value })}><option value="">Gunakan product class</option>{(skus.data ?? []).map((s) => <option key={String(s.id)} value={String(s.id)}>{String(s.sku_code)} · {String(productName(s.product_id) ?? '')}</option>)}</select></label>
        <label>Minimum belanja<input type="number" min="0" value={form.min_spend} onChange={(e) => setForm({ ...form, min_spend: e.target.value })} placeholder="3000000" /></label>
        <label>Bonus botol<input type="number" min="0" value={form.free_qty} onChange={(e) => setForm({ ...form, free_qty: e.target.value })} placeholder="1" /></label>
        <label>Mulai<input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></label>
        <label>Selesai<input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></label>
        <div className="panel col-span-2"><strong>Harga bertingkat</strong>{form.tiers.map((t, i) => <div className="form-grid" key={i}><label>Minimal qty<input type="number" min="1" value={t.min_qty} onChange={(e) => { const x = [...form.tiers]; x[i] = { ...t, min_qty: Number(e.target.value) }; setForm({ ...form, tiers: x }); }} /></label><label>Harga per pcs<input type="number" min="0" value={t.unit_price} onChange={(e) => { const x = [...form.tiers]; x[i] = { ...t, unit_price: Number(e.target.value) }; setForm({ ...form, tiers: x }); }} /></label>{form.tiers.length > 1 && <Button type="button" variant="ghost" onClick={() => setForm({ ...form, tiers: form.tiers.filter((_, n) => n !== i) })}>Hapus</Button>}</div>)}<Button type="button" variant="outline" onClick={() => setForm({ ...form, tiers: [...form.tiers, { min_qty: 1, unit_price: 0 }] })}>Tambah tier</Button></div>
        <label className="checkbox"><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Aktif</label>
        <div className="form-footer"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={command.isPending}>Simpan promotion</Button></div>
      </form>}
    </Dialog>
    <Dialog open={!!deleting} onOpenChange={() => setDeleting(undefined)} title="Hapus promotion rule?" description="Promo dan seluruh tier harganya akan dihapus permanen.">
      <div className="notice notice-warning">Pastikan promo ini memang salah input. Penghapusan tidak dapat dibatalkan.</div>
      <div className="form-footer"><Button variant="ghost" onClick={() => setDeleting(undefined)}>Batal</Button><Button variant="destructive" disabled={command.isPending} onClick={async () => { try { await command.mutateAsync({ name: 'delete_record', args: { entity: 'promotion_rules', record_id: deleting?.id, permission_module: 'b2b' } }); setDeleting(undefined); } catch { /* translated by mutation */ } }}>Hapus permanen</Button></div>
    </Dialog>  </>;
}


