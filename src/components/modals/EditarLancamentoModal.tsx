import { ModalOverlay } from '../common/ModalOverlay';
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { Lancamento } from '../../types';
import { normalizeDateValue } from '../../utils/dateRange';

interface Props {
  item: Lancamento | null;
  onClose: () => void;
}

const paymentOptions: Lancamento['formaPagamento'][] = [
  'PIX', 'BOLETO', 'CARNE', 'CARTAO_CREDITO', 'CARTAO_DEBITO', 'DINHEIRO', 'TRANSFERENCIA'
];

export const EditarLancamentoModal: React.FC<Props> = ({ item, onClose }) => {
  const { categorias, centrosCusto, bancos, updateLancamento, flushPersistence, showToast } = useApp();
  const [form, setForm] = useState({
    descricao: '', fornecedorCliente: '', categoria: '', centroCusto: '', valor: '',
    dataCompetencia: '', dataVencimento: '', formaPagamento: 'BOLETO' as Lancamento['formaPagamento'],
    bancoId: '', observacoes: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!item) return;
    setForm({
      descricao: item.descricao,
      fornecedorCliente: item.fornecedorCliente,
      categoria: item.categoria,
      centroCusto: item.centroCusto,
      valor: String(item.valor),
      dataCompetencia: normalizeDateValue(item.dataCompetencia || item.dataVencimento),
      dataVencimento: normalizeDateValue(item.dataVencimento),
      formaPagamento: item.formaPagamento,
      bancoId: item.bancoId || '',
      observacoes: item.observacoes || ''
    });
  }, [item]);

  const availableCategories = useMemo(() => categorias.filter(
    (category) => category.ativa && category.tipo === item?.tipo
  ), [categorias, item?.tipo]);
  const availableCenters = centrosCusto.filter((center) => center.ativo);
  const availableBanks = bancos.filter((bank) => bank.ativo && bank.unidade === item?.unidade);
  if (!item) return null;

  const set = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const fieldClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C5A059]';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Number(form.valor.replace(',', '.'));
    if (!form.descricao.trim() || !form.fornecedorCliente.trim() || !form.categoria || !form.centroCusto || !form.dataCompetencia || !form.dataVencimento || !Number.isFinite(value) || value <= 0) {
      showToast('Preencha descrição, contraparte, categoria, centro de custo, datas e um valor válido.', 'error');
      return;
    }
    if (item.status === 'PAGO' && !form.bancoId) {
      showToast('Lançamentos pagos precisam permanecer vinculados a uma conta bancária.', 'error');
      return;
    }
    setSaving(true);
    const changed = updateLancamento(item.id, {
      descricao: form.descricao.trim(), fornecedorCliente: form.fornecedorCliente.trim(),
      categoria: form.categoria, centroCusto: form.centroCusto, valor: value,
      dataCompetencia: form.dataCompetencia, dataVencimento: form.dataVencimento,
      formaPagamento: form.formaPagamento, bancoId: form.bancoId || undefined,
      contaBancaria: availableBanks.find((bank) => bank.id === form.bancoId)?.nome || item.contaBancaria,
      observacoes: form.observacoes.trim()
    });
    if (!changed) { setSaving(false); return; }
    const saved = await flushPersistence();
    setSaving(false);
    showToast(saved ? 'Transação editada e salva.' : 'A edição ficou pendente de confirmação.', saved ? 'success' : 'error');
    if (saved) onClose();
  };

  return (
    <ModalOverlay className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="p-5 border-b flex items-center justify-between">
          <div><h3 className="font-black text-[#0b1c30]">Editar {item.tipo === 'RECEITA' ? 'receita' : 'despesa'}</h3><p className="text-xs text-gray-500">A alteração fica registrada no histórico de auditoria.</p></div>
          <button type="button" onClick={onClose} className="text-gray-500"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs font-bold">Descrição<input className={fieldClass} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} /></label>
          <label className="text-xs font-bold">Fornecedor / Cliente<input className={fieldClass} value={form.fornecedorCliente} onChange={(e) => set('fornecedorCliente', e.target.value)} /></label>
          <label className="text-xs font-bold">Categoria<select className={fieldClass} value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>{availableCategories.map((category) => <option key={category.id} value={category.nome}>{category.nome}</option>)}</select></label>
          <label className="text-xs font-bold">Centro de custo<select className={fieldClass} value={form.centroCusto} onChange={(e) => set('centroCusto', e.target.value)}>{availableCenters.map((center) => <option key={center.id} value={center.nome}>{center.nome}</option>)}</select></label>
          <label className="text-xs font-bold">Valor (R$)<input className={fieldClass} inputMode="decimal" value={form.valor} onChange={(e) => set('valor', e.target.value)} /></label>
          <label className="text-xs font-bold">Forma de pagamento<select className={fieldClass} value={form.formaPagamento} onChange={(e) => set('formaPagamento', e.target.value)}>{paymentOptions.map((option) => <option key={option} value={option}>{option.replaceAll('_', ' ')}</option>)}</select></label>
          <label className="text-xs font-bold">Data de competência<input type="date" className={fieldClass} value={form.dataCompetencia} onChange={(e) => set('dataCompetencia', e.target.value)} /></label>
          <label className="text-xs font-bold">Data de vencimento<input type="date" className={fieldClass} value={form.dataVencimento} onChange={(e) => set('dataVencimento', e.target.value)} /></label>
          <label className="text-xs font-bold md:col-span-2">Conta bancária<select className={fieldClass} value={form.bancoId} onChange={(e) => set('bancoId', e.target.value)}><option value="">Sem conta vinculada</option>{availableBanks.map((bank) => <option key={bank.id} value={bank.id}>{bank.nome}</option>)}</select></label>
          <label className="text-xs font-bold md:col-span-2">Observações<textarea rows={3} className={fieldClass} value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} /></label>
        </div>
        <div className="p-5 border-t flex justify-end gap-2"><button type="button" onClick={onClose} className="px-4 py-2 text-sm font-bold text-gray-600">Cancelar</button><button disabled={saving} className="px-5 py-2 rounded-lg bg-[#131b2e] text-white text-sm font-bold disabled:opacity-50">{saving ? 'Salvando...' : 'Salvar alterações'}</button></div>
      </form>
    </ModalOverlay>
  );
};
