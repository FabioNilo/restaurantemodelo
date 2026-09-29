import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { formatDecimal, parseDecimal } from '@/lib/decimal';

interface DecimalInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  value: number;
  onValueChange: (value: number) => void;
}

// Aceita "4,50" e "4.50". Um <input type="number"> controlado não serve aqui:
// no Chrome em português o ponto não é separador decimal, o campo vira vazio
// no meio da digitação e "4.50" acabava gravado como 50.
export function DecimalInput({ value, onValueChange, onBlur, ...props }: DecimalInputProps) {
  const [text, setText] = useState(() => formatDecimal(value));

  // Valor trocado por fora (ex.: carregou outro produto): reflete no campo.
  useEffect(() => {
    setText((current) => (parseDecimal(current) === value ? current : formatDecimal(value)));
  }, [value]);

  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      placeholder={props.placeholder ?? '0,00'}
      value={text}
      onChange={(event) => {
        const next = event.target.value.replace(/[^\d.,]/g, '');
        setText(next);
        onValueChange(parseDecimal(next));
      }}
      onBlur={(event) => {
        setText(formatDecimal(parseDecimal(text)));
        onBlur?.(event);
      }}
    />
  );
}
