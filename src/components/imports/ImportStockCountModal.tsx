import { CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { parseSpreadsheet, type SpreadsheetRow } from '../../lib/imports'

export type StockCountImportRow = { sellerSku: string; countedStock: number; date: string; note: string }

function findValue(row: SpreadsheetRow, aliases: string[]) {
  const key = Object.keys(row).find((candidate) => aliases.includes(candidate.toLowerCase().trim()))
  return key ? row[key].trim() : ''
}

export function ImportStockCountModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (rows: StockCountImportRow[]) => void }) {
  const [preview, setPreview] = useState<{ headers: string[]; mapped: StockCountImportRow[]; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    try {
      const rows = await parseSpreadsheet(file)
      const headers = rows.length ? Object.keys(rows[0]) : []
      const mapped: StockCountImportRow[] = []
      const errors: string[] = []
      rows.forEach((row, index) => {
        const sellerSku = findValue(row, ['seller sku', 'seller_sku', 'sku'])
        const countedStock = Number(findValue(row, ['counted stock', 'counted_stock', 'stok terhitung', 'actual stock']))
        const date = findValue(row, ['count date', 'count_date', 'tanggal hitung', 'date']) || '2026-10-09'
        const note = findValue(row, ['note', 'catatan'])
        if (!sellerSku || !Number.isFinite(countedStock) || countedStock < 0 || !date) {
          errors.push(`Row ${index + 2}: Seller SKU, stok terhitung >= 0, dan tanggal wajib valid.`)
          return
        }
        mapped.push({ sellerSku, countedStock, date, note })
      })
      setPreview({ headers, mapped, errors })
      setError(null)
    } catch {
      setError('File tidak dapat dibaca. Gunakan template stock count dengan header pada baris pertama.')
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-5"><div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-shell shadow-2xl"><div className="flex items-start justify-between border-b border-stone-100 p-6"><div><h2 className="font-display text-xl font-semibold">Upload stock count manual</h2><p className="mt-1 text-sm text-stone-500">Stok aktual akan dibandingkan dengan ledger, lalu selisihnya dicatat sebagai adjustment.</p></div><button type="button" onClick={onClose} aria-label="Tutup"><X className="h-5 w-5 text-stone-500" /></button></div><div className="overflow-y-auto p-6">{!preview && <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-linen text-center"><Upload className="h-8 w-8 text-blushDeep" /><span className="mt-4 font-semibold">Pilih template stock count</span><span className="mt-1 text-xs text-stone-500">Seller SKU · Counted Stock · Count Date · Note</span><input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => void handleFile(event.target.files?.[0])} /></label>}{error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{preview && <div className="space-y-5"><div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-linen p-4"><p className="text-xs text-stone-500">Header terbaca</p><p className="mt-2 text-sm font-semibold">{preview.headers.length}</p></div><div className="rounded-xl bg-sage/55 p-4"><p className="text-xs text-emerald-950">Valid rows</p><p className="mt-2 font-display text-2xl font-semibold text-emerald-950">{preview.mapped.length}</p></div><div className="rounded-xl bg-amber/55 p-4"><p className="text-xs text-amber-950">Invalid rows</p><p className="mt-2 font-display text-2xl font-semibold text-amber-950">{preview.errors.length}</p></div></div><div className="flex items-start gap-2 rounded-xl border border-stone-200 bg-linen p-4 text-xs text-stone-700"><FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-blushDeep" />{preview.headers.join(', ') || 'Tidak ada header'}</div>{preview.errors.map((item) => <p key={item} className="rounded-lg border border-amber bg-amber/45 p-3 text-xs text-amber-950">{item}</p>)}{preview.mapped.length > 0 && <div className="overflow-x-auto rounded-xl border border-stone-200"><table className="min-w-full text-left text-sm"><thead className="bg-linen text-xs text-stone-500"><tr><th className="px-4 py-3 font-semibold">Seller SKU</th><th className="px-4 py-3 font-semibold">Counted Stock</th><th className="px-4 py-3 font-semibold">Tanggal</th><th className="px-4 py-3 font-semibold">Catatan</th></tr></thead><tbody className="divide-y divide-stone-100">{preview.mapped.slice(0, 12).map((row) => <tr key={`${row.sellerSku}-${row.date}`}><td className="px-4 py-3 font-medium">{row.sellerSku}</td><td className="px-4 py-3">{row.countedStock}</td><td className="px-4 py-3">{row.date}</td><td className="px-4 py-3 text-stone-500">{row.note || '—'}</td></tr>)}</tbody></table></div>}</div>}</div><div className="flex justify-end gap-2 border-t border-stone-100 p-6"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-stone-600 hover:bg-linen">Batal</button>{preview && <button type="button" disabled={preview.mapped.length === 0} onClick={() => onConfirm(preview.mapped)} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="mr-2 inline h-4 w-4" /> Posting stock count</button>}</div></div></div>
}
