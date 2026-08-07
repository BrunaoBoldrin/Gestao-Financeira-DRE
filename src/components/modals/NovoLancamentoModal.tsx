import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { TipoLancamento, StatusLancamento } from '../../types';

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
    condicoesPagamento
  } = useApp();

  const [tipo, setTipo] = useState<TipoLancamento>(tipoInicial);
  const [descricao, setDescricao] = useState('');
  const [categoria, setCategoria] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [valor, setValor] = useState('');
  const [dataEmissao, setDataEmissao] = useState(new Date().toISOString().substring(0, 10));
  const [dataVencimento, setDataVencimento] = useState(new Date().toISOString().substring(0, 10));
  const [selectedCondicaoId, setSelectedCondicaoId] = useState<string>('cond-3'); // 30 Dias default
  const [fornecedorCliente, setFornecedorCliente] = useState('');
  const [contaBancaria, setContaBancaria] = useState('');
  const [unidade, setUnidade] = useState(selectedUnit === 'Todas as Unidades' ? 'Royal Face - Matriz' : selectedUnit);
  const [formaPagamento, setFormaPagamento] = useState<'PIX' | 'BOLETO' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'DINHEIRO' | 'TRANSFERENCIA'>('BOLETO');
  const [status, setStatus] = useState<StatusLancamento>('PENDENTE');
  const [contaDestinoTransferencia, setContaDestinoTransferencia] = useState('');

  // Set default selects when lists load
  React.useEffect(() => {
    if (categorias.length > 0 && !categoria) {
      const match = categorias.find((c) => c.tipo === tipo && c.ativa);
      if (match) setCategoria(match.nome);
    }
    if (centrosCusto.length > 0 && !centroCusto) {
      setCentroCusto(centrosCusto[0].nome);
    }
    if (bancos.length > 0 && !contaBancaria) {
      setContaBancaria(bancos[0].banco);
    }
  }, [categorias, centrosCusto, bancos, tipo]);

  if (!isOpen) return null;

  const numVal = parseFloat(valor) || 0;
  const activeCond = condicoesPagamento.find((c) => c.id === selectedCondicaoId) || condicoesPagamento[0];
  const prazos = activeCond ? activeCond.prazosDias : [0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!descricao || numVal <= 0) return;

    const targetUnit = unidade || (selectedUnit === 'Todas as Unidades' ? 'Royal Face - Matriz' : selectedUnit);

    if (formaPagamento === 'TRANSFERENCIA' && contaDestinoTransferencia) {
      addTransferencia({
        origem: contaBancaria,
        destino: contaDestinoTransferencia,
        valor: numVal,
        data: dataEmissao,
        descricao,
        unidade: targetUnit
      });
      onClose();
      return;
    }

    const payload = {
      descricao,
      tipo,
      categoria: categoria || (tipo === 'RECEITA' ? 'Procedimentos Estéticos' : 'Insumos Médicos & Estéticos'),
      centroCusto: centroCusto || 'Clínica / Atendimento',
      valor: numVal,
      dataVencimento: dataVencimento || dataEmissao,
      dataPagamento: status === 'PAGO' ? new Date().toISOString().substring(0, 10) : undefined,
      status,
      fornecedorCliente: fornecedorCliente || (tipo === 'RECEITA' ? 'Cliente Diverso' : 'Fornecedor Diverso'),
      contaBancaria: contaBancaria || 'Itaú Uniclass - C/C 45892-1',
      formaPagamento,
      unidade: targetUnit
    };

    if (tipo === 'DESPESA' && prazos.length >= 1) {
      addLancamentoComDDL(payload, dataEmissao, prazos);
    } else {
      addLancamento(payload);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-[#0b1c30] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]">post_add</span>
            <h3 className="font-bold text-base">Novo Lançamento Financeiro</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Tipo Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-[#f8f9ff] p-1 rounded-lg border border-[#d3e4fe]">
            <button
              type="button"
              onClick={() => {
                setTipo('RECEITA');
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
                setTipo('DESPESA');
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
              Descrição do Título <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={tipo === 'RECEITA' ? 'Ex: Aplicação de Toxina - Paciente Juliana' : 'Ex: Compra Insumos Galderma'}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
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

          <div className="grid grid-cols-2 gap-3">
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

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30] shadow-xs transition flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">check_circle</span>
              Salvar Lançamento
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
