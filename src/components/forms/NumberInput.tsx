import { forwardRef, type InputHTMLAttributes } from 'react';
import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form';

export function formatNumberInput(value: string | number | undefined) {
  if (value === undefined || value === '' || Number.isNaN(value)) return '';
  const [whole, fraction] = String(value).split('.');
  return (
    whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (fraction !== undefined ? ',' + fraction : '')
  );
}
export function parseNumberInput(value: string) {
  return value.replace(/\./g, '').replace(',', '.');
}
type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value?: string | number;
  onValueChange: (value: string) => void;
  decimal?: boolean;
};
export const NumberInput = forwardRef<HTMLInputElement, Props>(function NumberInput(
  { value, onValueChange, decimal = false, ...props },
  ref,
) {
  return (
    <input
      {...props}
      ref={ref}
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      placeholder="0"
      value={formatNumberInput(value)}
      onChange={(event) => {
        const canonical = parseNumberInput(event.target.value);
        if ((decimal ? /^-?\d*(\.\d{0,8})?$/ : /^-?\d*$/).test(canonical)) onValueChange(canonical);
      }}
    />
  );
});
export function FormNumber<T extends FieldValues>({
  control,
  name,
  optional = false,
  ...props
}: {
  control: Control<T>;
  name: FieldPath<T>;
  optional?: boolean;
} & Omit<Props, 'value' | 'onValueChange'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <NumberInput
          {...props}
          {...field}
          onValueChange={(v) => field.onChange(v === '' ? (optional ? 0 : NaN) : Number(v))}
        />
      )}
    />
  );
}
