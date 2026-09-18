import type { ChangeEvent } from 'react';
import { FormNumber, NumberInput } from '../../components/forms/NumberInput';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRows, useCommand } from '../../hooks/useData';
import { orderSchema } from '../../lib/validation/orders';
import { orderTotals } from '../../lib/money';
import { rupiah, today } from '../../lib/formatting';
import type { OrderInput, Row } from '../../types/domain';
import { Button } from '../../components/ui/button';
import { Loading } from '../../components/ui/common';
type Props = { channel: string; order?: Row; onSaved: (id: string) => void };
export function OrderEditor(props: Props) {
  const items = useRows(
      'sales_order_items',
      props.order ? { sales_order_id: String(props.order.id) } : {},
      !!props.order,
    ),
    allocations = useRows('fulfillment_allocations', {}, !!props.order);
  if (props.order && (items.isLoading || allocations.isLoading)) return <Loading />;
  const initial = props.order
    ? {
        order_date: String(props.order.order_date),
        channel: String(props.order.channel),
        customer_id: String(props.order.customer_id ?? ''),
        address_id: String(props.order.address_id ?? ''),
        notes: String(props.order.notes ?? ''),
        discount: -Number(props.order.adjustment_total),
        items:
          items.data?.map((i) => ({
            sku_id: String(i.sku_id),
            qty: Number(i.qty),
            normal_unit_price: Number(i.normal_unit_price),
            selling_unit_price: Number(i.selling_unit_price),
            description: String(i.description ?? ''),
            external_item_id: i.external_item_id ? String(i.external_item_id) : undefined,
            allocations:
              allocations.data
                ?.filter((a) => a.sales_order_item_id === i.id)
                .map((a) => ({
                  fulfillment_type: a.fulfillment_type as 'LOCAL_STOCK' | 'SUPPLIER',
                  qty: Number(a.qty),
                  supplier_id: a.supplier_id ? String(a.supplier_id) : undefined,
                  inventory_location_id: a.inventory_location_id
                    ? String(a.inventory_location_id)
                    : undefined,
                  procurement_item_id: a.procurement_item_id
                    ? String(a.procurement_item_id)
                    : undefined,
                })) ?? [],
          })) ?? [],
      }
    : undefined;
  return <EditorForm {...props} initial={initial} />;
}
function EditorForm({ channel, order, onSaved, initial }: Props & { initial?: OrderInput }) {
  const skus = useRows('skus'),
    products = useRows('products'),
    customers = useRows('customers'),
    addresses = useRows('customer_addresses'),
    locations = useRows('inventory_locations'),
    suppliers = useRows('suppliers'),
    promotionRules = useRows('promotion_rules'),
    promotionTiers = useRows('promotion_tiers'),
    command = useCommand();
  const empty = {
    sku_id: '',
    qty: NaN,
    normal_unit_price: NaN,
    selling_unit_price: NaN,
    description: '',
    allocations: [],
  };
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors },
  } = useForm<OrderInput>({
    resolver: zodResolver(orderSchema),
    defaultValues: initial ?? {
      channel,
      order_date: today(),
      customer_id: '',
      notes: '',
      discount: 0,
      items: [empty],
    },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'items' });
  const value = watch();
  const promoSignature = useRef('');
  useEffect(() => {
    if (!['B2B', 'WHATSAPP'].includes(channel) || !promotionRules.data || !promotionTiers.data) return;
    const paid = (value.items ?? []).filter((line) => !String(line.description ?? '').startsWith('[PROMO BONUS]'));
    const additions: string[] = [];
    for (const line of paid) {
      const sku = skus.data?.find((x) => x.id === line.sku_id);
      const product = products.data?.find((x) => x.id === sku?.product_id);
      const rule = promotionRules.data.find((r) => r.active !== false && (!r.sku_id || r.sku_id === line.sku_id) && (!r.product_class || String(r.product_class).toLowerCase() === String(product?.product_class ?? product?.category ?? '').toLowerCase()) && (!r.start_date || String(r.start_date) <= today()) && (!r.end_date || String(r.end_date) >= today()));
      if (!rule) continue;
      const tiersForRule = promotionTiers.data.filter((t) => t.promotion_rule_id === rule.id).sort((a,b) => Number(b.min_qty)-Number(a.min_qty));
      const tier = tiersForRule.find((t) => Number(line.qty) >= Number(t.min_qty));
      if (tier && Number(line.selling_unit_price) !== Number(tier.unit_price)) {
        setValue(`items.${(value.items ?? []).indexOf(line)}.selling_unit_price`, Number(tier.unit_price));
      }
      const charged = Number(line.qty) * Number(tier?.unit_price ?? line.selling_unit_price ?? 0);
      if (Number(rule.min_spend ?? 0) > 0 && Number(rule.free_qty ?? 0) > 0 && charged >= Number(rule.min_spend)) {
        const signature = `${rule.id}:${line.sku_id}`;
        additions.push(signature);
        if (!(value.items ?? []).some((x) => String(x.description ?? '').includes(`[PROMO BONUS] ${rule.name}`))) append({ sku_id: line.sku_id, qty: Number(rule.free_qty), normal_unit_price: 0, selling_unit_price: 0, description: `[PROMO BONUS] ${rule.name}`, allocations: [] });
      }
    }
    const sig = additions.join('|');
    if (promoSignature.current !== sig) promoSignature.current = sig;
  }, [channel, promotionRules.data, promotionTiers.data, skus.data, products.data, value.items, setValue, append]);
  const totals = orderTotals(value.items, value.discount);
  const [showDiscount, setShowDiscount] = useState(!!initial?.discount);
  const skuLabel = (id: unknown) => {
    const s = skus.data?.find((s) => s.id === id);
    return `${s?.sku_code ?? ''} · ${products.data?.find((p) => p.id === s?.product_id)?.name ?? ''}`;
  };
  return (
    <form
      onSubmit={handleSubmit(async (payload) => {
        try {
          const id = await command.mutateAsync({
            name: 'save_sales_order',
            args: { payload, ...(order ? { record_id: order.id } : {}) },
          });
          onSaved(String(id));
        } catch {
          /* Mutation displays a translated error. */
        }
      })}
      className="order-form"
    >
      <div className="form-grid">
        <label>
          Tanggal pesanan
          <input type="date" {...register('order_date')} />
        </label>
        <label>
          Pelanggan
          <select {...register('customer_id')}>
            <option value="">Pelanggan umum</option>
            {customers.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {String(c.name)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cabang / alamat
          <select {...register('address_id')}>
            <option value="">Tanpa alamat</option>
            {addresses.data
              ?.filter((a) => a.customer_id === value.customer_id)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {String(a.branch_name)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Catatan
          <input {...register('notes')} placeholder="Catatan pesanan (opsional)" />
        </label>
      </div>
      <div className="section-bar">
        <h2>Rincian barang</h2>
        <span className="muted text-xs">Harga diskon otomatis mengikuti Promotion Rule untuk pesanan B2B</span>
      </div>
      <div className="table-scroll">
        <table className="order-lines">
          <thead>
            <tr>
              <th>SKU / Produk</th>
              <th>Qty</th>
              <th>Harga normal</th>
              <th>Harga diskon</th>
              <th>Keterangan</th>
              <th>Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => (
              <tr key={field.id}>
                <td>
                  <select
                    aria-label={`SKU ${index + 1}`}
                    {...(() => {
                      const skuRegister = register(`items.${index}.sku_id`);
                      return {
                        ...skuRegister,
                        onChange: (event: ChangeEvent<HTMLSelectElement>) => {
                          skuRegister.onChange(event);
                          const selected = skus.data?.find((sku) => sku.id === event.target.value);
                          setValue(
                            `items.${index}.normal_unit_price`,
                            Number(selected?.retail_price ?? 0) || NaN,
                          );
                        },
                      };
                    })()}
                  >
                    <option value="">Pilih SKU</option>
                    {skus.data
                      ?.filter((s) => s.active)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {skuLabel(s.id)}
                        </option>
                      ))}
                  </select>
                </td>
                <td>
                  <FormNumber
                    aria-label={`Qty ${index + 1}`}
                    control={control}
                    name={`items.${index}.qty`}
                  />
                </td>
                <td>
                  <FormNumber
                    aria-label={`Harga normal ${index + 1}`}
                    control={control}
                    name={`items.${index}.normal_unit_price`}
                  />
                </td>
                <td>
                  <FormNumber
                    aria-label={`Harga diskon ${index + 1}`}
                    control={control}
                    name={`items.${index}.selling_unit_price`}
                  />
                </td>
                <td>
                  <input
                    aria-label={`Keterangan ${index + 1}`}
                    {...register(`items.${index}.description`)}
                    placeholder="Opsional"
                  />
                </td>
                <td className="whitespace-nowrap">
                  {rupiah(orderTotals([value.items[index]], 0).selling)}
                </td>
                <td>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={`Hapus barang ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 size={15} />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => append(empty)}>
        <Plus size={15} />
        Tambah barang
      </Button>
      <div className="order-bottom">
        <section>
          <h2>Alokasi fulfillment</h2>
          <p className="muted text-sm mb-4">
            Stok lokal dan dropship dapat digabung. Modal ditentukan saat posting.
          </p>
          {value.items.map((item, index) => {
            const local = item.allocations.find((a) => a.fulfillment_type === 'LOCAL_STOCK'),
              supplier = item.allocations.find((a) => a.fulfillment_type === 'SUPPLIER');
            const update = (type: 'LOCAL_STOCK' | 'SUPPLIER', qty: number, ref?: string) => {
              setValue(`items.${index}.allocations`, [
                ...item.allocations.filter((a) => a.fulfillment_type !== type),
                ...(qty > 0
                  ? [
                      {
                        fulfillment_type: type,
                        qty,
                        ...(type === 'LOCAL_STOCK'
                          ? {
                              inventory_location_id:
                                ref ??
                                local?.inventory_location_id ??
                                String(locations.data?.[0]?.id ?? ''),
                            }
                          : {
                              supplier_id:
                                ref ??
                                supplier?.supplier_id ??
                                String(suppliers.data?.[0]?.id ?? ''),
                            }),
                      },
                    ]
                  : []),
              ]);
            };
            return (
              <div className="allocation-card" key={index}>
                <strong>{item.sku_id ? skuLabel(item.sku_id) : `Barang ${index + 1}`}</strong>
                <div className="allocation-row">
                  <label>
                    Lokal
                    <NumberInput
                      value={local?.qty ?? ''}
                      onValueChange={(v) => update('LOCAL_STOCK', Number(v))}
                    />
                  </label>
                  <select
                    aria-label="Lokasi alokasi"
                    value={local?.inventory_location_id ?? locations.data?.[0]?.id ?? ''}
                    onChange={(e) => update('LOCAL_STOCK', local?.qty ?? 0, e.target.value)}
                  >
                    {locations.data?.map((l) => (
                      <option key={l.id} value={l.id}>
                        {String(l.name)}
                      </option>
                    ))}
                  </select>
                  <label>
                    Dropship
                    <NumberInput
                      value={supplier?.qty ?? ''}
                      onValueChange={(v) => update('SUPPLIER', Number(v))}
                    />
                  </label>
                  <select
                    aria-label="Supplier alokasi"
                    value={supplier?.supplier_id ?? suppliers.data?.[0]?.id ?? ''}
                    onChange={(e) => update('SUPPLIER', supplier?.qty ?? 0, e.target.value)}
                  >
                    {suppliers.data?.map((s) => (
                      <option key={s.id} value={s.id}>
                        {String(s.name)}
                      </option>
                    ))}
                  </select>
                </div>
                <small
                  className={
                    (local?.qty ?? 0) + (supplier?.qty ?? 0) !== item.qty ? 'field-error' : 'muted'
                  }
                >
                  Dialokasikan {(local?.qty ?? 0) + (supplier?.qty ?? 0)} / {item.qty}
                </small>
              </div>
            );
          })}
        </section>
        <section className="order-summary">
          <h2>Ringkasan pesanan</h2>
          <dl>
            <div>
              <dt>Total Barang</dt>
              <dd>{totals.units}</dd>
            </div>
            <div>
              <dt>Subtotal Harga Normal</dt>
              <dd>{rupiah(totals.normal)}</dd>
            </div>
            <div>
              <dt>Subtotal Setelah Diskon Item</dt>
              <dd>{rupiah(totals.selling)}</dd>
            </div>
            {showDiscount ? (
              <div>
                <dt>Diskon Tambahan</dt>
                <dd>
                  <NumberInput
                    aria-label="Diskon Tambahan"
                    value={value.discount || ''}
                    onValueChange={(v) => setValue('discount', Number(v))}
                  />
                </dd>
              </div>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setShowDiscount(true)}>
                + Tambah Diskon
              </Button>
            )}
            <div className="grand-total">
              <dt>Grand Total</dt>
              <dd>{rupiah(totals.grand)}</dd>
            </div>
            <div className="savings">
              <dt>Total Hemat</dt>
              <dd>{rupiah(totals.savings)}</dd>
            </div>
          </dl>
          {!totals.valid && <p className="field-error">Grand total tidak boleh negatif.</p>}
        </section>
      </div>
      {Object.keys(errors).length > 0 && (
        <p className="field-error" role="alert">
          Periksa SKU, jumlah positif, tanggal, dan harga setiap barang.
        </p>
      )}
      <div className="form-footer">
        <span className="muted text-sm">Draft belum mengubah stok atau deposit.</span>
        <Button disabled={command.isPending || !totals.valid} type="submit">
          {command.isPending ? 'Menyimpan...' : 'Simpan draft'}
        </Button>
      </div>
    </form>
  );
}
