const messages: Record<string, string> = {
  INVALID_CUSTOMER: 'Pelanggan tidak aktif atau tidak tersedia dalam workspace ini.',
  ADDRESS_REQUIRED: 'Alamat utama wajib diisi jika pelanggan tidak memiliki multi cabang.',
  INVALID_SKU: 'SKU tidak aktif atau belum tersedia dalam workspace ini.',
  ACCESS_DENIED: 'Anda tidak memiliki akses ke modul ini.',
  ALLOCATION_MISMATCH: 'Jumlah fulfillment belum sama dengan jumlah barang terjual.',
  INSUFFICIENT_DEPOSIT: 'Saldo deposit supplier tidak mencukupi.',
  INSUFFICIENT_STOCK: 'Stok lokal tidak mencukupi.',
  IMMUTABLE_POSTED: 'Transaksi yang sudah diposting tidak dapat diedit.',
  COST_NOT_FOUND: 'Modal supplier belum tersedia pada tanggal transaksi.',
  NEGATIVE_TOTAL: 'Diskon melebihi subtotal pesanan.',
  RECONCILIATION_REQUIRED: 'Periksa dan konfirmasi rekonsiliasi dropship terlebih dahulu.',
  RECONCILIATION_CONFLICT: 'SKU, supplier, atau jumlah rekonsiliasi tidak sesuai.',
  INVALID_STATUS: 'Status transaksi tidak mengizinkan tindakan ini.',
  PAYMENT_EXCEEDS_BALANCE: 'Pembayaran harus positif dan tidak melebihi sisa tagihan.',
  VOID_INVOICE_FIRST: 'Batalkan invoice sebelum mengedit, membatalkan, atau membalik pesanan.',
  LINKED_ORDER_LOCKED:
    'Pesanan sudah tertaut. Batalkan draft supplier terlebih dahulu untuk mengubah sumbernya.',
  SOURCE_ALREADY_LINKED: 'Invoice ini sudah dimasukkan ke Restock & Dropship.',
  SOURCE_ALLOCATION_CONFLICT:
    'Invoice memiliki alokasi stok lokal atau supplier lain. Sesuaikan alokasi sebelum menerbitkan invoice untuk dropship penuh.',
  CANCEL_SUPPLIER_DRAFT_FIRST: 'Batalkan draft di Restock & Dropship sebelum membatalkan invoice.',
  INVOICE_REQUIRED: 'Pilih invoice aktif dari Pesanan B2B atau B2B.',
  DUPLICATE_ORDER: 'Nomor pesanan Shopee sudah ada. Muat ulang preview sebelum menyimpan.',
  REVERSE_PAYMENT_FIRST: 'Balik pembayaran sebelum membatalkan invoice.',
  REVERSE_SOURCE_REQUIRED: 'Balik transaksi sumber agar seluruh ledger tetap konsisten.',
  LATER_STOCK_MOVEMENT:
    'Ada pergerakan stok setelah penerimaan. Gunakan penyesuaian stok yang ditinjau pemilik.',
  INVOICE_REQUIRES_CUSTOMER: 'Pilih pelanggan pada draft pesanan sebelum menerbitkan invoice.',
  OWNER_PROTECTED: 'Akun pemilik dilindungi dari perubahan di formulir ini.',
  INVALID_CURRENCY: 'Mata uang harus sesuai akun; kurs IDR harus 1.',
  INVALID_ADDRESS: 'Cabang bukan milik pelanggan ini.',
  NOT_FOUND: 'Data tidak ditemukan.',
  IMPORT_ID_REQUIRED: 'Nomor pesanan dan ID item Shopee wajib diisi.',
  EMPTY_ORDER: 'File tidak berisi baris data yang bisa diimpor.',
  INVALID_BRAND: 'Merk pada file SKU belum ada di dropdown Merk. Tambahkan merk terlebih dahulu.',
  INVALID_SUPPLIER: 'Supplier pada file SKU belum ada. Pilih nama atau kode supplier yang tersedia.',
  RECORD_IN_USE: 'Data tidak bisa dihapus karena masih dipakai oleh data lain. Hapus atau batalkan data turunannya terlebih dahulu.',
  INVALID_ENTITY: 'Jenis data ini tidak bisa dihapus dari daftar ini.',
  LOCAL_CLEANSING_UNAVAILABLE: 'Cleansing hanya tersedia untuk mode data lokal di browser.',
  LOCAL_CLEANSING_FAILED: 'Data lokal gagal dibersihkan. Tutup tab aplikasi lain lalu coba lagi.',
  LOCAL_CLEANSING_BLOCKED: 'Cleansing tertahan karena aplikasi masih terbuka di tab lain. Tutup tab tersebut lalu coba lagi.',
  INVALID_AMOUNT: 'Periksa jumlah, nilai, dan arah transaksi.',
};
export function friendlyError(error: unknown) {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === 'object' && error && 'message' in error
        ? String(error.message)
        : String(error);
  const match = Object.keys(messages).find((key) => raw.includes(key));
  if (match) return messages[match];
  if (/duplicate key|23505/.test(raw))
    return 'Data sudah ada. Periksa nomor unik atau duplikat impor.';
  if (/foreign key|23503/.test(raw)) return 'Referensi data tidak valid atau berbeda workspace.';
  if (/check constraint|23514|invalid input syntax/.test(raw))
    return 'Nilai belum valid. Periksa kembali formulir.';
  if (/fetch|network/i.test(raw)) return 'Koneksi gagal. Periksa jaringan lalu coba kembali.';
  if (import.meta.env.DEV) console.error(error);
  return 'Tindakan gagal. Periksa data dan izin akses, lalu coba kembali.';
}
