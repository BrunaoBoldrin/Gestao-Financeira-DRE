import { bankBelongsToUnit, findUnit, isPhysicalCashAccount, supplierBelongsToUnit } from '../../utils/categoryUnits';
import { CadastroSearch } from '../common/CadastroSearch';
import { ModalOverlay } from '../common/ModalOverlay';
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TipoLancamento, StatusLancamento } from '../../types';
import { uploadPersistentFile } from '../../services/persistenceApi';

interface NovoLancamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
  tipoInicial?: TipoLancamento;
}

export const NovoLancamentoModal: React.FC<NovoLancamentoModalProps> = ({
  isOpen,
  onClose,
  tipoInicial = 'DESPESA'
}) => {
  const { 
    addLancamento, 
    addLancamentoComDDL, 
    addTransferencia,
    selectedUnit,
    units,
    categorias,
    centrosCusto,
    fornecedores,
    bancos,
    condicoesPagamento,
    currentUser,
    isFinance,
    persistenceStatus,
    flushPersistence,
    showToast
  } = useApp();

  const [tipo, setTipo] = useState<TipoLancamento>(tipoInicial);
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [valor, setValor] = useState('');
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().substring(0, 10));
  const [dataCompetencia, setDataCompetencia] = useState(new Date().toISOString().substring(0, 10));
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().substring(0, 10));
  const [selectedCondicaoId, setSelectedCondicaoId] = useState<string>('cond-3'); // 30 Dias default
  const [selectedFornecedorId, setSelectedFornecedorId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [fornecedorCliente, setFornecedorCliente] = useState('');
  const [bancoId, setBancoId] = useState('');
  const [unidade, setUnidade] = useState(selectedUnit === 'Todas as Unidades' ? '' : selectedUnit);
  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'BOLETO' | 'CARNE' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'DINHEIRO' | 'TRANSFERENCIA'>('BOLETO');
  const [status, setStatus] = useState<StatusLancamento>('PENDENTE');
  const [contaDestinoBancoId, setContaDestinoBancoId] = useState('');
  const [anexo, setAnexo] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setAnexo(null);
    setValor('');
    setDescricao('');
    setCategoria('');
    setFornecedorCliente('');
    setSelectedFornecedorId('');
    setObservacoes('');
    setCentroCusto('');
    setBancoId('');
    setContaDestinoBancoId('');
    onClose();
  };

  React.useEffect(() => {
    if (!isOpen) return;
    if (isFinance && currentUser) {
      setUnidade(currentUser.unit);
      return;
    }
    setUnidade(selectedUnit === 'Todas as Unidades' ? '' : selectedUnit);
  }, [isOpen, isFinance, currentUser?.unit, selectedUnit]);

  const activeUnits = units.filter((item) => item.id !== 'all' && item.ativa);
  const branch = findUnit(isFinance && currentUser ? currentUser.unit : unidade, units)
    ?? (!isFinance && activeUnits.length === 1 ? activeUnits[0] : undefined);
  const targetUnit = branch?.ativa ? branch.nome : '';
  const plans = categorias.filter((item) => item.ativa && item.tipo === tipo);
  const parties = fornecedores.filter((item) => item.ativo && supplierBelongsToUnit(item, targetUnit, units) &&
    (tipo === 'RECEITA' ? item.tipo === 'CLIENTE' : item.tipo !== 'CLIENTE'));
  const selectedParty = parties.find((item) => item.id === selectedFornecedorId);
  const defaultExpensePlan = tipo === 'DESPESA' && plans.find((item) => item.id === selectedParty?.planoContaId);
  const activeCenters = centrosCusto.filter((item) => item.ativo);
  const selectedPlan = defaultExpensePlan || plans.find((item) => item.id === categoria);
  const defaultCenter = activeCenters.find((item) => item.id === selectedPlan?.centroCustoId);
  const availableBanks = bancos.filter((banco) =>
    banco.ativo && bankBelongsToUnit(banco, targetUnit, units) &&
    (formaPagamento === 'TRANSFERENCIA' || isPhysicalCashAccount(banco) === (formaPagamento === 'DINHEIRO'))
  );
  const mustSelectBank = status === 'PAGO' || formaPagamento === 'TRANSFERENCIA';
  const selectedBank = availableBanks.find((item) => item.id === bancoId);
  const selectedDestination = availableBanks.find((item) => item.id === contaDestinoBancoId && item.id !== bancoId);

  const selectPlan = (plan?: { id: string; nome: string }) => {
    setDescricao(plan?.nome || '');
    setCategoria(plan?.id || '');
    setCentroCusto('');
  };

  const selectUnit = (name: string) => {
    setUnidade(name);
    setSelectedFornecedorId('');
    setFornecedorCliente('');
    setBancoId('');
    setContaDestinoBancoId('');
    if (tipo === 'DESPESA') selectPlan();
  };

  if (!isOpen) return null;

  const numVal = Number(valor);
  const activeConditions = condicoesPagamento.filter((condition) => condition.ativa);
  const activeCond = activeConditions.find((condition) => condition.id === selectedCondicaoId) || activeConditions[0];
  const prazos = activeCond?.prazosDias.length ? activeCond.prazosDias : [0];

  const handleAnexoChange = (file?: File) => {
    if (!file) {
      return;
    }

    const tiposPermitidos = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!tiposPermitidos.includes(file.type)) {
      showToast('Formato inválido. Selecione um arquivo PDF, JPG ou PNG.', 'error');
      setAnexo(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showToast('O anexo deve ter no máximo 10 MB.', 'error');
      setAnexo(null);
      return;
    }

    setAnexo(file);
  };

  const readDemoAttachment = (file: File) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Falha ao ler o anexo.'));
    reader.readAsDataURL(file);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!targetUnit) { showToast('Selecione uma filial ativa para continuar.', 'error'); return; }
    if (!Number.isFinite(numVal) || numVal <= 0) { showToast('Informe um valor maior que zero.', 'error'); return; }

    if (tipo === 'DESPESA' && !selectedParty) {
      showToast('Selecione um favorecido cadastrado na lista.', 'error'); return;
    }
    const selectedCadastro = selectedPlan;
    if (!selectedCadastro) {
      showToast('Selecione uma receita ou despesa da lista de cadastros.', 'error');
      return;
    }
    const linkedCenter = defaultCenter ?? activeCenters.find((item) => item.nome === centroCusto);
    if (!linkedCenter) {
      showToast('Selecione um centro de custo ativo para continuar.', 'error');
      return;
    }

    if (mustSelectBank && !selectedBank) {
      showToast(`Cadastre ou selecione uma conta bancária para a unidade "${targetUnit}".`, 'error');
      return;
    }
    if (formaPagamento === 'TRANSFERENCIA' && !selectedDestination) {
      showToast('Selecione uma conta de destino diferente da origem.', 'error');
      return;
    }
    setIsSubmitting(true);
    let comprovanteUrl: string | undefined;

    if (anexo) {
      try {
        comprovanteUrl = persistenceStatus === 'LOCAL_DEMO'
          ? await readDemoAttachment(anexo)
          : (await uploadPersistentFile(anexo)).url;
      } catch {
        showToast('Não foi possível processar o anexo. Tente selecionar o arquivo novamente.', 'error');
        setIsSubmitting(false);
        return;
      }
    }

    if (formaPagamento === 'TRANSFERENCIA') {
      const created = addTransferencia({
        origemBancoId: bancoId,
        destinoBancoId: contaDestinoBancoId,
        valor: numVal,
        data: dataEmissao,
        descricao: observacoes.trim() ? selectedCadastro.nome + ' — ' + observacoes.trim() : selectedCadastro.nome,
        unidade: targetUnit,
        comprovanteUrl,
        documentoRef: anexo?.name
      });
      if (!created) { setIsSubmitting(false); return; }
      const saved = await flushPersistence();
      showToast(
        saved
          ? 'Transferência confirmada e salva.'
          : 'A transferência ainda não foi confirmada. Use “Tentar salvar” antes de sair.',
        saved ? 'success' : 'error'
      );
      setIsSubmitting(false);
      handleClose();
      return;
    }

    const payload = {
      descricao: selectedCadastro.nome,
      tipo,
      categoria: selectedCadastro.nome,
      centroCusto: linkedCenter.nome,
      valor: numVal,
      dataCompetencia: dataCompetencia || dataEmissao,
      dataVencimento: dataVencimento || dataEmissao,
      dataPagamento: status === 'PAGO' ? dataEmissao : undefined,
      status,
      observacoes: observacoes.trim() || undefined,
      fornecedorCliente: fornecedorCliente.trim() || (tipo === 'RECEITA' ? 'Cliente Diverso' : 'Favorecido Diverso'),
      bancoId: selectedBank?.id,
      contaBancaria: selectedBank?.banco || '',
      formaPagamento,
      unidade: targetUnit,
      comprovanteUrl,
      documentoRef: anexo?.name,
      impactoDRE: tipo
    };

    const created = tipo === 'DESPESA'
      ? addLancamentoComDDL(payload, dataEmissao, prazos)
      : addLancamento(payload);
    if (!created) { setIsSubmitting(false); return; }

    const saved = await flushPersistence();
    showToast(
      saved
        ? `${tipo === 'RECEITA' ? 'Receita' : 'Despesa'} confirmada e salva.`
        : 'O lançamento ainda não foi confirmado. Use “Tentar salvar” antes de sair.',
      saved ? 'success' : 'error'
    );
    setIsSubmitting(false);
    handleClose();
  };

  return (
    <ModalOverlay aria-labelledby="new-movement-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="entry-dialog bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="entry-dialog-header bg-[#0b1c30] text-white px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]">post_add</span>
            <h3 id="new-movement-title" className="font-bold text-base">Novo Lançamento Financeiro</h3>
          </div>
          <button type="button" aria-label="Fechar lançamento" onClick={handleClose} className="grid size-11 shrink-0 place-items-center rounded-lg text-gray-300 hover:bg-white/10 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Tipo Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-[#f8f9ff] p-1 rounded-lg border border-[#d3e4fe]">
            <button
              type="button" aria-pressed={tipo === 'RECEITA'}
              onClick={() => {
                setTipo('RECEITA'); selectPlan(); setFornecedorCliente(''); setSelectedFornecedorId('');
              }}
              className={`py-2 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                tipo === 'RECEITA' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:bg-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">trending_up</span>
              Receita
            </button>
            <button
              type="button" aria-pressed={tipo === 'DESPESA'}
              onClick={() => {
                setTipo('DESPESA'); selectPlan(); setFornecedorCliente(''); setSelectedFornecedorId('');
              }}
              className={`py-2 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                tipo === 'DESPESA' ? 'bg-rose-600 text-white shadow-xs' : 'text-gray-600 hover:bg-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">trending_down</span>
              Despesa
            </button>
          </div>

            <div>
              <label htmlFor="manual-unidade" className="block text-xs font-semibold text-gray-700 mb-1">
                Unidade / Filial <span className="text-red-500">*</span>
              </label>
              <select
                id="manual-unidade"
                value={targetUnit}
                onChange={(e) => selectUnit(e.target.value)}
                required
                disabled={isFinance}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white ${
                  isFinance ? 'cursor-not-allowed opacity-75' : ''
                }`}
              >
                <option value="" disabled>Selecione a unidade...</option>
                {activeUnits.map((unit) => (
                  <option key={unit.id} value={unit.nome}>{unit.nome} ({unit.cidade})</option>
                ))}
              </select>
              {!targetUnit && (
                <p className="text-xs text-amber-700 mt-1">{isFinance
                  ? 'Peça ao administrador para vincular seu usuário a uma filial ativa.'
                  : 'Escolha a filial para carregar as contas e os favorecidos.'}</p>
              )}
            </div>
          <CadastroSearch
            label={tipo === 'DESPESA' ? 'Favorecido / Fornecedor' : 'Cliente (opcional)'}
            value={fornecedorCliente}
            disabled={!targetUnit}
            required={tipo === 'DESPESA'}
            placeholder={tipo === 'DESPESA' ? 'Busque pelo nome ou CPF/CNPJ' : 'Digite o cliente ou selecione um cadastro'}
            emptyMessage={tipo === 'DESPESA' ? 'Nenhum favorecido ativo vinculado a esta filial.' : 'Nenhum cliente ativo nesta filial. Você pode informar o nome.'}
            options={parties.map((item) => ({ id: item.id, nome: item.nome, codigo: item.cnpj || '' }))}
            onChange={(name) => {
              setFornecedorCliente(name);
              setSelectedFornecedorId('');
              if (tipo === 'DESPESA') selectPlan();
            }}
            onSelect={(option) => {
              setSelectedFornecedorId(option.id);
              setFornecedorCliente(option.nome);
              if (tipo === 'DESPESA') selectPlan();
            }}
          />
          {defaultExpensePlan ? (
            <label className="block text-xs font-semibold text-gray-700">
              Plano de despesa do favorecido
              <input readOnly value={defaultExpensePlan.nome} className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50" />
            </label>
          ) : (
            <CadastroSearch
              label={tipo === 'RECEITA' ? 'Receita cadastrada' : 'Plano de despesa'}
              value={descricao}
              disabled={!targetUnit || (tipo === 'DESPESA' && !selectedParty)}
              placeholder="Digite o nome ou código do plano"
              options={plans}
              emptyMessage={tipo === 'RECEITA' ? 'Nenhum plano de receita ativo no Plano de Contas.' : 'Nenhum plano de despesa ativo no Plano de Contas.'}
              onChange={(name) => { setDescricao(name); setCategoria(''); setCentroCusto(''); }}
              onSelect={selectPlan}
            />
          )}
          <div>
            <label htmlFor="manual-centro-custo" className="block text-xs font-semibold text-gray-700 mb-1">Centro de custo *</label>
            {defaultCenter ? (
              <input id="manual-centro-custo" readOnly value={defaultCenter.nome}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50" />
            ) : (
              <select id="manual-centro-custo" value={centroCusto} onChange={(event) => setCentroCusto(event.target.value)}
                required disabled={!selectedPlan} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:bg-gray-100">
                <option value="">{selectedPlan ? 'Selecione o centro de custo' : 'Selecione primeiro o plano de contas'}</option>
                {activeCenters.map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="manual-valor" className="block text-xs font-semibold text-gray-700 mb-1">
                Valor Total (R$) <span className="text-red-500">*</span>
              </label>
              <input
                id="manual-valor"
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="0,00"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Data de Emissão (NF/Boleto)</label>
              <input
                type="date"
                required
                value={dataEmissao}
                onChange={(e) => setDataEmissao(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white font-medium"
              />
            </div>
          </div>

          <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
            <label className="block text-xs font-semibold text-sky-900 mb-1">
              Data de competência da DRE <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={dataCompetencia}
              onChange={(e) => setDataCompetencia(e.target.value)}
              className="w-full px-3 py-2 border border-sky-200 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white font-medium"
            />
            <p className="text-[10px] text-sky-800 mt-1">
              Define o mês em que a receita ou despesa aparecerá na DRE, independentemente do pagamento.
            </p>
          </div>

          {/* DDL Payment Condition Selector for Expenses */}
          {tipo === 'DESPESA' ? (
            <div className="bg-[#f8f9ff] border border-[#C5A059]/40 p-3.5 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#C5A059] text-base">calendar_month</span>
                  Condição de Pagamento (DDL - Dias A/DF)
                </label>
                {numVal > 0 && (
                  <span className="text-[11px] font-extrabold text-[#775a19] bg-[#ffdea5] px-2 py-0.5 rounded">
                    Total: R$ {numVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                )}
              </div>

              <select
                value={activeCond?.id ?? ''}
                onChange={(e) => setSelectedCondicaoId(e.target.value)}
                className="w-full px-3 py-2 border border-[#d3e4fe] rounded-md text-xs font-bold text-[#0b1c30] bg-white focus:ring-2 focus:ring-[#131b2e]"
              >
                {activeConditions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>

              {/* Calculated Boletos Schedule Live Preview */}
              {numVal > 0 && prazos.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#d3e4fe] space-y-1.5">
                  <span className="text-[11px] font-semibold text-gray-600 block">
                    Cronograma dos boletos faturados computados:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {prazos.map((dias, idx) => {
                      const dt = new Date((dataEmissao || new Date().toISOString().substring(0, 10)) + 'T12:00:00');
                      dt.setDate(dt.getDate() + dias);
                      const dtFormatted = dt.toLocaleDateString('pt-BR');
                      const valPart = (numVal / prazos.length);

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded border border-gray-200 text-[11px]"
                        >
                          <span className="font-semibold text-gray-700">
                            Boleto {idx + 1}/{prazos.length} ({dias}d DDL):
                          </span>
                          <span className="font-bold text-[#0b1c30]">
                            R$ {valPart.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({dtFormatted})
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Data de Vencimento</label>
              <input
                type="date"
                required
                value={dataVencimento}
                onChange={(e) => setDataVencimento(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
              />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="manual-status" className="block text-xs font-semibold text-gray-700 mb-1">Status de Pagamento</label>
              <select id="manual-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusLancamento)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white"
              >
                <option value="PENDENTE">Pendente (A vencer)</option>
                <option value="PAGO">Pago / Liquidado</option>
              </select>
            </div>


          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="manual-forma" className="block text-xs font-semibold text-gray-700 mb-1">Forma de Pagamento</label>
              <select id="manual-forma"
                value={formaPagamento}
                onChange={(e) => {
                  setFormaPagamento(e.target.value as typeof formaPagamento);
                  setBancoId('');
                  setContaDestinoBancoId('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] bg-white"
              >
                <option value="PIX">PIX</option>
                <option value="BOLETO">Boleto</option>
                <option value="CARNE">Carnê / Crediário</option>
                <option value="CARTAO_CREDITO">Cartão de crédito</option>
                <option value="CARTAO_DEBITO">Cartão de débito</option>
                <option value="DINHEIRO">Dinheiro</option>
                <option value="TRANSFERENCIA">Transferência entre contas</option>
              </select>
            </div>

            <div>
              <label htmlFor="manual-conta" className="block text-xs font-semibold text-gray-700 mb-1">
                {formaPagamento === 'TRANSFERENCIA' ? 'Conta de origem' : 'Conta bancária / Caixa'}{' '}
                {mustSelectBank && <span className="text-red-500">*</span>}
              </label>
              <select
                id="manual-conta"
                value={selectedBank?.id ?? ''}
                onChange={(e) => setBancoId(e.target.value)}
                required={mustSelectBank}
                disabled={!targetUnit || availableBanks.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] bg-white disabled:bg-gray-100"
              >
                <option value="">
                  {targetUnit ? (mustSelectBank ? 'Selecione a conta...' : 'Definir na liquidação') : 'Selecione primeiro a unidade'}
                </option>
                {availableBanks.map((banco) => (
                  <option key={banco.id} value={banco.id}>
                    {banco.banco}{banco.agencia ? ' · Ag. ' + banco.agencia : ''}{banco.conta ? ' · C/C ' + banco.conta : ''}
                  </option>
                ))}
              </select>
              {targetUnit && mustSelectBank && availableBanks.length === 0 && (
                <p className="text-[10px] text-rose-600 mt-1">{formaPagamento === 'DINHEIRO' ? 'Cadastre um Caixa Físico ativo para esta unidade antes de lançar em dinheiro.' : 'Nenhuma conta ativa cadastrada para esta unidade.'}</p>
              )}
              {formaPagamento === 'DINHEIRO' && availableBanks.length > 0 && (
                <p className="text-[10px] text-gray-500 mt-1">Quando pago, o lançamento atualiza o caixa físico: receita soma e despesa subtrai.</p>
              )}
            </div>
          </div>

          {formaPagamento === 'TRANSFERENCIA' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Conta de destino <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedDestination?.id ?? ''}
                onChange={(e) => setContaDestinoBancoId(e.target.value)}
                required disabled={!selectedBank}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] bg-white"
              >
                <option value="" disabled>Selecione a conta de destino...</option>
                {availableBanks.filter((banco) => banco.id !== bancoId).map((banco) => (
                  <option key={banco.id} value={banco.id}>{banco.banco}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="manual-observacoes" className="block text-xs font-semibold text-gray-700 mb-1">Observações (opcional)</label>
            <textarea id="manual-observacoes" rows={3} value={observacoes} onChange={(event) => setObservacoes(event.target.value)}
              placeholder="Informações adicionais sobre o lançamento"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-y" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Anexo financeiro (opcional)</label>
            <label className="flex items-center justify-between gap-3 w-full px-3 py-2.5 border border-dashed border-gray-300 rounded-md text-xs bg-gray-50 hover:bg-gray-100 cursor-pointer transition">
              <span className="flex items-center gap-2 min-w-0 text-gray-700">
                <span className="material-symbols-outlined text-lg text-[#131b2e]">attach_file</span>
                <span className="truncate">{anexo ? anexo.name : 'Selecionar PDF, JPG ou PNG'}</span>
              </span>
              <span className="shrink-0 text-[10px] font-bold text-gray-500">Máx. 10 MB</span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png"
                onChange={(event) => handleAnexoChange(event.target.files?.[0])}
                className="sr-only"
              />
            </label>
            <label className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d3e4fe] bg-[#eff4ff] px-4 py-3 text-xs font-semibold text-[#0b1c30] cursor-pointer focus-within:ring-2 focus-within:ring-[#C5A059]">
              <span className="material-symbols-outlined" aria-hidden="true">photo_camera</span>
              Tirar foto
              <input
                type="file"
                accept="image/jpeg,image/png"
                capture="environment"
                aria-label="Tirar foto do recibo ou documento"
                className="sr-only"
                onChange={(event) => {
                  handleAnexoChange(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
            {anexo && (
              <button
                type="button"
                onClick={() => { if (window.confirm('Tem certeza que deseja remover este anexo?')) setAnexo(null); }}
                className="mt-1 text-[10px] font-semibold text-rose-600 hover:underline"
              >
                Remover anexo
              </button>
            )}
          </div>

          <div className="entry-dialog-actions pt-4 border-t border-gray-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30] disabled:bg-gray-400 disabled:cursor-not-allowed shadow-xs transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              {isSubmitting ? 'Confirmando...' : 'Salvar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
};
