// @vitest-environment jsdom
import { useState } from 'react';
import { it, expect } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { NumberInput, parseNumberInput } from '../src/components/forms/NumberInput';
it('starts blank, groups thousands while editing and retains explicit zero and decimal precision', () => {
  function Example() {
    const [v, setV] = useState('');
    return <NumberInput aria-label="HPP" value={v} onValueChange={setV} decimal />;
  }
  render(<Example />);
  const field = screen.getByLabelText('HPP') as HTMLInputElement;
  expect(field.value).toBe('');
  expect(field.placeholder).toBe('0');
  fireEvent.change(field, { target: { value: '80000' } });
  expect(field.value).toBe('80.000');
  fireEvent.change(field, { target: { value: '80.000,123456' } });
  expect(field.value).toBe('80.000,123456');
  expect(parseNumberInput(field.value)).toBe('80000.123456');
  fireEvent.change(field, { target: { value: '' } });
  expect(field.value).toBe('');
  fireEvent.change(field, { target: { value: '0' } });
  expect(field.value).toBe('0');
  cleanup();
});
