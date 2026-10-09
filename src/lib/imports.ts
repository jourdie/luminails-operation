import { z } from 'zod'

export type SpreadsheetRow = Record<string, string>

export type OrderImportResult = {
  headers: string[]
  rows: SpreadsheetRow[]
  mapped: Array<{ externalOrderId: string; sellerSku: string; qty: number; status: string; date: string; customer: string }>
  errors: Array<{ row: number; message: string }>
}

export type SettlementImportRow = {
  externalOrderId: string
  grossProductSales: number
  sellerDiscount: number
  refund: number
  platformFee: number
  processingFee: number
  freeShippingFee: number
  serviceFee: number
  promotionFee: number
  shopeeTax: number
  otherShopeeFee: number
  netReleasedIncome: number
}

const importedOrderSchema = z.object({
  externalOrderId: z.string().min(1),
  sellerSku: z.string().min(1),
  qty: z.number().positive(),
  status: z.string().min(1),
  date: z.string().min(1),
  customer: z.string()
})

function findHeader(headers: string[], candidates: string[]): string | undefined {
  return headers.find((header) => candidates.some((candidate) => header.toLowerCase().trim() === candidate))
}

function cellValue(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'object' && 'text' in value) return String(value.text)
  return String(value)
}

export async function parseSpreadsheet(file: File): Promise<SpreadsheetRow[]> {
  const { Workbook } = await import('exceljs')
  const workbook = new Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())
  const worksheet = workbook.worksheets[0]
  if (!worksheet) return []
  const headerValues = worksheet.getRow(1).values as unknown[]
  const headers = headerValues.slice(1).map(cellValue)
  const rows: SpreadsheetRow[] = []
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const values = row.values as unknown[]
    const record: SpreadsheetRow = {}
    headers.forEach((header, index) => { record[header] = cellValue(values[index + 1]) })
    if (Object.values(record).some(Boolean)) rows.push(record)
  })
  return rows
}

export function mapShopeeOrderRows(rows: SpreadsheetRow[]): OrderImportResult {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const orderHeader = findHeader(headers, ['order sn', 'order_sn', 'order number', 'nomor pesanan'])
  const skuHeader = findHeader(headers, ['seller sku', 'seller_sku', 'sku', 'variation sku'])
  const qtyHeader = findHeader(headers, ['quantity', 'qty', 'jumlah'])
  const statusHeader = findHeader(headers, ['order status', 'order_status', 'status pesanan', 'status'])
  const dateHeader = findHeader(headers, ['create time', 'order date', 'tanggal pesanan', 'ship time'])
  const customerHeader = findHeader(headers, ['buyer username', 'buyer', 'customer', 'nama pembeli'])
  const errors: Array<{ row: number; message: string }> = []
  const mapped: OrderImportResult['mapped'] = []

  rows.forEach((row, index) => {
    const result = importedOrderSchema.safeParse({
      externalOrderId: orderHeader ? row[orderHeader] : '',
      sellerSku: skuHeader ? row[skuHeader] : '',
      qty: Number(qtyHeader ? row[qtyHeader] : ''),
      status: statusHeader ? row[statusHeader] : 'READY_TO_SHIP',
      date: dateHeader ? row[dateHeader] : '2026-10-07',
      customer: customerHeader ? row[customerHeader] : ''
    })
    if (!result.success) {
      errors.push({ row: index + 2, message: 'Order ID, SKU, dan quantity wajib tersedia.' })
      return
    }
    mapped.push(result.data)
  })

  return { headers, rows, mapped, errors }
}

export function mapSettlementRows(rows: SpreadsheetRow[]): { mapped: SettlementImportRow[]; errors: string[]; headers: string[] } {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  const header = (aliases: string[]) => findHeader(headers, aliases)
  const numeric = (row: SpreadsheetRow, aliases: string[]) => Number(header(aliases) ? row[header(aliases) as string] : '') || 0
  const mapped: SettlementImportRow[] = []
  const errors: string[] = []
  rows.forEach((row, index) => {
    const externalOrderId = header(['order number', 'order_sn', 'order sn', 'nomor pesanan']) ? row[header(['order number', 'order_sn', 'order sn', 'nomor pesanan']) as string] : ''
    if (!externalOrderId) {
      errors.push(`Row ${index + 2}: Order Number wajib tersedia.`)
      return
    }
    mapped.push({ externalOrderId, grossProductSales: numeric(row, ['product revenue', 'gross product sales', 'pendapatan produk']), sellerDiscount: numeric(row, ['seller discount', 'diskon penjual']), refund: numeric(row, ['refund', 'pengembalian']), platformFee: numeric(row, ['platform fee', 'biaya platform']), processingFee: numeric(row, ['order processing fee', 'processing fee', 'biaya pemrosesan']), freeShippingFee: numeric(row, ['free shipping fee', 'biaya gratis ongkir']), serviceFee: numeric(row, ['service fee', 'biaya layanan']), promotionFee: numeric(row, ['promotion fee', 'campaign fee', 'biaya promosi']), shopeeTax: numeric(row, ['shopee tax', 'pph 22', 'pajak shopee']), otherShopeeFee: numeric(row, ['other shopee fee', 'other fee', 'biaya lainnya']), netReleasedIncome: numeric(row, ['net released income', 'released income', 'pendapatan bersih']) })
  })
  return { mapped, errors, headers }
}
