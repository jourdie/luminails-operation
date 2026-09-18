import Decimal from 'decimal.js';
import type { OrderLine } from '../types/domain';
Decimal.set({ precision: 30, rounding: Decimal.ROUND_HALF_UP });
export function sumMoney(values: unknown[]): string {
  return values
    .reduce<Decimal>((sum, value) => sum.plus(String(value ?? 0)), new Decimal(0))
    .toString();
}
export function subtractMoney(value: string | number, ...deductions: (string | number)[]): string {
  return deductions.reduce((sum, amount) => sum.minus(amount), new Decimal(value)).toString();
}
export function moneyRatio(
  numerator: string | number,
  denominator: string | number,
): number | null {
  const divisor = new Decimal(denominator);
  return divisor.isZero() ? null : new Decimal(numerator).div(divisor).toNumber();
}
export function orderTotals(
  items: Pick<OrderLine, 'qty' | 'normal_unit_price' | 'selling_unit_price'>[],
  discount: number | string,
) {
  const normal = items.reduce(
    (n, i) => n.plus(new Decimal(i.normal_unit_price || 0).times(i.qty || 0)),
    new Decimal(0),
  );
  const selling = items.reduce(
    (n, i) => n.plus(new Decimal(i.selling_unit_price || 0).times(i.qty || 0)),
    new Decimal(0),
  );
  const grand = selling.minus(discount || 0);
  return {
    units: items.reduce((n, i) => n + (i.qty || 0), 0),
    normal: normal.toFixed(0),
    selling: selling.toFixed(0),
    discount: new Decimal(discount || 0).toFixed(0),
    grand: grand.toFixed(0),
    savings: normal.minus(grand).toFixed(0),
    valid: !grand.isNegative(),
  };
}
