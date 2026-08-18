import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';
import { normalizeDateValue } from '../../utils/dateRange';
import { FinalidadeMovimentacaoCaixa } from '../../types';

type ModalType = 'SANGRIA' | 'SUPRIMENTO' | 'VENDA' | 'AJUSTE';

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const CaixaFisicoView: React.FC = () => {
  const {
    sessaoCaixa,
    registrarMovimentacaoCaixa,
    ajustarSaldoCaixa,
    addTransferencia,
    canExecuteFinancialActions,
    bancos,
    lancamentos,
    units,
    selectedUnit,
    currentUser,
    isAdmin,
    isFinance,
    showToast
  } = useApp();

  const unidadeInicial = isFinance && currentUser
    ? currentUser.unit
    : selectedUnit !== 'Todas as Unidades'
      ? selectedUnit
      : units.find((unit) => unit.ativa)?.nome || '';
  const [unidadeCaixa, setUnidadeCaixa] = useState(unidadeInicial);
  const [modalType, setModalType] = useState<ModalType | null>(null);
  const [valorInput, setValorInput] = useState('');
  const [descricaoInput, setDescricaoInput] = useState('');
  const [finalidade, setFinalidade] = useState<FinalidadeMovimentacaoCaixa>('OUTRO');
  const [bancoTransferenciaId, setBancoTransferenciaId] = useState('');
  const [lancamentoRelacionadoId, setLancamentoRelacionadoId] = useState('');
  const [anexo, setAnexo] = useState<File | null>(null);

  useEffect(() => {
    if (isFinance && currentUser) {
      setUnidadeCaixa(currentUser.unit);
    } else if (selectedUnit !== 'Todas as Unidades') {
      setUnidadeCaixa(selectedUnit);
    }
  }, [currentUser, isFinance, selectedUnit]);

  const contasUnidade = bancos.filter((banco) => banco.ativo && banco.unidade === unidadeCaixa);
  const contaCaixa = contasUnidade.find((banco) => banco.banco.toLowerCase().includes('caixa'));
  const contasBancarias = contasUnidade.filter((banco) => banco.id !== contaCaixa?.id);
  const despesasPendentes = lancamentos.filter(
    (item) =>
      item.unidade === unidadeCaixa &&
      item.tipo === 'DESPESA' &&
      item.status !== 'PAGO' &&
      item.status !== 'CANCELADO'
  );
  const movimentacoesDaUnidade = useMemo(
    () => sessaoCaixa.movimentacoes.filter((movimento) => movimento.unidade === unidadeCaixa),
    [sessaoCaixa.movimentacoes, unidadeCaixa]
  );
  const totalEntradas = movimentacoesDaUnidade
    .filter((movimento) => movimento.sentido === 'ENTRADA')
    .reduce((total, movimento) => total + movimento.valor, 0);
  const totalSaidas = movimentacoesDaUnidade
    .filter((movimento) => movimento.sentido === 'SAIDA')
    .reduce((total, movimento) => total + movimento.valor, 0);
  const ultimaMovimentacao = [...movimentacoesDaUnidade].sort((a, b) => b.dataHora.localeCompare(a.dataHora))[0];
  const { sortedItems: sortedMovimentacoes, sortConfig, requestSort } = useSortableData(movimentacoesDaUnidade);

  const readAttachment = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler o anexo.'));
    reader.readAsDataURL(file);
  });

  const resetModal = () => {
    setModalType(null);
    setValorInput('');
    setDescricaoInput('');
    setFinalidade('OUTRO');
    setBancoTransferenciaId('');
    setLancamentoRelacionadoId('');
    setAnexo(null);
  };

  const openModal = (tipo: ModalType) => {
    setModalType(tipo);
    setBancoTransferenciaId('');
    setLancamentoRelacionadoId('');
    setAnexo(null);
    if (tipo === 'SANGRIA') {
      setDescricaoInput('Sangria para depósito bancário');
      setFinalidade('DEPOSITO_BANCARIO');
    } else if (tipo === 'SUPRIMENTO') {
      setDescricaoInput('Reforço do caixa físico');
      setFinalidade('REFORCO_TROCO');
    } else if (tipo === 'VENDA') {
      setDescricaoInput('Venda recebida em dinheiro');
      setFinalidade('VENDA_DINHEIRO');
    } else {
      setValorInput(contaCaixa?.saldo.toFixed(2) || '0.00');
      setDescricaoInput('');
      setFinalidade('AJUSTE_SALDO');
    }
  };

  const handleActionSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!modalType || !contaCaixa) return;

    const valor = Number(valorInput);
    if (!Number.isFinite(valor) || (modalType === 'AJUSTE' ? valor < 0 : valor <= 0)) {
      showToast(modalType === 'AJUSTE' ? 'O novo saldo deve ser zero ou maior.' : 'Informe um valor maior que zero.', 'error');
      return;
    }
    if (modalType === 'SANGRIA' && valor > contaCaixa.saldo) {
      showToast(`A saída não pode superar o saldo disponível de ${formatCurrency(contaCaixa.saldo)}.`, 'error');
      return;
    }
    if (!descricaoInput.trim()) {
      showToast(modalType === 'AJUSTE' ? 'Informe o motivo do ajuste.' : 'Informe a descrição da movimentação.', 'error');
      return;
    }

    let comprovanteUrl: string | undefined;
    if (anexo) {
      try {
        comprovanteUrl = await readAttachment(anexo);
      } catch {
        showToast('Não foi possível ler o anexo selecionado.', 'error');
        return;
      }
    }

    if (modalType === 'AJUSTE') {
      ajustarSaldoCaixa({ unidade: unidadeCaixa, novoSaldo: valor, motivo: descricaoInput, comprovanteRef: comprovanteUrl });
      resetModal();
      return;
    }

    if (modalType === 'SANGRIA' && finalidade === 'DEPOSITO_BANCARIO') {
      if (!bancoTransferenciaId) {
        showToast('Selecione a conta bancária que receberá o depósito.', 'error');
        return;
      }
      addTransferencia({
        origemBancoId: contaCaixa.id,
        destinoBancoId: bancoTransferenciaId,
        valor,
        data: new Date().toISOString().substring(0, 10),
        descricao: descricaoInput,
        unidade: unidadeCaixa,
        comprovanteUrl,
        documentoRef: comprovanteUrl
      });
    } else if (modalType === 'SUPRIMENTO' && bancoTransferenciaId) {
      addTransferencia({
        origemBancoId: bancoTransferenciaId,
        destinoBancoId: contaCaixa.id,
        valor,
        data: new Date().toISOString().substring(0, 10),
        descricao: descricaoInput,
        unidade: unidadeCaixa,
        comprovanteUrl,
        documentoRef: comprovanteUrl
      });
    } else {
      if (modalType === 'SANGRIA' && finalidade === 'PAGAMENTO_DESPESA') {
        const despesa = despesasPendentes.find((item) => item.id === lancamentoRelacionadoId);
        if (!despesa) {
          showToast('Selecione a despesa que será liquidada em dinheiro.', 'error');
          return;
        }
        if (Math.abs(despesa.valor - valor) > 0.01) {
          showToast('O valor deve ser igual ao da despesa selecionada. Pagamentos parciais ainda não são suportados.', 'error');
          return;
        }
      }
      registrarMovimentacaoCaixa(modalType, descricaoInput, valor, comprovanteUrl, {
        unidade: unidadeCaixa,
        finalidade: modalType === 'VENDA' ? 'VENDA_DINHEIRO' : finalidade,
        impactoDRE: modalType === 'VENDA' ? 'RECEITA' : 'NAO_AFETA',
        statusConciliacao: finalidade === 'OUTRO' ? 'PENDENTE' : 'CONCILIADO',
        bancoOrigemId: modalType === 'SANGRIA' ? contaCaixa.id : bancoTransferenciaId || undefined,
        bancoDestinoId: modalType === 'SUPRIMENTO' ? contaCaixa.id : bancoTransferenciaId || undefined,
        lancamentoRelacionadoId: lancamentoRelacionadoId || undefined,
        observacoes: descricaoInput
      });
    }

    resetModal();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">Saldo contínuo</span>
            <span className="text-xs text-gray-500">Sem abertura ou fechamento diário</span>
          </div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]">point_of_sale</span>
            Caixa Físico por Unidade
          </h2>
          <p className="text-xs text-gray-500 mt-1">Entradas somam e saídas subtraem do saldo atual. Sangrias não alteram o DRE por si só.</p>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          {!isFinance && selectedUnit === 'Todas as Unidades' && (
            <div>
              <label className="block text-[10px] font-semibold text-gray-600 mb-1">Unidade do caixa</label>
              <select value={unidadeCaixa} onChange={(event) => setUnidadeCaixa(event.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-xs bg-white">
                {units.filter((unit) => unit.ativa).map((unit) => <option key={unit.id} value={unit.nome}>{unit.nome}</option>)}
              </select>
            </div>
          )}
          {canExecuteFinancialActions && contaCaixa && (
            <>
              <button onClick={() => openModal('SANGRIA')} className="px-3 py-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-bold hover:bg-rose-100">Sangria / Saída (−)</button>
              <button onClick={() => openModal('SUPRIMENTO')} className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold hover:bg-emerald-100">Suprimento (+)</button>
              <button onClick={() => openModal('VENDA')} className="px-3 py-2 bg-blue-50 border border-blue-200 text-blue-800 rounded-lg text-xs font-bold hover:bg-blue-100">Venda em dinheiro (+)</button>
              {isAdmin && <button onClick={() => openModal('AJUSTE')} className="px-3 py-2 bg-[#131b2e] text-white rounded-lg text-xs font-bold hover:bg-[#0b1c30]">Ajustar saldo</button>}
            </>
          )}
        </div>
      </div>

      {!contaCaixa ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900">
          <strong>Nenhum Caixa Físico ativo para {unidadeCaixa || 'a unidade selecionada'}.</strong>
          <p className="text-xs mt-1">Um administrador deve cadastrar uma conta cujo nome contenha “Caixa” e vinculá-la à unidade.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-[#eff4ff] p-4 rounded-xl border border-[#d3e4fe]">
            <p className="text-[10px] font-bold text-[#131b2e] uppercase">Saldo disponível agora</p>
            <p className="text-xl font-black text-[#0b1c30] mt-0.5">{formatCurrency(contaCaixa.saldo)}</p>
            <p className="text-[10px] text-gray-500 mt-1">{contaCaixa.banco} · {unidadeCaixa}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#e5eeff]">
            <p className="text-[10px] font-bold text-emerald-600 uppercase">Entradas registradas</p>
            <p className="text-xl font-extrabold text-emerald-700 mt-0.5">{formatCurrency(totalEntradas)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#e5eeff]">
            <p className="text-[10px] font-bold text-rose-600 uppercase">Saídas registradas</p>
            <p className="text-xl font-extrabold text-rose-700 mt-0.5">{formatCurrency(totalSaidas)}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-[#e5eeff]">
            <p className="text-[10px] font-bold text-gray-500 uppercase">Última movimentação</p>
            <p className="text-sm font-extrabold text-[#0b1c30] mt-1">{ultimaMovimentacao?.tipo || 'Sem movimentações'}</p>
            <p className="text-[10px] text-gray-500 mt-1">{ultimaMovimentacao?.dataHora || '—'}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff] flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">Histórico contínuo do Caixa Físico</h3>
            <p className="text-[10px] text-gray-500 mt-0.5">{unidadeCaixa}</p>
          </div>
          <span className="text-xs text-gray-500">{movimentacoesDaUnidade.length} movimentação(ões)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <SortableTableHeader label="Data / Hora" sortKey="data" accessor={(item) => normalizeDateValue(item.dataHora) || item.dataHora} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Operação" sortKey="operacao" accessor={(item) => item.tipo} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Descrição / Histórico" sortKey="descricao" accessor={(item) => item.descricao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Finalidade" sortKey="finalidade" accessor={(item) => item.finalidade || ''} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Operador" sortKey="operador" accessor={(item) => item.usuario} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Movimento" sortKey="valor" accessor={(item) => item.sentido === 'ENTRADA' ? item.valor : -item.valor} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                <SortableTableHeader label="Saldo após" sortKey="saldo" accessor={(item) => item.saldoApos ?? 0} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedMovimentacoes.map((movimento) => {
                const isEntrada = movimento.sentido === 'ENTRADA';
                return (
                  <tr key={movimento.id} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-mono text-gray-500">{movimento.dataHora}</td>
                    <td className="p-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isEntrada ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{movimento.tipo}</span></td>
                    <td className="p-3 font-medium text-[#0b1c30]">
                      {movimento.descricao}
                      {movimento.comprovanteRef?.startsWith('data:') && <a href={movimento.comprovanteRef} target="_blank" rel="noreferrer" className="block mt-1 text-[10px] text-blue-700 hover:underline">Abrir anexo</a>}
                    </td>
                    <td className="p-3 text-[10px] font-semibold text-gray-700">{(movimento.finalidade || 'OUTRO').replaceAll('_', ' ')}</td>
                    <td className="p-3 text-gray-600">{movimento.usuario}</td>
                    <td className={`p-3 text-right font-black ${isEntrada ? 'text-emerald-700' : 'text-rose-700'}`}>{isEntrada ? '+' : '−'} {formatCurrency(movimento.valor)}</td>
                    <td className="p-3 text-right font-black text-[#0b1c30]">{movimento.saldoApos === undefined ? '—' : formatCurrency(movimento.saldoApos)}</td>
                  </tr>
                );
              })}
              {sortedMovimentacoes.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-gray-500">Nenhuma movimentação registrada para esta unidade.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {canExecuteFinancialActions && modalType && contaCaixa && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-[#0b1c30] text-white px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">{modalType === 'AJUSTE' ? 'Ajuste manual auditável' : `Movimentação de ${modalType}`}</h3>
                <p className="text-[10px] text-slate-300 mt-0.5">{unidadeCaixa} · Saldo atual {formatCurrency(contaCaixa.saldo)}</p>
              </div>
              <button onClick={resetModal} className="text-gray-400 hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleActionSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{modalType === 'AJUSTE' ? 'Novo saldo contado (R$)' : 'Valor (R$)'}</label>
                <input type="number" min="0" step="0.01" required value={valorInput} onChange={(event) => setValorInput(event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#131b2e]" />
              </div>

              {(modalType === 'SANGRIA' || modalType === 'SUPRIMENTO') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Finalidade da movimentação *</label>
                  <select value={finalidade} onChange={(event) => { setFinalidade(event.target.value as FinalidadeMovimentacaoCaixa); setBancoTransferenciaId(''); setLancamentoRelacionadoId(''); }} className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs bg-white">
                    {modalType === 'SANGRIA' ? (
                      <><option value="DEPOSITO_BANCARIO">Depósito em conta bancária</option><option value="TRANSFERENCIA_COFRE">Transferência para cofre</option><option value="PAGAMENTO_DESPESA">Pagamento de despesa em dinheiro</option><option value="RETIRADA_SOCIO">Retirada de sócio</option><option value="OUTRO">Outra finalidade</option></>
                    ) : (
                      <><option value="REFORCO_TROCO">Reforço do caixa</option><option value="TRANSFERENCIA_COFRE">Retirada do cofre para o caixa</option><option value="OUTRO">Outra origem</option></>
                    )}
                  </select>
                  <p className="text-[10px] text-gray-500 mt-1">Sangria e suprimento movimentam o saldo, mas não geram receita ou despesa no DRE.</p>
                </div>
              )}

              {((modalType === 'SANGRIA' && finalidade === 'DEPOSITO_BANCARIO') || modalType === 'SUPRIMENTO') && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">{modalType === 'SANGRIA' ? 'Conta bancária de destino *' : 'Conta bancária de origem (opcional)'}</label>
                  <select required={modalType === 'SANGRIA'} value={bancoTransferenciaId} onChange={(event) => setBancoTransferenciaId(event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs bg-white">
                    <option value="">{modalType === 'SUPRIMENTO' ? 'Origem externa / não bancária' : 'Selecione a conta...'}</option>
                    {contasBancarias.map((banco) => <option key={banco.id} value={banco.id}>{banco.banco} · {formatCurrency(banco.saldo)}</option>)}
                  </select>
                </div>
              )}

              {modalType === 'SANGRIA' && finalidade === 'PAGAMENTO_DESPESA' && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Despesa que será paga *</label>
                  <select required value={lancamentoRelacionadoId} onChange={(event) => { const id = event.target.value; setLancamentoRelacionadoId(id); const despesa = despesasPendentes.find((item) => item.id === id); if (despesa) { setValorInput(despesa.valor.toFixed(2)); setDescricaoInput(`Pagamento em dinheiro: ${despesa.descricao}`); } }} className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs bg-white">
                    <option value="">Selecione a despesa pendente...</option>
                    {despesasPendentes.map((despesa) => <option key={despesa.id} value={despesa.id}>{despesa.fornecedorCliente} — {formatCurrency(despesa.valor)} — {despesa.dataVencimento}</option>)}
                  </select>
                  <p className="text-[10px] text-gray-500 mt-1">A despesa existente será liquidada, sem duplicação no DRE.</p>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">{modalType === 'AJUSTE' ? 'Motivo obrigatório do ajuste' : 'Descrição / histórico'}</label>
                <input type="text" required value={descricaoInput} onChange={(event) => setDescricaoInput(event.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs" />
                {modalType === 'AJUSTE' && <p className="text-[10px] text-amber-700 mt-1">A diferença será registrada na auditoria e não afetará o DRE.</p>}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Anexo comprobatório (opcional)</label>
                <input type="file" accept="application/pdf,image/jpeg" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && !['application/pdf', 'image/jpeg'].includes(file.type)) { showToast('Envie um arquivo PDF, JPG ou JPEG.', 'error'); event.currentTarget.value = ''; setAnexo(null); return; } if (file && file.size > 10 * 1024 * 1024) { showToast('O anexo deve ter no máximo 10 MB.', 'error'); event.currentTarget.value = ''; setAnexo(null); return; } setAnexo(file); }} className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs bg-white file:mr-3 file:border-0 file:bg-[#eff4ff] file:px-2 file:py-1 file:text-[10px] file:font-bold" />
                <p className="text-[10px] text-gray-500 mt-1">Aceita PDF, JPG ou JPEG, até 10 MB.</p>
              </div>

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button type="button" onClick={resetModal} className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button type="submit" className="px-5 py-2 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30]">Confirmar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
