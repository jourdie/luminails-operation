import { describe, expect, it } from 'vitest'
import { calculateBusinessPosition, calculateContributionProfit, calculateOperatingProfit, creditCardRepaymentEffect, expenseEffect, fulfillmentQuantityMatches, localInventoryDelta, restockPostDepositDelta, restockReceiveInventoryDelta, shouldCreateMovement, snapshotHpp, stableImportKey, supplierDepositDelta } from './businessRules'

describe('critical operational rules', () => {
  const item = { skuId: 'sku', qty: 20, unitPrice: 100000, discountPrice: 90000 }

  it('matches split fulfillment quantity', () => expect(fulfillmentQuantityMatches([item], [{ skuId: 'sku', source: 'INVENTORY', qty: 3, posted: false }, { skuId: 'sku', source: 'PARTY', qty: 17, posted: false }])).toBe(true))
  it('rejects incomplete fulfillment quantity', () => expect(fulfillmentQuantityMatches([item], [{ skuId: 'sku', source: 'INVENTORY', qty: 3, posted: false }])).toBe(false))
  it('inventory fulfillment reduces local stock', () => expect(localInventoryDelta('INVENTORY', 5)).toBe(-5))
  it('supplier fulfillment does not reduce local stock', () => expect(localInventoryDelta('PARTY', 5)).toBe(0))
  it('supplier fulfillment reduces deposit by HPP', () => expect(supplierDepositDelta('PARTY', 17, 88000)).toBe(-1496000))
  it('inventory fulfillment does not reduce supplier deposit', () => expect(supplierDepositDelta('INVENTORY', 5, 88000)).toBe(0))
  it('restock posting reduces deposit', () => expect(restockPostDepositDelta(10, 92000)).toBe(-920000))
  it('restock receiving increases inventory', () => expect(restockReceiveInventoryDelta(6)).toBe(6))
  it('same source identity is stable for idempotency', () => expect(stableImportKey('SHOPEE', 'ORDER-1', 'ITEM-1')).toBe(stableImportKey('shopee', 'order-1', 'item-1')))
  it('unshipped order cannot create movement', () => expect(shouldCreateMovement(false, true, false)).toBe(false))
  it('posted order cannot create duplicate movement', () => expect(shouldCreateMovement(true, true, true)).toBe(false))
  it('shipped order with source can create movement', () => expect(shouldCreateMovement(true, true, false)).toBe(true))
  it('HPP snapshot preserves the historical cost', () => expect(snapshotHpp(88000)).toBe(88000))
  it('contribution profit subtracts COGS and marketplace fees', () => expect(calculateContributionProfit(1000000, 400000, 100000)).toBe(500000))
  it('operating profit subtracts business expenses', () => expect(calculateOperatingProfit(500000, 120000)).toBe(380000))
  it('business position is assets minus liabilities', () => expect(calculateBusinessPosition(10000000, 3500000)).toBe(6500000))
  it('business cash expense affects P&L and cash', () => expect(expenseEffect('BUSINESS', 'CASH_BANK', 500000)).toEqual({ pnlDelta: -500000, cashDelta: -500000, liabilityDelta: 0 }))
  it('personal credit card expense affects liability but not P&L', () => expect(expenseEffect('PERSONAL', 'CREDIT_CARD', 500000)).toEqual({ pnlDelta: 0, cashDelta: 0, liabilityDelta: 500000 }))
  it('credit card repayment does not create a second expense', () => expect(creditCardRepaymentEffect(500000)).toEqual({ pnlDelta: 0, cashDelta: -500000, liabilityDelta: -500000 }))
})
