import { Document, Page, Text, View, Image, StyleSheet, pdf } from '@react-pdf/renderer';
import { luminailsSupplyLogo as logoUrl } from './logo';
import { download, type ExportOrder } from './excel';
import { orderTotals } from '../money';
import { rupiah } from '../formatting';
const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica', fontSize: 9, color: '#203331' },
  brand: { fontSize: 26, color: '#103e38', marginBottom: 5 },
  logo: { width: 86, height: 52, objectFit: 'contain', marginBottom: 6 },
  muted: { color: '#667773', marginBottom: 4 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e7e4',
    paddingVertical: 8,
  },
  header: { backgroundColor: '#edf4f0', fontSize: 8, fontFamily: 'Helvetica-Bold' },
  cell: { width: '16%', paddingRight: 6 },
  product: { width: '24%' },
  totals: { marginTop: 20, marginLeft: '45%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  grand: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#103e38' },
  footer: { position: 'absolute', bottom: 25, left: 36, right: 36, fontSize: 8, color: '#778783' },
});
export function OrderDocument({ order }: { order: ExportOrder }) {
  const t = orderTotals(order.items, order.discount);
  return (
    <Document title={order.number} author="Luminails">
      <Page size="A4" style={styles.page}>
        {order.dueDate && <Image src={logoUrl} style={styles.logo} />}
        <Text style={styles.brand}>Luminails.supply</Text>
        <Text style={styles.muted}>
          {order.dueDate ? 'INVOICE' : 'RINCIAN PESANAN'} Â· {order.number}
        </Text>
        <Text style={styles.muted}>
          Tanggal: {order.date}
          {order.dueDate ? ` | Jatuh tempo: ${order.dueDate}` : ''}
        </Text>
        <View style={{ marginVertical: 18 }}>
          <Text>{order.customer}</Text>
          {order.address && <Text style={styles.muted}>{order.address}</Text>}
        </View>
        <View style={[styles.row, styles.header]} fixed>
          {(order.dueDate
            ? [
                'Product Class',
                'SKU Type',
                'Produk',
                'Qty',
                'Harga Normal',
                'Diskon Produk',
                'Total',
              ]
            : ['SKU / Produk', 'Qty', 'Harga Normal', 'Harga Diskon', 'Keterangan', 'Total']
          ).map((h, i) => (
            <Text key={h} style={i === (order.dueDate ? 2 : 0) ? styles.product : styles.cell}>
              {h}
            </Text>
          ))}
        </View>
        {order.items.map((i, n) => (
          <View key={n} style={styles.row} wrap={false}>
            {order.dueDate ? (
              <>
                <Text style={styles.cell}>{i.product_type ?? ''}</Text>
                <Text style={styles.cell}>{i.sku_type ?? ''}</Text>
                <Text style={styles.product}>{i.name}</Text>
                <Text style={styles.cell}>{i.qty}</Text>
                <Text style={styles.cell}>{rupiah(i.normal_unit_price)}</Text>
                <Text style={styles.cell}>
                  {rupiah(i.normal_unit_price - i.selling_unit_price)}
                </Text>
                <Text style={styles.cell}>{rupiah(i.qty * i.selling_unit_price)}</Text>
              </>
            ) : (
              <>
                <Text style={styles.product}>
                  {i.sku}
                  {'\n'}
                  {i.name}
                </Text>
                <Text style={styles.cell}>{i.qty}</Text>
                <Text style={styles.cell}>{rupiah(i.normal_unit_price)}</Text>
                <Text style={styles.cell}>{rupiah(i.selling_unit_price)}</Text>
                <Text style={styles.cell}>{i.description ?? ''}</Text>
                <Text style={styles.cell}>{rupiah(i.qty * i.selling_unit_price)}</Text>
              </>
            )}
          </View>
        ))}
        <View style={styles.totals} wrap={false}>
          {[
            ['Total Barang', String(t.units)],
            ['Subtotal Normal', rupiah(t.normal)],
            ...(order.dueDate
              ? [
                  ['Diskon Produk', rupiah(Number(t.normal) - Number(t.selling))],
                  ['Diskon Tambahan', rupiah(t.discount)],
                  ['Total', rupiah(t.grand)],
                ]
              : [
                  ['Subtotal Customer', rupiah(t.selling)],
                  ['Diskon Tambahan', `- ${rupiah(t.discount)}`],
                  ['Grand Total', rupiah(t.grand)],
                  ['Total Hemat', rupiah(t.savings)],
                ]),
            ...(order.dueDate
              ? [
                  ['Dibayar', rupiah(order.paid)],
                  ['Sisa Tagihan', rupiah(Number(t.grand) - Number(order.paid ?? 0))],
                ]
              : []),
          ].map(([label, value]) => (
            <View
              key={label}
              style={[styles.totalRow, ...(label === 'Grand Total' ? [styles.grand] : [])]}
            >
              <Text>{label}</Text>
              <Text>{value}</Text>
            </View>
          ))}
        </View>
        {order.paymentInfo && (
          <Text style={{ marginTop: 24 }}>Pembayaran: {order.paymentInfo}</Text>
        )}
        {order.notes && <Text style={{ marginTop: 12 }}>{order.notes}</Text>}
        <Text
          style={styles.footer}
          fixed
          render={({ pageNumber, totalPages }) =>
            `Luminails Â· Terima kasih atas kepercayaan Anda.                                      ${pageNumber} / ${totalPages}`
          }
        />
      </Page>
    </Document>
  );
}
export async function exportOrderPdf(order: ExportOrder, print = false) {
  const blob = await pdf(<OrderDocument order={order} />).toBlob();
  if (print) {
    const url = URL.createObjectURL(blob);
    const frame = document.createElement('iframe');
    frame.style.display = 'none';
    frame.src = url;
    document.body.appendChild(frame);
    frame.onload = () => setTimeout(() => frame.contentWindow?.print(), 300);
    setTimeout(() => {
      frame.remove();
      URL.revokeObjectURL(url);
    }, 120000);
  } else download(blob, `${order.number}.pdf`);
}

