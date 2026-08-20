import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { DadosLiquidacao, Lancamento } from '../../types';

export interface ItemLiquidacao {
  titulo: string;
  contraparte: string;
  tipo: Lancamento['tipo'];
  valor: number;
  unidade: string;
}

interface LiquidacaoModalProps {
  item: ItemLiquidacao | null;
  onClose: () => void;
  onConfirm: (dados: DadosLiquidacao) => void;
}

const PAYMENT_METHODS: { value: Lancamento['formaPagamento']; label: string }[] = [
  { value: 'PIX', label: 'Pix' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CARNE', label: 'Carnê' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de débito' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'TRANSFERENCIA', label: 'Transferência bancária' }
];

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const LiquidacaoModal: React.FC<LiquidacaoModalProps> = ({ item, onClose, onConfirm }) => {
  const { bancos } = useApp();
  const [bancoId, setBancoId] = useState('');
  const [formaPagamento, setFormaPagamento] = useState<Lancamento['formaPagamento'] | ''>('');
  const [dataPagamento, setDataPagamento] = useState('');

  const availableBanks = useMemo(
    () => bancos.filter((banco) => banco.ativo && banco.unidade === item?.unidade),
    [bancos, item?.unidade]
  );
  const selectedBank = availableBanks.find((banco) => banco.id === bancoId);

  useEffect(() => {
    if (!item) return;
    setBancoId('');
    setFormaPagamento('');
    setDataPagamento(new Date().toISOString().substring(0, 10));
  }, [item]);

  if (!item) return null;

  const isReceipt = item.tipo === 'RECEITA';
  const projectedBalance = selectedBank
    ? selectedBank.saldo + (isReceipt ? item.valor : -item.valor)
    : 0;
  const canConfirm = Boolean(selectedBank && formaPagamento && dataPagamento);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canConfirm || !formaPagamento) return;
    onConfirm({ bancoId, formaPagamento, dataPagamento });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b1c30]/65 p-4" role="dialog" aria-modal="true">
      <form onSubmit={handleSubmit} className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#d3e4fe] bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#e5eeff] bg-[#f8f9ff] p-5">
          <div className="flex items-start gap-3">
            <span className={`material-symbols-outlined mt-0.5 ${isReceipt ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isReceipt ? 'payments' : 'account_balance_wallet'}
            </span>
            <div>
              <h2 className="text-base font-black text-[#0b1c30]">
                {isReceipt ? 'Confirmar recebimento' : 'Confirmar pagamento'}
              </h2>
              <p className="mt-0.5 text-[11px] text-gray-500">
                A conta selecionada terá seu saldo atualizado após a confirmação.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 transition hover:text-gray-700" title="Fechar">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className={`rounded-xl border p-4 ${isReceipt ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-xs font-black text-[#0b1c30]">{item.titulo}</p>
                <p className="mt-1 text-[10px] text-gray-600">{item.contraparte} · {item.unidade}</p>
              </div>
              <p className={`shrink-0 text-base font-black ${isReceipt ? 'text-emerald-800' : 'text-rose-800'}`}>
                {formatCurrency(item.valor)}
              </p>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold text-gray-700">
              {isReceipt ? 'Conta de destino *' : 'Conta utilizada no pagamento *'}
            </label>
            <select
              value={bancoId}
              onChange={(event) => setBancoId(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-xs font-semibold text-[#0b1c30] focus:border-[#C5A059] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20"
              required
            >
              <option value="">Selecione a conta...</option>
              {availableBanks.map((banco) => (
                <option key={banco.id} value={banco.id}>
                  {banco.banco} · Ag. {banco.agencia} · C/C {banco.conta} · Saldo {formatCurrency(banco.saldo)}
                </option>
              ))}
            </select>
            {availableBanks.length === 0 && (
              <p className="mt-1.5 text-[10px] font-bold text-rose-700">
                Nenhuma conta ativa foi cadastrada para {item.unidade}.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                {isReceipt ? 'Forma de recebimento *' : 'Forma de pagamento *'}
              </label>
              <select
                value={formaPagamento}
                onChange={(event) => setFormaPagamento(event.target.value as Lancamento['formaPagamento'] | '')}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-xs font-semibold text-[#0b1c30] focus:border-[#C5A059] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20"
                required
              >
                <option value="">Selecione...</option>
                {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-gray-700">
                {isReceipt ? 'Data do recebimento *' : 'Data do pagamento *'}
              </label>
              <input
                type="date"
                value={dataPagamento}
                onChange={(event) => setDataPagamento(event.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-xs font-semibold text-[#0b1c30] focus:border-[#C5A059] focus:outline-none focus:ring-2 focus:ring-[#C5A059]/20"
                required
              />
            </div>
          </div>

          {selectedBank && (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs">
              <div>
                <p className="text-[9px] font-bold uppercase text-blue-700">Saldo atual</p>
                <p className="mt-0.5 font-black text-[#0b1c30]">{formatCurrency(selectedBank.saldo)}</p>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase text-blue-700">Saldo após confirmação</p>
                <p className={`mt-0.5 font-black ${projectedBalance < 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
                  {formatCurrency(projectedBalance)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-[#e5eeff] bg-[#f8f9ff] px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={!canConfirm}
            className={`rounded-lg px-4 py-2 text-xs font-bold text-white transition disabled:cursor-not-allowed disabled:bg-gray-300 ${isReceipt ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-[#131b2e] hover:bg-[#0b1c30]'}`}
          >
            {isReceipt ? 'Confirmar recebimento' : 'Confirmar pagamento'}
          </button>
        </div>
      </form>
    </div>
  );
};
