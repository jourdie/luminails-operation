import { z } from 'zod';
export const moneySchema = z.number().int().min(0).max(1_000_000_000_000);
export const orderSchema = z
  .object({
    order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    channel: z
      .string()
      .refine((v) => ['WHATSAPP', 'MANUAL', 'SHOPEE', 'B2B', 'RESELLER', 'OTHER'].includes(v)),
    customer_id: z.string().optional(),
    address_id: z.string().optional(),
    external_order_number: z.string().optional(),
    notes: z.string().optional(),
    discount: moneySchema,
    items: z
      .array(
        z.object({
          sku_id: z.string().min(1, 'Pilih SKU.'),
          qty: z.number().int().positive().max(1000000),
          normal_unit_price: moneySchema,
          selling_unit_price: moneySchema,
          description: z.string().optional(),
          external_item_id: z.string().optional(),
          allocations: z.array(
            z.object({
              fulfillment_type: z.enum(['LOCAL_STOCK', 'SUPPLIER']),
              qty: z.number().int().positive(),
              supplier_id: z.string().optional(),
              inventory_location_id: z.string().optional(),
              procurement_item_id: z.string().optional(),
            }),
          ),
        }),
      )
      .min(1, 'Tambahkan minimal satu barang.'),
  })
  .superRefine((order, ctx) => {
    const normal = order.items.reduce(
      (s, i) => s + BigInt(i.qty) * BigInt(i.normal_unit_price),
      0n,
    );
    const selling = order.items.reduce(
      (s, i) => s + BigInt(i.qty) * BigInt(i.selling_unit_price),
      0n,
    );
    if (normal > 999999999999999n || selling > 999999999999999n)
      ctx.addIssue({
        code: 'custom',
        message: 'Total melebihi batas angka aman untuk ekspor.',
        path: ['items'],
      });
  });
