import { CheckCircle2, FileSpreadsheet, Upload, X } from 'lucide-react'
import { useState } from 'react'
import { parseSpreadsheet, type SpreadsheetRow } from '../../lib/imports'

type SkuImportRow = { sellerSku: string; productName: string; variationName: string; shopeeVariationId: string; shopeePrice: number; hpp: number; openingStock: number; supplierName: string; minimumStock: number; safetyStockDays: number }

function value(row: SpreadsheetRow, keys: string[]): string {
  const key = Object.keys(row).find((header) => keys.includes(header.toLowerCase().trim()))
  return key ? row[key] : ''
}

function mapRows(rows: SpreadsheetRow[]) {
  const mapped: SkuImportRow[] = []
  const errors: string[] = []
  rows.forEach((row, index) => {
    const sellerSku = value(row, ['seller sku', 'seller_sku', 'sku'])
    const productName = value(row, ['product name', 'product_name', 'nama produk'])
    const hpp = Number(value(row, ['hpp', 'cost']))
    if (!sellerSku || !productName || !Number.isFinite(hpp) || hpp < 0) {
      errors.push(`Row ${index + 2}: Seller SKU, Product Name, dan HPP wajib valid.`)
      return
    }
    mapped.push({ sellerSku, productName, variationName: value(row, ['variation name', 'variation_name', 'variasi']), shopeeVariationId: value(row, ['shopee variation id', 'variation id', 'variation_id']), shopeePrice: Number(value(row, ['shopee price', 'price'])) || 0, hpp, openingStock: Number(value(row, ['opening actual stock', 'opening stock', 'stok awal'])) || 0, supplierName: value(row, ['default supplier', 'supplier']), minimumStock: Number(value(row, ['minimum stock', 'minimum_stock'])) || 0, safetyStockDays: Number(value(row, ['safety stock days', 'safety_stock_days'])) || 0 })
  })
  return { mapped, errors }
}

export function ImportSkuModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: (rows: SkuImportRow[]) => void }) {
  const [preview, setPreview] = useState<{ headers: string[]; rows: SpreadsheetRow[]; mapped: SkuImportRow[]; errors: string[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleFile(file: File | undefined) {
    if (!file) return
    try {
      const rows = await parseSpreadsheet(file)
      const mapped = mapRows(rows)
      setPreview({ headers: rows.length > 0 ? Object.keys(rows[0]) : [], rows, ...mapped })
    } catch {
      setError('File tidak dapat dibaca. Gunakan file Excel dengan header pada baris pertama.')
    }
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/25 p-5"><div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-shell shadow-2xl"><div className="flex items-start justify-between border-b border-stone-100 p-6"><div><h2 className="font-display text-xl font-semibold">Upload template SKU</h2><p className="mt-1 text-sm text-stone-500">Preview dan validasi dilakukan sebelum SKU disimpan.</p></div><button type="button" onClick={onClose} aria-label="Tutup"><X className="h-5 w-5 text-stone-500" /></button></div><div className="overflow-y-auto p-6">{!preview && <label className="flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-linen text-center"><Upload className="h-8 w-8 text-blushDeep" /><span className="mt-4 font-semibold">Pilih template SKU</span><span className="mt-1 text-xs text-stone-500">HPP dan Seller SKU harus tersedia</span><input type="file" accept=".xlsx,.xls" className="sr-only" onChange={(event) => void handleFile(event.target.files?.[0])} /></label>}{error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}{preview && <div className="space-y-5"><div className="grid gap-3 md:grid-cols-3"><div className="rounded-xl bg-linen p-4"><p className="text-xs text-stone-500">Total rows</p><p className="mt-2 font-display text-2xl font-semibold">{preview.rows.length}</p></div><div className="rounded-xl bg-sage/55 p-4"><p className="text-xs text-emerald-950">Valid rows</p><p className="mt-2 font-display text-2xl font-semibold text-emerald-950">{preview.mapped.length}</p></div><div className="rounded-xl bg-amber/55 p-4"><p className="text-xs text-amber-950">Invalid rows</p><p className="mt-2 font-display text-2xl font-semibold text-amber-950">{preview.errors.length}</p></div></div><div className="flex items-center gap-2 rounded-xl border border-stone-200 bg-linen p-4 text-xs text-stone-700"><FileSpreadsheet className="h-5 w-5 text-blushDeep" /> Header: {preview.headers.join(', ') || 'Tidak ditemukan'}</div>{preview.errors.map((item) => <p key={item} className="rounded-lg border border-amber bg-amber/45 p-3 text-xs text-amber-950">{item}</p>)}{preview.mapped.length > 0 && <div className="overflow-x-auto rounded-xl border border-stone-200"><table className="min-w-full text-left text-sm"><thead className="bg-linen text-xs text-stone-500"><tr><th className="px-4 py-3 font-semibold">Seller SKU</th><th className="px-4 py-3 font-semibold">Produk</th><th className="px-4 py-3 font-semibold">HPP</th><th className="px-4 py-3 font-semibold">Opening stock</th></tr></thead><tbody className="divide-y divide-stone-100">{preview.mapped.slice(0, 8).map((row) => <tr key={row.sellerSku}><td className="px-4 py-3 font-medium">{row.sellerSku}</td><td className="px-4 py-3">{row.productName}</td><td className="px-4 py-3">{row.hpp}</td><td className="px-4 py-3">{row.openingStock}</td></tr>)}</tbody></table></div>}</div>}</div><div className="flex justify-end gap-2 border-t border-stone-100 p-6"><button type="button" onClick={onClose} className="rounded-lg px-4 py-2.5 text-sm font-semibold text-stone-600 hover:bg-linen">Batal</button>{preview && <button type="button" disabled={preview.mapped.length === 0} onClick={() => onConfirm(preview.mapped)} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><CheckCircle2 className="mr-2 inline h-4 w-4" /> Confirm import</button>}</div></div></div>
}
