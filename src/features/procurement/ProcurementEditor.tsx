import { FormNumber } from '../../components/forms/NumberInput';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2 } from 'lucide-react';
import { useRows, useCommand } from '../../hooks/useData';
import { Button } from '../../components/ui/button';
import { Loading } from '../../components/ui/common';
import type { Row } from '../../types/domain';
const schema = z.object({
  supplier_id: z.string().min(1),
  order_date: z.iso.date(),
  external_order_number: z.string(),
  tracking_number: z.string(),
  notes: z.string(),
  items: z
    .array(
      z
        .object({
          sku_id: z.string().min(1),
          qty: z.number().int().positive(),
          destination_type: z.enum([
            'WAREHOUSE',
            'CUSTOMER',
            'SHOPEE_ORDER',
            'RESELLER_ORDER',
            'B2B_ORDER',
          ]),
          inventory_location_id: z.string(),
        })
        .refine((v) => v.destination_type !== 'WAREHOUSE' || !!v.inventory_location_id, {
          message: 'Pilih lokasi penerimaan.',
        }),
    )
    .min(1),
});
type Input = z.infer<typeof schema>;
export function ProcurementEditor({
  order,
  onSaved,
  supplierId,
  orderDate,
}: {
  order?: Row;
  onSaved: () => void;
  supplierId: string;
  orderDate: string;
}) {
  const items = useRows(
    'procurement_items',
    order ? { procurement_order_id: String(order.id) } : {},
    !!order,
  );
  if (order && items.isLoading) return <Loading />;
  return (
    <Form
      supplierId={supplierId}
      orderDate={orderDate}
      order={order}
      initialItems={items.data ?? []}
      onSaved={onSaved}
    />
  );
}
function Form({
  order,
  supplierId,
  orderDate,
  initialItems,
  onSaved,
}: {
  order?: Row;
  initialItems: Row[];
  supplierId: string;
  orderDate: string;
  onSaved: () => void;
}) {
  const skus = useRows('skus'),
    products = useRows('products'),
    locations = useRows('inventory_locations'),
    command = useCommand();
  const blank = {
    sku_id: '',
    qty: NaN,
    destination_type: 'WAREHOUSE' as const,
    inventory_location_id: '',
  };
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<Input>({
    resolver: zodResolver(schema),
    defaultValues: {
      supplier_id: supplierId,
      order_date: orderDate,
      external_order_number: String(order?.external_order_number ?? ''),
      tracking_number: String(order?.tracking_number ?? ''),
      notes: String(order?.notes ?? ''),
      items: order
        ? initialItems.map((i) => ({
            sku_id: String(i.sku_id),
            qty: Number(i.qty),
            destination_type: i.destination_type as Input['items'][number]['destination_type'],
            inventory_location_id: String(i.inventory_location_id ?? ''),
          }))
        : [blank],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const values = watch();
  return (
    <form
      className="record-form"
      onSubmit={handleSubmit(async (payload) => {
        try {
          await command.mutateAsync({
            name: order ? 'update_procurement_draft' : 'save_procurement_order',
            args: { payload, ...(order ? { record_id: order.id } : {}) },
          });
          onSaved();
        } catch {
          /* mutation reports error */
        }
      })}
    >
      <div className="form-grid">
        <label>
          Nomor pesanan marketplace
          <input {...register('external_order_number')} />
        </label>
        <label>
          Nomor resi
          <input {...register('tracking_number')} />
        </label>
      </div>
      <h2 className="section-heading">Barang pesanan</h2>
      <div className="table-scroll">
        <table className="order-lines">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Qty</th>
              <th>Tujuan</th>
              <th>Lokasi penerimaan</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {fields.map((f, i) => (
              <tr key={f.id}>
                <td>
                  <select {...register(`items.${i}.sku_id`)}>
                    <option value="">Pilih SKU</option>
                    {skus.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {String(s.sku_code)} ·{' '}
                        {String(products.data?.find((p) => p.id === s.product_id)?.name ?? '')}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <FormNumber
                    aria-label={`Qty restock ${i + 1}`}
                    control={control}
                    name={`items.${i}.qty`}
                  />
                </td>
                <td>
                  <select {...register(`items.${i}.destination_type`)}>
                    {['WAREHOUSE'].map((d) => (
                      <option key={d}>{d}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <select
                    disabled={values.items[i].destination_type !== 'WAREHOUSE'}
                    {...register(`items.${i}.inventory_location_id`)}
                  >
                    <option value="">Pilih lokasi</option>
                    {locations.data?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {String(l.name)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <Button
                    type="button"
                    variant="ghost"
                    aria-label="Hapus item"
                    onClick={() => remove(i)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={() => append(blank)}>
        <Plus size={15} />
        Tambah barang
      </Button>
      <label className="mt-5">
        Catatan
        <textarea {...register('notes')} />
      </label>
      {Object.keys(errors).length > 0 && (
        <p className="field-error mt-4">
          Periksa supplier, SKU, jumlah, dan lokasi setiap item restock.
        </p>
      )}
      <div className="form-footer">
        <p className="muted text-sm">
          Modal supplier ditentukan saat posting, berdasarkan tanggal pesanan.
        </p>
        <Button type="submit" disabled={command.isPending}>
          Simpan draft
        </Button>
      </div>
    </form>
  );
}
