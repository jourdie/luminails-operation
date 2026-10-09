import { CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { mapShopeeOrderRows, parseSpreadsheet, type OrderImportResult } from '../../lib/imports'

export function ImportOrderModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (result: OrderImportResult) => void }) {
  const [result, setResult] = useState<OrderImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isReading, setIsReading] = useState(false)

  async function handleFile(file: File | undefined) {
    if (!file) return
    setIsReading(true)
    setError(null)
    try {
      const rows = await parseSpreadsheet(file)
      setResult(mapShopeeOrderRows(rows))
    } catch {
      setError('File tidak dapat dibaca. Gunakan file Excel dengan header pada baris pertama.')
    } finally {
      setIsReading(false)
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-5"><div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-shell shadow-2xl"><div className="flex items-start justify-between border-b border-stone-100 p-6"><div><h2 className="font-display text-xl font-semibold">Import Order.all</h2><p className="mt-1 text-sm text-stone-500">Upload, preview, validate, lalu confirm. Ledger belum berubah sebelum confirm.</p></div><button type="button" onClick={onClose} className="rounded-lg p-1 text-stone-500 hover:bg-linen" aria-label="Tutup"><X className="h-5 w-5" /></button></div><div className="overflow-y-auto p-6">{!result && <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-linen text-center"><Upload className="h-8 w-8 text-blushDeep" /><span className="mt-4 font-semibold">Pilih file Excel</span><span className="mt-1 text-xs text-stone-500">.xlsx atau .xls dengan header pada baris pertama</span><input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => void handleFile(event.target.files?.[0])} />{isReading && <span className="mt-4 text-xs text-stone-500">Membaca file...</span>}</label>}{error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{result && <div className="space-y-5"><div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-linen p-4"><p className="text-xs text-stone-500">Total rows</p><p className="mt-2 font-display text-2xl font-semibold">{result.rows.length}</p></div><div className="rounded-xl bg-sage/55 p-4"><p className="text-xs text-emerald-950">Valid rows</p><p className="mt-2 font-display text-2xl font-semibold text-emerald-950">{result.mapped.length}</p></div><div className="rounded-xl bg-amber/55 p-4"><p className="text-xs text-amber-950">Invalid rows</p><p className="mt-2 font-display text-2xl font-semibold text-amber-950">{result.errors.length}</p></div></div><div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-linen p-4 text-sm text-stone-700"><FileSpreadsheet className="h-5 w-5 text-blushDeep" /><span>Header terbaca: {result.headers.join(', ') || 'Tidak ditemukan'}</span></div>{result.errors.length > 0 && <div className="rounded-xl border border-amber bg-amber/45 p-4 text-sm text-amber-950"><p className="font-semibold">Rows perlu diperbaiki</p>{result.errors.slice(0, 5).map((item) => <p key={item.row} className="mt-1 text-xs">Row {item.row}: {item.message}</p>)}</div>}{result.mapped.length > 0 && <div className="overflow-x-auto rounded-xl border border-stone-200"><table className="min-w-full text-left text-sm"><thead className="bg-linen text-xs text-stone-500"><tr><th className="px-4 py-3 font-semibold">Order ID</th><th className="px-4 py-3 font-semibold">SKU</th><th className="px-4 py-3 font-semibold">Qty</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead><tbody className="divide-y divide-stone-100">{result.mapped.slice(0, 8).map((row) => <tr key={`${row.externalOrderId}-${row.sellerSku}`}><td className="px-4 py-3 font-medium">{row.externalOrderId}</td><td className="px-4 py-3">{row.sellerSku}</td><td className="px-4 py-3">{row.qty}</td><td className="px-4 py-3">{row.status}</td></tr>)}</tbody></table></div>}</div>}</div><div className="flex justify-end gap-2 border-t border-stone-100 p-6"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-stone-600 hover:bg-linen">Batal</button>{result && <button type="button" disabled={result.mapped.length === 0} onClick={() => onConfirm(result)} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="mr-2 inline h-4 w-4" /> Confirm import</button>}</div></div></div>
}
