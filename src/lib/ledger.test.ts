import { describe, expect, it } from 'vitest'
import { inventoryBalance, movingWeightedAverage, supplierDepositBalance } from './ledger'

describe('ledger calculations', () => {
  it('calculates inventory from movements only', () => {
    expect(inventoryBalance([
      { id: 'a', skuId: 'sku', date: '2026-10-01', qtyDelta: 20, movementType: 'OPENING_BALANCE', source: 'opening', unitCost: 88000, createdAt: '' },
      { id: 'b', skuId: 'sku', date: '2026-10-02', qtyDelta: -5, movementType: 'SALE', source: 'order', unitCost: 88000, createdAt: '' }
    ], 'sku')).toBe(15)
  })

  it('calculates supplier deposit movements independently', () => {
    expect(supplierDepositBalance([
      { id: 'a', supplierId: 'party', date: '2026-10-01', amountDelta: 1000000, movementType: 'OPENING_BALANCE', source: 'opening', createdAt: '' },
      { id: 'b', supplierId: 'party', date: '2026-10-02', amountDelta: -440000, movementType: 'DROPSHIP_USAGE', source: 'order', createdAt: '' }
    ], 'party')).toBe(560000)
  })

  it('uses moving weighted average for received stock', () => {
    expect(movingWeightedAverage(20, 88000, 10, 92000)).toBe(89333)
  })
})
