import type { DepositMovement, InventoryMovement, LocalDatabase, Sku } from './localDb'

export function inventoryBalance(movements: InventoryMovement[], skuId: string): number {
  return movements.filter((movement) => movement.skuId === skuId).reduce((total, movement) => total + movement.qtyDelta, 0)
}

export function inventoryValue(movements: InventoryMovement[], skus: Sku[]): number {
  return skus.reduce((total, sku) => total + inventoryBalance(movements, sku.id) * sku.hpp, 0)
}

export function supplierDepositBalance(movements: DepositMovement[], supplierId: string): number {
  return movements.filter((movement) => movement.supplierId === supplierId).reduce((total, movement) => total + movement.amountDelta, 0)
}

export function movingWeightedAverage(currentQty: number, currentCost: number, receivedQty: number, receivedCost: number): number {
  if (receivedQty <= 0) return currentCost
  if (currentQty + receivedQty <= 0) return receivedCost
  return Math.round(((currentQty * currentCost) + (receivedQty * receivedCost)) / (currentQty + receivedQty))
}

export function getSkuBalance(database: LocalDatabase, skuId: string): number {
  return inventoryBalance(database.inventoryMovements, skuId)
}

export function getSupplierBalance(database: LocalDatabase, supplierId: string): number {
  return supplierDepositBalance(database.depositMovements, supplierId)
}
