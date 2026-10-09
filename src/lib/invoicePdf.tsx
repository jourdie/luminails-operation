import { Document, Page, StyleSheet, Text, View, pdf } from '@react-pdf/renderer'
import type { SalesOrder, Sku } from './localDb'

const styles = StyleSheet.create({
  page: { padding: 42, fontSize: 10, color: '#302b2d' },
  title: { fontSize: 22, marginBottom: 6 },
  meta: { color: '#6b6264', marginBottom: 22 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e7e1dc', paddingVertical: 8 },
  cell: { flex: 1 },
  total: { marginTop: 18, fontSize: 14, textAlign: 'right' }
})

export async function downloadInvoicePdf(order: SalesOrder, skus: Sku[]): Promise<void> {
  const invoiceNumber = `LUM-INV-${order.date.slice(0, 4)}-${order.id.slice(-4).toUpperCase()}`
  const total = order.items.reduce((sum, item) => sum + item.discountPrice * item.qty, 0)
  const blob = await pdf(<Document><Page size="A4" style={styles.page}><Text style={styles.title}>Luminails</Text><Text style={styles.meta}>{invoiceNumber} | {order.date}</Text><Text>Customer: {order.customer}</Text><View style={{ marginTop: 24 }}>{order.items.map((item) => { const sku = skus.find((entry) => entry.id === item.skuId); return <View key={item.skuId} style={styles.row}><Text style={styles.cell}>{sku?.productName ?? item.skuId}</Text><Text style={styles.cell}>{item.qty} x {item.discountPrice.toLocaleString('id-ID')}</Text><Text style={styles.cell}>{(item.qty * item.discountPrice).toLocaleString('id-ID')}</Text></View> })}</View><Text style={styles.total}>Total: Rp {total.toLocaleString('id-ID')}</Text></Page></Document>).toBlob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${invoiceNumber}.pdf`
  link.click()
  URL.revokeObjectURL(url)
}
