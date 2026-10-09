# Import rules

Every import follows Upload, Preview, Validate, Map, Resolve Errors, Confirm, and Post.

The browser never mutates an authoritative ledger when a file is selected. Import batches keep source, file hash, filename, raw rows, validation status, and mapping status. A stable external order or item identity prevents duplicate order and movement creation.

The local preview uses ExcelJS only after the user selects a file. Settlement import keeps each Shopee fee component separately and marks rows as EXACT, ALLOCATED, or UNMATCHED.
