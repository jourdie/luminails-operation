import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import Decimal from 'decimal.js';
export const rupiah = (value: string | number | null | undefined) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(BigInt(new Decimal(value ?? 0).toFixed(0)));
export const number = (value: string | number | null | undefined) =>
  new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(Number(value ?? 0));
export const date = (value: string) => format(parseISO(value), 'dd MMM yyyy', { locale: id });
export const today = () => format(new Date(), 'yyyy-MM-dd');
