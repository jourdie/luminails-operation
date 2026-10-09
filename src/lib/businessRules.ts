import type { FulfillmentAllocation, SalesOrderItem } from './localDb'

export function fulfillmentQuantityMatches(items: SalesOrderItem[], allocations: FulfillmentAllocation[]): boolean {
  return items.every((item) => allocations.filter((allocation) => allocation.skuId === item.skuId).reduce((sum, allocation) => sum + allocation.qty, 0) === item.qty)
}

export function localInventoryDelta(source: FulfillmentAllocation['source'], quantity: number): number {
  return source === 'INVENTORY' ? -quantity : 0
}

export function supplierDepositDelta(source: FulfillmentAllocation['source'], quantity: number, hpp: number): number {
  return source === 'INVENTORY' ? 0 : -(quantity * hpp)
}

export function restockPostDepositDelta(quantity: number, unitCost: number): number {
  return -(quantity * unitCost)
}

export function restockReceiveInventoryDelta(receivedQuantity: number): number {
  return receivedQuantity
}

export function stableImportKey(source: string, externalId: string, itemId = ''): string {
  return `${source}:${externalId}:${itemId}`.toLowerCase()
}

export function shouldCreateMovement(isEligibleShipped: boolean, hasFulfillmentSource: boolean, alreadyPosted: boolean): boolean {
  return isEligibleShipped && hasFulfillmentSource && !alreadyPosted
}

export function snapshotHpp(cost: number): number {
  return cost
}

export function calculateContributionProfit(netSales: number, cogs: number, marketplaceFees: number): number {
  return netSales - cogs - marketplaceFees
}

export function calculateOperatingProfit(contributionProfit: number, businessExpenses: number): number {
  return contributionProfit - businessExpenses
}

export function calculateBusinessPosition(assets: number, liabilities: number): number {
  return assets - liabilities
}

export function expenseEffect(purpose: 'BUSINESS' | 'PERSONAL', paymentSource: 'CASH_BANK' | 'CREDIT_CARD' | 'OTHER', amount: number) {
  return {
    pnlDelta: purpose === 'BUSINESS' ? -amount : 0,
    cashDelta: paymentSource === 'CASH_BANK' ? -amount : 0,
    liabilityDelta: paymentSource === 'CREDIT_CARD' ? amount : 0
  }
}

export function creditCardRepaymentEffect(amount: number) {
  return { pnlDelta: 0, cashDelta: -amount, liabilityDelta: -amount }
}
