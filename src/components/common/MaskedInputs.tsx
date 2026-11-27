import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { formatTaxId } from '../../utils/text';
import { formatCalendarInput, formatMoneyInput, readCalendarInput, readMoneyInput, type CalendarPrecision } from '../../utils/inputMasks';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'inputMode' | 'onChange' | 'value' | 'defaultValue'> & {
  value: string;
  onValueChange?: (value: string) => void;
};

function useDraft(value: string, format: (value: string) => string) {
  const [entry, setEntry] = useState({ value, draft: format(value) });
  if (value !== entry.value) {
    const replacement = { value, draft: format(value) };
    setEntry(replacement);
    return [replacement.draft, setEntry] as const;
  }
  return [entry.draft, setEntry] as const;
}

export function TaxIdInput({ value, onValueChange, cnpjOnly = false, ...input }: Props & { cnpjOnly?: boolean }) {
  const format = (raw: string) => formatTaxId(raw, cnpjOnly);
  return <input type="text" autoComplete="off" spellCheck={false}
    placeholder={cnpjOnly ? '00.000.000/0000-00' : 'CPF ou CNPJ'} {...input}
    value={format(value)} onChange={(event) => onValueChange?.(format(event.currentTarget.value))} />;
}

export function MoneyInput({ value, onValueChange, onBlur, style, min, max, containerClassName = '', ...input }: Props & {
  min?: number;
  max?: number;
  containerClassName?: string;
}) {
  const [draft, setDraft] = useDraft(value, formatMoneyInput);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const amount = Number(value);
    const invalid = draft && (!value || !Number.isFinite(amount) || (min !== undefined && amount < min)
      || (max !== undefined && amount > max));
    field.current?.setCustomValidity(invalid ? 'Informe um valor válido em reais.' : '');
  }, [draft, value, min, max]);

  return (
    <span className={`relative block min-w-0 ${containerClassName}`}>
      <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex w-9 items-center justify-center text-xs font-semibold text-slate-600">R$</span>
      <input {...input} ref={field} type="text" inputMode="decimal" spellCheck={false} placeholder="0,00"
        style={{ ...style, paddingInlineStart: '2.25rem' }} value={draft}
        onBlur={(event) => {
          setDraft({ value, draft: formatMoneyInput(value) });
          onBlur?.(event);
        }}
        onChange={(event) => {
          const raw = event.currentTarget.value;
          const inputType = (event.nativeEvent as InputEvent).inputType;
          const editingThousands = draft.includes('.') && draft.includes(',') &&
            (inputType === 'insertText' || inputType?.startsWith('delete')) &&
            (raw.includes(',') || inputType.startsWith('delete'));
          const next = readMoneyInput(editingThousands ? raw.replace(/\./g, '') : raw);
          if (!next) return;
          setDraft(next);
          onValueChange?.(next.value);
          const cursor = event.currentTarget.selectionStart;
          if (editingThousands && cursor !== null && next.draft !== raw) {
            const position = raw.slice(0, cursor).replace(/\./g, '').length;
            requestAnimationFrame(() => {
              const active = field.current;
              if (active === document.activeElement && active?.value === next.draft) {
                active.setSelectionRange(position, position);
              }
            });
          }
        }}
      />
    </span>
  );
}

export function CalendarInput({
  value, onValueChange, precision = 'day', min, max, className, style, disabled, readOnly, ...input
}: Props & { precision?: CalendarPrecision; min?: string; max?: string }) {
  const [draft, setDraft] = useDraft(value, (next) => formatCalendarInput(next, precision));
  const field = useRef<HTMLInputElement>(null);
  const format = precision === 'month' ? 'MM/AAAA' : 'DD/MM/AAAA';
  const parsed = readCalendarInput(draft, precision);
  const invalid = Boolean(draft && (!parsed || (min && parsed < min) || (max && parsed > max)));
  useEffect(() => {
    field.current?.setCustomValidity(invalid ? `Informe uma data válida no formato ${format}.` : '');
  }, [invalid, format]);

  const change = (raw: string) => {
    const draft = formatCalendarInput(raw, precision);
    const parsed = readCalendarInput(draft, precision);
    const value = parsed && (!min || parsed >= min) && (!max || parsed <= max) ? parsed : '';
    setDraft({ value, draft });
    onValueChange?.(value);
  };

  return (
    <span className="relative block min-w-0">
      <input {...input} ref={field} type="text" inputMode="numeric" placeholder={format} autoComplete="off"
        aria-invalid={invalid && draft.length === format.length ? true : undefined}
        className={`w-full ${className || ''}`} style={{ ...style, paddingInlineEnd: '2rem' }}
        value={draft} disabled={disabled} readOnly={readOnly} onChange={(event) => change(event.currentTarget.value)} />
      {!readOnly && (
        <span className="absolute inset-y-0 right-0 flex w-8 items-center justify-center rounded-r-lg text-slate-600 focus-within:ring-2 focus-within:ring-[#C5A059]">
          <span aria-hidden="true" className="material-symbols-outlined text-base">calendar_month</span>
          <input type={precision === 'month' ? 'month' : 'date'} min={min} max={max} value={value} disabled={disabled}
            aria-label={precision === 'month' ? 'Selecionar mês e ano' : 'Abrir calendário'}
            className="mask-calendar-picker absolute inset-0 h-full w-full cursor-pointer opacity-0"
            onClick={(event) => {
              try { event.currentTarget.showPicker?.(); } catch { /* O seletor mantém a interação nativa. */ }
            }}
            onChange={(event) => change(event.currentTarget.value)}
          />
        </span>
      )}
    </span>
  );
}
