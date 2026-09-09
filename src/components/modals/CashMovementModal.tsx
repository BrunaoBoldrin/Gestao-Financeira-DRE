import { ModalOverlay } from '../common/ModalOverlay';
import React, { useEffect, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { FinalidadeMovimentacaoCaixa } from '../../types';
import { uploadPersistentFile } from '../../services/persistenceApi';

export type CashAction = 'SANGRIA' | 'SUPRIMENTO' | 'VENDA' | 'AJUSTE';
type ModalType = CashAction;
const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const CashMovementModal: React.FC<{initialAction: CashAction; onClose: () => void}> = ({initialAction, onClose}) => {
  const {
    registrarMovimentacaoCaixa,
    ajustarSaldoCaixa,
    addTransferencia,
    canExecuteFinancialActions,
    bancos,
    lancamentos,
    flushPersistence,
    units,
    selectedUnit,
    currentUser,
    isAdmin,
    isFinance,
    persistenceStatus,
    showToast
  } = useApp();

  const unidadeInicial = isFinance && currentUser
    ? currentUser.unit
    : selectedUnit !== 'Todas as Unidades'
      ? selectedUnit
      : units.find((unit) => unit.ativa)?.nome || '';
  const [unidadeCaixa, setUnidadeCaixa] = useState(unidadeInicial);
  const [modalType, setModalType] = useState<ModalType | null>(initialAction);
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
      (!isFinance || item.criadoPorId === currentUser?.id) &&
      item.tipo === 'DESPESA' &&
      item.status !== 'PAGO' &&
      item.status !== 'CANCELADO'
  );
  const readDemoAttachment = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Falha ao ler o anexo.'));
    reader.readAsDataURL(file);
  });

  const resetModal = () => {
    onClose();
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
    if (!modalType || !contaCaixa || submitting || (modalType === 'AJUSTE' && !isAdmin)) return;

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

    setSubmitting(true);
    let comprovanteUrl: string | undefined;
    if (anexo) {
      try {
        comprovanteUrl = persistenceStatus === 'LOCAL_DEMO'
          ? await readDemoAttachment(anexo)
          : (await uploadPersistentFile(anexo)).url;
      } catch {
        setSubmitting(false);
        showToast('Não foi possível ler o anexo selecionado.', 'error');
        return;
      }
    }

    if (modalType === 'AJUSTE') {
      ajustarSaldoCaixa({ unidade: unidadeCaixa, novoSaldo: valor, motivo: descricaoInput, comprovanteRef: comprovanteUrl });
      await finishSave();
      return;
    }

    if (modalType === 'SANGRIA' && finalidade === 'DEPOSITO_BANCARIO') {
      if (!bancoTransferenciaId) {
        setSubmitting(false);
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
          setSubmitting(false);
          showToast('Selecione a despesa que será liquidada em dinheiro.', 'error');
          return;
        }
        if (Math.abs(despesa.valor - valor) > 0.01) {
          setSubmitting(false);
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

    await finishSave();
  };


  const [submitting, setSubmitting] = useState(false);
  const finishSave = async () => {
    const saved = await flushPersistence();
    showToast(saved ? 'Movimentação salva.' : 'Movimentação pendente de salvar. Use Tentar salvar.', saved ? 'success' : 'error');
    setSubmitting(false);
    onClose();
  };
  useEffect(() => { openModal(initialAction); }, [initialAction]);
  useEffect(() => {
    setBancoTransferenciaId(''); setLancamentoRelacionadoId('');
    setValorInput('');
  }, [unidadeCaixa]);

  if (!canExecuteFinancialActions || (initialAction === 'AJUSTE' && !isAdmin)) return null;
  return (
        <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-full overflow-y-auto animate-in fade-in zoom-in duration-150">
            <div className="bg-[#0b1c30] text-white px-6 py-4 flex flex-wrap items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">{{ SANGRIA: 'Sangria / saída do caixa', SUPRIMENTO: 'Suprimento do caixa', VENDA: 'Venda em dinheiro', AJUSTE: 'Ajustar saldo do caixa' }[initialAction]}</h3>
                <p className="text-[10px] text-slate-300 mt-0.5">{unidadeCaixa}</p>
              </div>
              <button disabled={submitting} onClick={resetModal} className="text-gray-400 hover:text-white"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleActionSubmit} className="p-6 space-y-4">
              <div>
                <label htmlFor="cash-unit" className="block text-xs font-semibold mb-1">Unidade do caixa</label>
                <select id="cash-unit" required disabled={isFinance || submitting} value={unidadeCaixa} onChange={event => setUnidadeCaixa(event.target.value)} className="w-full min-w-0 border rounded-lg p-2 text-sm">
                  <option value="">Selecione a unidade</option>
                  {units.filter(unit => unit.ativa && (!isFinance || unit.nome === currentUser?.unit)).map(unit => <option key={unit.id} value={unit.nome}>{unit.nome}</option>)}
                </select>
              </div>
              {!contaCaixa && <p className="text-sm text-amber-800">Cadastre uma conta Caixa Físico ativa para esta unidade antes de confirmar.</p>}
              <fieldset disabled={submitting || !contaCaixa} className="space-y-4">
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
                    {contasBancarias.map((banco) => <option key={banco.id} value={banco.id}>{banco.banco}{banco.agencia ? ' · Ag. ' + banco.agencia : ''}{banco.conta ? ' · C/C ' + banco.conta : ''}</option>)}
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
                <button type="button" disabled={submitting} onClick={resetModal} className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={submitting} className="px-5 py-2 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30]">{submitting ? 'Salvando...' : 'Confirmar'}</button>
              </div>
              </fieldset>
            </form>
          </div>
        </ModalOverlay>

  );
};
