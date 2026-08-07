import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface NovoParcelamentoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NovoParcelamentoModal: React.FC<NovoParcelamentoModalProps> = ({ isOpen, onClose }) => {
  const { addParcelamento } = useApp();

  const [titulo, setTitulo] = useState('');
  const [fornecedor, setFornecedor] = useState('');
  const [categoria, setCategoria] = useState('Investimento em Equipamentos (Capex)');
  const [centroCusto, setCentroCusto] = useState('Tecnologia & Equipamentos');
  const [valorTotal, setValorTotal] = useState('');
  const [numeroParcelas, setNumeroParcelas] = useState(12);
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().substring(0, 10));

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !valorTotal) return;

    addParcelamento({
      titulo,
      fornecedor,
      categoria,
      centroCusto,
      valorTotal: parseFloat(valorTotal),
      numeroParcelas,
      dataInicio,
      valorParcela: parseFloat(valorTotal) / numeroParcelas
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-[#0b1c30] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]">view_kanban</span>
            <h3 className="font-bold text-base">Novo Contrato de Parcelamento</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Título do Contrato / Compra <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Aquisição Aparelho Ultraformer III"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fornecedor / Credor</label>
              <input
                type="text"
                placeholder="Razão Social"
                value={fornecedor}
                onChange={(e) => setFornecedor(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Data 1ª Parcela</label>
              <input
                type="date"
                required
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
              />
            </div>
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
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Nº de Parcelas</label>
              <select
                value={numeroParcelas}
                onChange={(e) => setNumeroParcelas(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white font-bold"
              >
                <option value={2}>2x Mensais</option>
                <option value={3}>3x Mensais</option>
                <option value={6}>6x Mensais</option>
                <option value={10}>10x Mensais</option>
                <option value={12}>12x Mensais</option>
                <option value={18}>18x Mensais</option>
                <option value={24}>24x Mensais</option>
                <option value={36}>36x Mensais</option>
              </select>
            </div>
          </div>

          {valorTotal && parseFloat(valorTotal) > 0 && (
            <div className="p-3 bg-[#eff4ff] border border-[#d3e4fe] rounded-lg flex items-center justify-between">
              <div>
                <p className="text-[11px] text-[#45464d]">Valor de Cada Parcela</p>
                <p className="text-sm font-extrabold text-[#0b1c30]">
                  R$ {(parseFloat(valorTotal) / numeroParcelas).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / mês
                </p>
              </div>
              <span className="text-xs font-bold text-[#775a19] bg-[#ffdea5] px-2 py-1 rounded">
                Cronograma Automático
              </span>
            </div>
          )}

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
              className="px-5 py-2 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30] shadow-xs transition"
            >
              Gerar Cronograma
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
