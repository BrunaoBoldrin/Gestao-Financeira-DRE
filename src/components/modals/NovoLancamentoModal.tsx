import { categoryBelongsToUnit } from '../../utils/categoryUnits';
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
    setDescricao('');
    setCategoria('');
    onClose();
  };

  // Set default selects when lists load
  React.useEffect(() => {
    if (centrosCusto.length > 0 && !centroCusto) {
      setCentroCusto(centrosCusto.find((item) => item.ativo)?.nome || '');
    }
  }, [categorias, centrosCusto, bancos, tipo]);

  React.useEffect(() => {
    if (!isOpen) return;
    if (isFinance && currentUser) {
      setUnidade(currentUser.unit);
      return;
    }
    setUnidade(selectedUnit === 'Todas as Unidades' ? '' : selectedUnit);
  }, [isOpen, isFinance, currentUser?.unit, selectedUnit]);

  const targetUnit = isFinance && currentUser ? currentUser.unit : unidade;
  React.useEffect(() => {
    if (categoria && !categorias.some((item) => item.nome === categoria && item.ativa && item.tipo === tipo && categoryBelongsToUnit(item, targetUnit, units))) {
      setCategoria(''); setDescricao('');
    }
  }, [targetUnit, units, categorias, categoria, tipo]);

  const availableBanks = bancos.filter((banco) => banco.ativo && banco.unidade === targetUnit);

  React.useEffect(() => {
    if (!isOpen) return;
    const sourceIsValid = availableBanks.some((banco) => banco.id === bancoId);
    const nextSourceId = sourceIsValid ? bancoId : availableBanks[0]?.id || '';
    if (nextSourceId !== bancoId) setBancoId(nextSourceId);

    const destinationIsValid = availableBanks.some(
      (banco) => banco.id === contaDestinoBancoId && banco.id !== nextSourceId
    );
    if (!destinationIsValid) {
      setContaDestinoBancoId(availableBanks.find((banco) => banco.id !== nextSourceId)?.id || '');
    }
  }, [isOpen, targetUnit, bancos, bancoId, contaDestinoBancoId]);

  if (!isOpen) return null;

  const numVal = parseFloat(valor) || 0;
  const activeCond = condicoesPagamento.find((c) => c.id === selectedCondicaoId) || condicoesPagamento[0];
  const prazos = activeCond ? activeCond.prazosDias : [0];

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
    if (!descricao || numVal <= 0 || !unidade || isSubmitting) return;

    const selectedCadastro = categorias.find((item) => item.ativa && item.tipo === tipo && categoryBelongsToUnit(item, targetUnit, units) && item.nome === categoria && item.nome === descricao);
    if (!selectedCadastro) {
      showToast('Selecione uma receita ou despesa da lista de cadastros.', 'error');
      return;
    }
    if (!centrosCusto.some((item) => item.ativo && item.nome === centroCusto)) {
      showToast('Selecione um centro de custo ativo.', 'error');
      return;
    }

    const selectedBanco = availableBanks.find((banco) => banco.id === bancoId);
    if (!selectedBanco) {
      showToast(`Cadastre ou selecione uma conta bancária para a unidade "${targetUnit}".`, 'error');
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
      if (!contaDestinoBancoId) {
        showToast('Selecione uma conta de destino diferente da origem.', 'error');
        return;
      }
      addTransferencia({
        origemBancoId: bancoId,
        destinoBancoId: contaDestinoBancoId,
        valor: numVal,
        data: dataEmissao,
        descricao,
        unidade: targetUnit,
        comprovanteUrl,
        documentoRef: anexo?.name
      });
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
      descricao,
      tipo,
      categoria: selectedCadastro.nome,
      centroCusto,
      valor: numVal,
      dataCompetencia: dataCompetencia || dataEmissao,
      dataVencimento: dataVencimento || dataEmissao,
      dataPagamento: status === 'PAGO' ? dataEmissao : undefined,
      status,
      fornecedorCliente: fornecedorCliente || (tipo === 'RECEITA' ? 'Cliente Diverso' : 'Fornecedor Diverso'),
      bancoId: selectedBanco.id,
      contaBancaria: selectedBanco.banco,
      formaPagamento,
      unidade: targetUnit,
      comprovanteUrl,
      documentoRef: anexo?.name,
      impactoDRE: tipo
    };

    if (tipo === 'DESPESA' && prazos.length >= 1) {
      addLancamentoComDDL(payload, dataEmissao, prazos);
    } else {
      addLancamento(payload);
    }

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
    <ModalOverlay className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-[#0b1c30] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]">post_add</span>
            <h3 className="font-bold text-base">Novo Lançamento Financeiro</h3>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-white transition">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Tipo Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-[#f8f9ff] p-1 rounded-lg border border-[#d3e4fe]">
            <button
              type="button"
              onClick={() => {
                setTipo('RECEITA'); setDescricao(''); setCategoria('');
              }}
              className={`py-2 rounded-md font-bold text-xs flex items-center justify-center gap-1.5 transition ${
                tipo === 'RECEITA' ? 'bg-emerald-600 text-white shadow-xs' : 'text-gray-600 hover:bg-white'
              }`}
            >
              <span className="material-symbols-outlined text-base">trending_up</span>
              Receita
            </button>
            <button
              type="button"
              onClick={() => {
                setTipo('DESPESA'); setDescricao(''); setCategoria('');
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Unidade / Filial <span className="text-red-500">*</span>
              </label>
              <select
                value={unidade}
                onChange={(e) => setUnidade(e.target.value)}
                required
                disabled={isFinance}
                className={`w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white ${
                  isFinance ? 'cursor-not-allowed opacity-75' : ''
                }`}
              >
                <option value="" disabled>Selecione a unidade...</option>
                {units.filter((unit) => unit.ativa && unit.id !== 'all').map((unit) => (
                  <option key={unit.id} value={unit.nome}>{unit.nome} ({unit.cidade})</option>
                ))}
              </select>
              {selectedUnit === 'Todas as Unidades' && !isFinance && !unidade && (
                <p className="text-[10px] text-amber-700 mt-1">Informe a unidade responsável pelo lançamento.</p>
              )}
            </div>
          <CadastroSearch
            label={tipo === 'RECEITA' ? 'Receita cadastrada' : 'Despesa cadastrada'}
            value={descricao}
            options={categorias.filter((item) => item.ativa && item.tipo === tipo && categoryBelongsToUnit(item, targetUnit, units))}
            onChange={(text) => { setDescricao(text); setCategoria(''); }}
            onSelect={(item) => { setDescricao(item.nome); setCategoria(item.nome); }}
          />
          <div>
            <label htmlFor="manual-centro-custo" className="block text-xs font-semibold text-gray-700 mb-1">Centro de custo *</label>
            <select id="manual-centro-custo" required value={centroCusto} onChange={(event) => setCentroCusto(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">Selecione o centro de custo</option>
              {centrosCusto.filter((item) => item.ativo).map((item) => <option key={item.id} value={item.nome}>{item.nome}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Valor Total (R$) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
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
                value={selectedCondicaoId}
                onChange={(e) => setSelectedCondicaoId(e.target.value)}
                className="w-full px-3 py-2 border border-[#d3e4fe] rounded-md text-xs font-bold text-[#0b1c30] bg-white focus:ring-2 focus:ring-[#131b2e]"
              >
                {condicoesPagamento.filter((c) => c.ativa).map((c) => (
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Status de Pagamento</label>
              <select
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">Forma de Pagamento</label>
              <select
                value={formaPagamento}
                onChange={(e) => setFormaPagamento(e.target.value as typeof formaPagamento)}
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
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                {formaPagamento === 'TRANSFERENCIA' ? 'Conta de origem' : 'Conta bancária / Caixa'}{' '}
                <span className="text-red-500">*</span>
              </label>
              <select
                value={bancoId}
                onChange={(e) => setBancoId(e.target.value)}
                required
                disabled={!targetUnit || availableBanks.length === 0}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] bg-white disabled:bg-gray-100"
              >
                <option value="" disabled>
                  {targetUnit ? 'Selecione a conta...' : 'Selecione primeiro a unidade'}
                </option>
                {availableBanks.map((banco) => (
                  <option key={banco.id} value={banco.id}>
                    {banco.banco} — saldo {banco.saldo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </option>
                ))}
              </select>
              {targetUnit && availableBanks.length === 0 && (
                <p className="text-[10px] text-rose-600 mt-1">Nenhuma conta ativa cadastrada para esta unidade.</p>
              )}
            </div>
          </div>

          {formaPagamento === 'TRANSFERENCIA' && (
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Conta de destino <span className="text-red-500">*</span>
              </label>
              <select
                value={contaDestinoBancoId}
                onChange={(e) => setContaDestinoBancoId(e.target.value)}
                required
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

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
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
