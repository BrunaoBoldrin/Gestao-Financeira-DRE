import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';
import { normalizeDateValue } from '../../utils/dateRange';
import { FinalidadeMovimentacaoCaixa } from '../../types';

export const CaixaFisicoView: React.FC = () => {
  const {
    sessaoCaixa,
    abrirCaixa,
    registrarMovimentacaoCaixa,
    fecharCaixa,
    addTransferencia,
    canExecuteFinancialActions,
    bancos,
    lancamentos,
    selectedUnit,
    currentUser,
    isFinance,
    showToast
  } = useApp();

  const [modalType, setModalType] = useState<'ABERTURA' | 'SANGRIA' | 'SUPRIMENTO' | 'VENDA' | 'FECHAMENTO' | null>(null);
  const [valorInput, setValorInput] = useState('');
  const [descricaoInput, setDescricaoInput] = useState('');
  const [observacaoFechamento, setObservacaoFechamento] = useState('');
  const [finalidade, setFinalidade] = useState<FinalidadeMovimentacaoCaixa>('OUTRO');
  const [bancoTransferenciaId, setBancoTransferenciaId] = useState('');
  const [lancamentoRelacionadoId, setLancamentoRelacionadoId] = useState('');
  const [anexo, setAnexo] = useState<File | null>(null);
  const { sortedItems: sortedMovimentacoes, sortConfig, requestSort } = useSortableData(sessaoCaixa.movimentacoes);

  const unidadeAtual = isFinance && currentUser
    ? currentUser.unit
    : selectedUnit === 'Todas as Unidades'
      ? 'Royal Face - Matriz'
      : selectedUnit;
  const contasUnidade = bancos.filter((banco) => banco.ativo && banco.unidade === unidadeAtual);
  const contaCaixa = contasUnidade.find((banco) => banco.banco.toLowerCase().includes('caixa'));
  const contasBancarias = contasUnidade.filter((banco) => banco.id !== contaCaixa?.id);
  const despesasPendentes = lancamentos.filter(
    (item) => item.unidade === unidadeAtual && item.tipo === 'DESPESA' && item.status !== 'PAGO' && item.status !== 'CANCELADO'
  );

  const readAttachment = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler o anexo.'));
    reader.readAsDataURL(file);
  });

  const handleActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalType) return;

    const val = parseFloat(valorInput);
    if (!Number.isFinite(val) || val <= 0) {
      showToast('Informe um valor maior que zero.', 'error');
      return;
    }
    if (modalType === 'SANGRIA' && val > sessaoCaixa.saldoEsperado) {
      showToast('A sangria não pode superar o saldo esperado em gaveta.', 'error');
      return;
    }

    let comprovanteUrl: string | undefined;
    if (anexo) {
      try {
        comprovanteUrl = await readAttachment(anexo);
      } catch {
        showToast('Não foi possível ler o comprovante selecionado.', 'error');
        return;
      }
    }

    if (modalType === 'ABERTURA') {
      abrirCaixa(val);
    } else if (modalType === 'SANGRIA' || modalType === 'SUPRIMENTO' || modalType === 'VENDA') {
      if (modalType === 'SANGRIA' && finalidade === 'DEPOSITO_BANCARIO') {
        if (!contaCaixa || !bancoTransferenciaId) {
          showToast('Selecione a conta bancária que receberá o depósito da sangria.', 'error');
          return;
        }
        addTransferencia({
          origemBancoId: contaCaixa.id,
          destinoBancoId: bancoTransferenciaId,
          valor: val,
          data: new Date().toISOString().substring(0, 10),
          descricao: descricaoInput || 'Sangria para depósito bancário',
          unidade: unidadeAtual,
          comprovanteUrl,
          documentoRef: anexo?.name
        });
      } else if (modalType === 'SUPRIMENTO' && bancoTransferenciaId) {
        if (!contaCaixa) {
          showToast('Cadastre uma conta do tipo Caixa Físico para esta unidade.', 'error');
          return;
        }
        addTransferencia({
          origemBancoId: bancoTransferenciaId,
          destinoBancoId: contaCaixa.id,
          valor: val,
          data: new Date().toISOString().substring(0, 10),
          descricao: descricaoInput || 'Suprimento de caixa',
          unidade: unidadeAtual,
          comprovanteUrl,
          documentoRef: anexo?.name
        });
      } else {
        if (modalType === 'SANGRIA' && finalidade === 'PAGAMENTO_DESPESA' && !lancamentoRelacionadoId) {
          showToast('Selecione a despesa que será liquidada pela sangria.', 'error');
          return;
        }
        if (modalType === 'SANGRIA' && finalidade === 'PAGAMENTO_DESPESA') {
          const despesa = despesasPendentes.find((item) => item.id === lancamentoRelacionadoId);
          if (!despesa || Math.abs(despesa.valor - val) > 0.01) {
            showToast('O valor deve ser igual ao da despesa selecionada. Pagamentos parciais ainda não são suportados.', 'error');
            return;
          }
        }
        const impactoDRE = modalType === 'VENDA' ? 'RECEITA' as const : 'NAO_AFETA' as const;
        const statusConciliacao = finalidade === 'OUTRO' ? 'PENDENTE' as const : 'CONCILIADO' as const;
        registrarMovimentacaoCaixa(
          modalType,
          descricaoInput || modalType,
          val,
          comprovanteUrl || anexo?.name,
          {
            finalidade: modalType === 'VENDA' ? 'VENDA_DINHEIRO' : finalidade,
            impactoDRE,
            statusConciliacao,
            bancoOrigemId: modalType === 'SANGRIA' ? contaCaixa?.id : bancoTransferenciaId || undefined,
            bancoDestinoId: modalType === 'SUPRIMENTO' ? contaCaixa?.id : bancoTransferenciaId || undefined,
            lancamentoRelacionadoId: lancamentoRelacionadoId || undefined,
            observacoes: descricaoInput
          }
        );
      }
    } else if (modalType === 'FECHAMENTO') {
      fecharCaixa(val, observacaoFechamento);
    }

    setModalType(null);
    setValorInput('');
    setDescricaoInput('');
    setObservacaoFechamento('');
    setFinalidade('OUTRO');
    setBancoTransferenciaId('');
    setLancamentoRelacionadoId('');
    setAnexo(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                sessaoCaixa.status === 'ABERTO' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-800'
              }`}
            >
              Status: {sessaoCaixa.status}
            </span>
            <span className="text-xs text-gray-500">• Operador: {sessaoCaixa.operadorAbertura}</span>
          </div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]">point_of_sale</span>
            Controle Diário de Caixa Físico (Recepção)
          </h2>
        </div>

        {canExecuteFinancialActions && (sessaoCaixa.status === 'ABERTO' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setModalType('SANGRIA');
                setDescricaoInput('Sangria de Caixa / Depósito');
                setFinalidade('DEPOSITO_BANCARIO');
                setBancoTransferenciaId('');
                setLancamentoRelacionadoId('');
              }}
              className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-md text-xs font-bold hover:bg-rose-100 transition"
            >
              Sangria (-)
            </button>
            <button
              onClick={() => {
                setModalType('SUPRIMENTO');
                setDescricaoInput('Reforço de Troco');
                setFinalidade('REFORCO_TROCO');
                setBancoTransferenciaId('');
                setLancamentoRelacionadoId('');
              }}
              className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs font-bold hover:bg-emerald-100 transition"
            >
              Reforço (+)
            </button>
            <button
              onClick={() => {
                setModalType('VENDA');
                setDescricaoInput('Venda Dinheiro Dermocosméticos');
              }}
              className="px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-800 rounded-md text-xs font-bold hover:bg-blue-100 transition"
            >
              Venda Dinheiro (+)
            </button>

            <button
              onClick={() => setModalType('FECHAMENTO')}
              className="px-4 py-2 bg-[#131b2e] text-white rounded-lg text-xs font-bold hover:bg-[#0b1c30] transition shadow-xs"
            >
              Fechar Caixa do Dia
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setModalType('ABERTURA');
              setValorInput('500');
            }}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
          >
            Abrir Caixa Diário
          </button>
        ))}
      </div>

      {/* KPI Financial Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-[#e5eeff]">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Fundo Inicial Troco</p>
          <p className="text-xl font-extrabold text-[#0b1c30] mt-0.5">
            R$ {sessaoCaixa.saldoInicial.toFixed(2)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#e5eeff]">
          <p className="text-[10px] font-bold text-emerald-600 uppercase">Entradas Dinheiro (+)</p>
          <p className="text-xl font-extrabold text-emerald-700 mt-0.5">
            R$ {sessaoCaixa.entradasDinheiro.toFixed(2)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-[#e5eeff]">
          <p className="text-[10px] font-bold text-rose-600 uppercase">Saídas / Sangrias (-)</p>
          <p className="text-xl font-extrabold text-rose-700 mt-0.5">
            R$ {sessaoCaixa.saidasDinheiro.toFixed(2)}
          </p>
        </div>

        <div className="bg-[#eff4ff] p-4 rounded-xl border border-[#d3e4fe]">
          <p className="text-[10px] font-bold text-[#131b2e] uppercase">Saldo Esperado em Gaveta</p>
          <p className="text-xl font-black text-[#0b1c30] mt-0.5">
            R$ {sessaoCaixa.saldoEsperado.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Closed Session Audit Result if Fechado */}
      {sessaoCaixa.status === 'FECHADO' && sessaoCaixa.saldoContado !== undefined && (
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs space-y-2">
          <h3 className="text-sm font-bold text-[#0b1c30]">Resultado do Fechamento de Caixa</h3>
          <div className="grid grid-cols-3 gap-4 text-xs pt-2">
            <div>
              <span className="text-gray-500">Saldo Esperado:</span>
              <p className="font-bold text-[#0b1c30]">R$ {sessaoCaixa.saldoEsperado.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-gray-500">Saldo Contado Fisicamente:</span>
              <p className="font-bold text-[#0b1c30]">R$ {sessaoCaixa.saldoContado.toFixed(2)}</p>
            </div>
            <div>
              <span className="text-gray-500">Divergência / Sobra (Falta):</span>
              <p
                className={`font-black ${
                  (sessaoCaixa.divergencia || 0) === 0
                    ? 'text-emerald-600'
                    : (sessaoCaixa.divergencia || 0) > 0
                    ? 'text-blue-600'
                    : 'text-rose-600'
                }`}
              >
                R$ {(sessaoCaixa.divergencia || 0).toFixed(2)}
              </p>
            </div>
          </div>
          {sessaoCaixa.observacaoFechamento && (
            <p className="text-xs text-gray-600 italic bg-gray-50 p-2 rounded">
              Obs: {sessaoCaixa.observacaoFechamento}
            </p>
          )}
        </div>
      )}

      {/* Movements History Table */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff] flex items-center justify-between">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Movimentações do Caixa do Dia
          </h3>
          <span className="text-xs text-gray-500">{sessaoCaixa.movimentacoes.length} Lançamentos</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <SortableTableHeader label="Data / Hora" sortKey="data" accessor={(item) => normalizeDateValue(item.dataHora) || item.dataHora} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Operação" sortKey="operacao" accessor={(item) => item.tipo} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Descrição / Histórico" sortKey="descricao" accessor={(item) => item.descricao} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Finalidade" sortKey="finalidade" accessor={(item) => item.finalidade || ''} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Conciliação" sortKey="conciliacao" accessor={(item) => item.statusConciliacao || ''} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Operador" sortKey="operador" accessor={(item) => item.usuario} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Valor (R$)" sortKey="valor" accessor={(item) => item.valor} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedMovimentacoes.map((mov) => {
                const isEntrada = mov.tipo === 'SUPRIMENTO' || mov.tipo === 'VENDA';
                return (
                  <tr key={mov.id} className="hover:bg-gray-50 transition">
                    <td className="p-3 font-mono text-gray-500">{mov.dataHora}</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isEntrada ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {mov.tipo}
                      </span>
                    </td>
                    <td className="p-3 font-medium text-[#0b1c30]">
                      {mov.descricao}
                      {mov.comprovanteRef && mov.comprovanteRef.startsWith('data:') && (
                        <a href={mov.comprovanteRef} target="_blank" rel="noreferrer" className="block mt-1 text-[10px] text-blue-700 hover:underline">
                          Abrir anexo
                        </a>
                      )}
                    </td>
                    <td className="p-3 text-[10px] font-semibold text-gray-700">{(mov.finalidade || 'OUTRO').replaceAll('_', ' ')}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                        mov.statusConciliacao === 'CONCILIADO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : mov.statusConciliacao === 'EM_TRANSITO'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-gray-100 text-gray-700'
                      }`}>
                        {mov.statusConciliacao || 'PENDENTE'}
                      </span>
                    </td>
                    <td className="p-3 text-gray-600">{mov.usuario}</td>
                    <td
                      className={`p-3 text-right font-black ${
                        isEntrada ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {isEntrada ? '+' : '-'} R$ {mov.valor.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Dialog for Actions */}
      {canExecuteFinancialActions && modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-[#0b1c30] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {modalType === 'ABERTURA'
                  ? 'Abertura de Caixa Diário'
                  : modalType === 'FECHAMENTO'
                  ? 'Fechamento & Contagem Física'
                  : `Movimentação de ${modalType}`}
              </h3>
              <button onClick={() => setModalType(null)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleActionSubmit} className="p-6 space-y-4">
              {modalType !== 'FECHAMENTO' ? (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {modalType === 'ABERTURA' ? 'Valor Fundo de Troco (R$)' : 'Valor (R$)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="0,00"
                      value={valorInput}
                      onChange={(e) => setValorInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                    />
                  </div>

                  {modalType !== 'ABERTURA' && (
                    <>
                      {(modalType === 'SANGRIA' || modalType === 'SUPRIMENTO') && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Finalidade da movimentação *</label>
                          <select
                            required
                            value={finalidade}
                            onChange={(e) => {
                              setFinalidade(e.target.value as FinalidadeMovimentacaoCaixa);
                              setBancoTransferenciaId('');
                              setLancamentoRelacionadoId('');
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs bg-white focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                          >
                            {modalType === 'SANGRIA' ? (
                              <>
                                <option value="DEPOSITO_BANCARIO">Depósito em conta bancária</option>
                                <option value="TRANSFERENCIA_COFRE">Transferência para cofre</option>
                                <option value="PAGAMENTO_DESPESA">Pagamento de despesa em dinheiro</option>
                                <option value="RETIRADA_SOCIO">Retirada de sócio</option>
                                <option value="OUTRO">Outra finalidade</option>
                              </>
                            ) : (
                              <>
                                <option value="REFORCO_TROCO">Reforço de troco</option>
                                <option value="TRANSFERENCIA_COFRE">Retirada do cofre para o caixa</option>
                                <option value="OUTRO">Outra origem</option>
                              </>
                            )}
                          </select>
                          <p className="text-[10px] text-gray-500 mt-1">
                            Sangria e suprimento não alteram o DRE por si só; despesas e receitas são vinculadas ao lançamento correspondente.
                          </p>
                        </div>
                      )}

                      {((modalType === 'SANGRIA' && finalidade === 'DEPOSITO_BANCARIO') || modalType === 'SUPRIMENTO') && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">
                            {modalType === 'SANGRIA' ? 'Conta bancária de destino *' : 'Conta bancária de origem (opcional)'}
                          </label>
                          <select
                            required={modalType === 'SANGRIA'}
                            value={bancoTransferenciaId}
                            onChange={(e) => setBancoTransferenciaId(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs bg-white focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                          >
                            <option value="">{modalType === 'SUPRIMENTO' ? 'Origem externa / não bancária' : 'Selecione a conta...'}</option>
                            {contasBancarias.map((banco) => (
                              <option key={banco.id} value={banco.id}>{banco.banco}</option>
                            ))}
                          </select>
                          {modalType === 'SANGRIA' && contasBancarias.length === 0 && (
                            <p className="text-[10px] text-rose-600 mt-1">Cadastre uma conta bancária ativa para esta unidade.</p>
                          )}
                        </div>
                      )}

                      {modalType === 'SANGRIA' && finalidade === 'PAGAMENTO_DESPESA' && (
                        <div>
                          <label className="block text-xs font-semibold text-gray-700 mb-1">Despesa que será paga *</label>
                          <select
                            required
                            value={lancamentoRelacionadoId}
                            onChange={(e) => {
                              const id = e.target.value;
                              setLancamentoRelacionadoId(id);
                              const despesa = despesasPendentes.find((item) => item.id === id);
                              if (despesa) {
                                setValorInput(despesa.valor.toFixed(2));
                                setDescricaoInput(`Pagamento em dinheiro: ${despesa.descricao}`);
                              }
                            }}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs bg-white focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                          >
                            <option value="">Selecione a despesa pendente...</option>
                            {despesasPendentes.map((despesa) => (
                              <option key={despesa.id} value={despesa.id}>
                                {despesa.fornecedorCliente} — R$ {despesa.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} — {despesa.dataVencimento}
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-gray-500 mt-1">O lançamento será liquidado sem criar uma segunda despesa no DRE.</p>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Descrição / Histórico</label>
                        <input
                          type="text"
                          required
                          value={descricaoInput}
                          onChange={(e) => setDescricaoInput(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1">Anexo comprobatório (opcional)</label>
                        <input
                          type="file"
                          accept="application/pdf,image/jpeg"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            if (file && !['application/pdf', 'image/jpeg'].includes(file.type)) {
                              showToast('Envie um arquivo PDF, JPG ou JPEG.', 'error');
                              e.currentTarget.value = '';
                              setAnexo(null);
                              return;
                            }
                            if (file && file.size > 10 * 1024 * 1024) {
                              showToast('O anexo deve ter no máximo 10 MB.', 'error');
                              e.currentTarget.value = '';
                              setAnexo(null);
                              return;
                            }
                            setAnexo(file);
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs bg-white file:mr-3 file:border-0 file:bg-[#eff4ff] file:px-2 file:py-1 file:text-[10px] file:font-bold"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Aceita PDF, JPG ou JPEG, até 10 MB.</p>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <>
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
                    <p className="font-bold text-blue-900">Saldo Esperado pelo Sistema:</p>
                    <p className="text-lg font-black text-[#0b1c30]">R$ {sessaoCaixa.saldoEsperado.toFixed(2)}</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Saldo Contado em Dinheiro / Gaveta (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      placeholder="Informe o valor contado"
                      value={valorInput}
                      onChange={(e) => setValorInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-black text-[#0b1c30] focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Observações de Fechamento</label>
                    <textarea
                      rows={2}
                      placeholder="Justificativa de divergência caso haja"
                      value={observacaoFechamento}
                      onChange={(e) => setObservacaoFechamento(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                    ></textarea>
                  </div>
                </>
              )}

              <div className="pt-3 border-t border-gray-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30]"
                >
                  Confirmar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
