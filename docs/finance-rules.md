# Finance rules

## Profit and loss

Gross product sales minus seller discount and refund equals net sales. Net sales minus COGS equals gross profit. Shopee platform, processing, free shipping, service, promotion, tax, and other fees remain separate components. Ads, packaging, and other business expenses are deducted after contribution profit.

When settlement data is missing, the UI must say `Data fee Shopee belum lengkap.` and must not present an estimate as actual.

## Business position

Business position is assets minus liabilities. It is not profit. Assets include cash, bank, marketplace balances, supplier deposit, inventory, prepaid assets, receivables, and other assets.

Business expenses affect P&L. Personal spending does not. Credit card repayment reduces cash and liability but is not a second expense.

## Money

PostgreSQL amounts use numeric. TypeScript formatting is centralized in `src/lib/money.ts`. Historical posted cost is stored as a snapshot.
