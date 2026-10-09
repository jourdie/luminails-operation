export function formatIdr(value: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value)
}

export function formatCompactIdr(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `Rp ${(value / 1_000_000).toFixed(1).replace('.', ',')} jt`
  if (Math.abs(value) >= 1_000) return `Rp ${(value / 1_000).toFixed(0)} rb`
  return formatIdr(value)
}
