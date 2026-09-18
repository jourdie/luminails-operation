import { NumberInput } from './NumberInput';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState } from 'react';
import { useRows } from '../../hooks/useData';
import type { Row } from '../../types/domain';
import { Button } from '../ui/button';
import { today } from '../../lib/formatting';
export type Field = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'decimal' | 'date' | 'textarea' | 'select' | 'checkbox';
  required?: boolean;
  options?: { value: string; label: string }[];
  source?: string;
  sourceLabel?: string;
  default?: string | number | boolean;
  min?: number;
};
function SelectField({
  field,
  register,
}: {
  field: Field;
  register: ReturnType<typeof useForm>['register'];
}) {
  const query = useRows(field.source ?? 'skus', {}, !!field.source);
  return (
    <select {...register(field.key)}>
      <option value="">Pilih {field.label.toLowerCase()}</option>
      {(
        field.options ??
        query.data?.map((r) => ({
          value: String(r.id),
          label: String(r[field.sourceLabel ?? 'name'] ?? r.sku_code ?? r.id),
        })) ??
        []
      ).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
export function RecordForm({
  fields,
  initial,
  onSubmit,
  pending,
  confirmation,
}: {
  fields: Field[];
  initial?: Row;
  onSubmit: (data: Row) => Promise<unknown>;
  pending?: boolean;
  confirmation?: string;
}) {
  const shape: Record<string, z.ZodType> = {};
  for (const f of fields) {
    shape[f.key] =
      f.type === 'checkbox'
        ? z.boolean()
        : f.type === 'number'
          ? z.preprocess(
              (v) => (v === '' ? (f.required ? NaN : undefined) : Number(v)),
              f.required
                ? z
                    .number()
                    .int()
                    .min(f.min ?? 0)
                : z
                    .number()
                    .int()
                    .min(f.min ?? 0)
                    .optional(),
            )
          : f.type === 'decimal'
            ? f.required
              ? z.string().regex(/^\d+(\.\d{1,8})?$/, 'Masukkan angka valid, maksimal 8 desimal.')
              : z.union([
                  z.literal(''),
                  z
                    .string()
                    .regex(/^\d+(\.\d{1,8})?$/, 'Masukkan angka valid, maksimal 8 desimal.'),
                ])
            : f.required
              ? z.string().min(1, 'Wajib diisi.')
              : z.string().optional();
  }
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(z.object(shape)),
    defaultValues: Object.fromEntries(
      fields.map((f) => [
        f.key,
        initial?.[f.key] ??
          (f.type === 'number' || f.type === 'decimal' ? undefined : f.default) ??
          (f.type === 'date'
            ? today()
            : f.type === 'checkbox'
              ? true
              : f.type === 'number'
                ? ''
                : ''),
      ]),
    ),
  });
  const [confirm, setConfirm] = useState(false);
  return (
    <form
      onSubmit={handleSubmit(async (data) => {
        if (confirmation && !confirm) {
          setConfirm(true);
          return;
        }
        try {
          await onSubmit(Object.fromEntries(Object.entries(data).filter(([, v]) => v !== '')));
        } catch {
          /* The command hook reports a translated error. */
        }
      })}
      className="record-form"
    >
      <div className="form-grid">
        {fields.map((f) => (
          <label key={f.key} className={f.type === 'textarea' ? 'span-2' : ''}>
            <span>
              {f.label}
              {f.required ? ' *' : ''}
            </span>
            {f.type === 'select' ? (
              <SelectField field={f} register={register} />
            ) : f.type === 'textarea' ? (
              <textarea rows={3} {...register(f.key)} />
            ) : f.type === 'number' || f.type === 'decimal' ? (
              <Controller
                control={control}
                name={f.key}
                render={({ field }) => (
                  <NumberInput
                    {...field}
                    value={field.value as string | number | undefined}
                    decimal={f.type === 'decimal'}
                    onValueChange={field.onChange}
                  />
                )}
              />
            ) : (
              <input type={f.type ?? 'text'} {...register(f.key)} />
            )}
            {errors[f.key] && (
              <small className="field-error">{String(errors[f.key]?.message)}</small>
            )}
          </label>
        ))}
      </div>
      {confirm && (
        <div role="alert" className="notice">
          {confirmation}
        </div>
      )}
      <div className="form-footer">
        <span className="muted text-xs">
          {confirm ? 'Konfirmasi untuk melanjutkan.' : '* Wajib diisi'}
        </span>
        <Button disabled={pending} type="submit">
          {pending ? 'Menyimpan...' : confirm ? 'Ya, konfirmasi' : 'Simpan'}
        </Button>
      </div>
    </form>
  );
}
