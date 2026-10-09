# Inventory rules

- Shopee stock reference is never actual Luminails stock.
- Actual stock is the sum of posted inventory movements by workspace, SKU, and location.
- Unshipped orders do not create movements.
- Supplier dropship does not reduce local inventory.
- Inventory sale movements use the unit cost snapshot captured at posting time.
- Restock posting reduces supplier deposit; restock receiving increases inventory.
- Posted movements are immutable. Corrections use reversal movements.
- Physical inventory uses moving weighted average cost. Supplier dropship uses supplier HPP snapshot.

## Safety checks

The UI previews adjustments, while database RPC functions validate permissions, non-zero quantity, sufficient inventory, duplicate source identity, and audit history again.
