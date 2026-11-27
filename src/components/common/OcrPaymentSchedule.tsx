import { useState } from 'react';
import type { CondicaoPagamento } from '../../types';
import { type ParcelaEditavel, paymentTermsFromDates, paymentTotal } from '../../utils/paymentSchedule';

interface Props {
  issueDate: string;
  referenceCents: number;
  rows: ParcelaEditavel[];
  conditions: CondicaoPagamento[];
  sourceTerms: number[];
  allowMultiple: boolean;
  differenceConfirmed: boolean;
  onConfirmDifference: (confirmed: boolean) => void;
  onChange: (rows: ParcelaEditavel[]) => void;
  onApplyCondition: (terms: number[]) => void;
}

const brl = (cents: number) => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const inputClass = 'mt-1 min-h-10 w-full rounded-lg border border-[#d3e4fe] bg-white px-2.5 py-1.5 text-sm text-[#0b1c30]';

export function OcrPaymentSchedule({
  issueDate, referenceCents, rows, conditions, sourceTerms, allowMultiple, differenceConfirmed,
  onConfirmDifference, onChange, onApplyCondition
}: Props) {
  const [conditionId, setConditionId] = useState('');
  const terms = paymentTermsFromDates(issueDate, rows);
  const key = terms.join('/');
  const condition = terms.length && conditions.find((item) => item.prazosDias.join('/') === key);
  const eligible = conditions.filter((item) => allowMultiple || item.prazosDias.length === 1);
  const selected = eligible.find((item) => item.id === conditionId);
  const total = paymentTotal(rows);
  const difference = total - referenceCents;
  const edit = (index: number, patch: Partial<ParcelaEditavel>) =>
    onChange(rows.map((row, rowIndex) => rowIndex === index ? { ...row, ...patch } : row));

  return (
    <section aria-label="Boletos e vencimentos" className="space-y-3 rounded-lg border border-[#d3e4fe] bg-[#f8faff] p-3">
      <div>
        <h4 className="text-sm font-bold text-[#0b1c30]">Boletos e vencimentos</h4>
        <p className="text-xs text-gray-600">
          {terms.length ? `Condição pelos vencimentos: ${condition ? `${condition.nome} · ` : ''}${key} dias após a emissão.` : 'Confira a emissão e informe os vencimentos para calcular a condição.'}
        </p>
      </div>
      {sourceTerms.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600">
          <span>Condição lida no documento: {sourceTerms.join('/')} dias.</span>
          <button type="button" onClick={() => onApplyCondition(sourceTerms)}
            className="min-h-8 rounded-md border border-[#d3e4fe] px-2 font-semibold text-[#0b1c30]">
            Usar condição lida
          </button>
        </div>
      )}
      {eligible.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-40 flex-1 text-xs font-semibold text-gray-700">
            Condição cadastrada
            <select value={conditionId} onChange={(event) => setConditionId(event.target.value)} className={inputClass}>
              <option value="">Selecione para recalcular</option>
              {eligible.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
            </select>
          </label>
          <button type="button" disabled={!selected} onClick={() => selected && onApplyCondition(selected.prazosDias)}
            className="min-h-10 rounded-lg border border-[#d3e4fe] bg-white px-3 text-xs font-bold text-[#0b1c30] disabled:opacity-50">
            Aplicar aos boletos
          </button>
        </div>
      )}
      <div className="space-y-2">
        {rows.map((row, index) => (
          <fieldset key={index} className="rounded-lg border border-[#e5eeff] bg-white px-2.5 pb-2.5">
            <legend className="px-1 text-xs font-bold text-[#0b1c30]">Boleto {index + 1}{row.numero ? ` · nº ${row.numero}` : ''}</legend>
            <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <label className="text-xs font-semibold text-gray-700">
                Vencimento
                <input type="date" value={row.dataVencimento} onChange={(event) => edit(index, { dataVencimento: event.target.value })} className={inputClass} />
              </label>
              <label className="text-xs font-semibold text-gray-700">
                Valor (R$)
                <input inputMode="decimal" value={row.valor} onChange={(event) => edit(index, { valor: event.target.value })} className={inputClass} />
              </label>
              {rows.length > 1 && (
                <button type="button" aria-label={`Remover boleto ${index + 1}`}
                  onClick={() => onChange(rows.filter((_, rowIndex) => index !== rowIndex))}
                  className="min-h-10 rounded-lg border border-rose-200 px-2 text-xs font-semibold text-rose-700">
                  Remover
                </button>
              )}
            </div>
            {row.linhaDigitavel && <p className="mt-2 break-all text-[10px] text-gray-600">Linha digitável {row.linhaDigitavel}</p>}
          </fieldset>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        {allowMultiple && (
          <button type="button" onClick={() => onChange([...rows, { dataVencimento: '', valor: '' }])}
            className="min-h-10 rounded-lg border border-[#d3e4fe] bg-white px-3 text-xs font-bold text-[#0b1c30]">
            Adicionar boleto
          </button>
        )}
        <strong>Total a lançar {brl(total)}</strong>
      </div>
      {referenceCents > 0 && total > 0 && difference !== 0 && (
        <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-950">
          <input type="checkbox" checked={differenceConfirmed} onChange={(event) => onConfirmDifference(event.target.checked)} className="mt-0.5" />
          <span>Os boletos somam {brl(Math.abs(difference))} {difference > 0 ? 'a mais' : 'a menos'} que o valor informado no documento. Confirmo o total a lançar.</span>
        </label>
      )}
    </section>
  );
}
