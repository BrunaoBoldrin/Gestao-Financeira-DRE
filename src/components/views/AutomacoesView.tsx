import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export const AutomacoesView: React.FC = () => {
  const { regrasAutomacao, toggleRegraAutomacao, addRegraAutomacao } = useApp();

  const [nome, setNome] = useState('');
  const [palavraChave, setPalavraChave] = useState('');
  const [categoriaDestino, setCategoriaDestino] = useState('Insumos Médicos & Estéticos');
  const [centroCustoDestino, setCentroCustoDestino] = useState('Estoque Central');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !palavraChave) return;

    addRegraAutomacao({
      nome,
      palavraChave,
      categoriaDestino,
      centroCustoDestino,
      autoAprovarConfiancaMinima: 90,
      ativa: true
    });

    setNome('');
    setPalavraChave('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-purple-600">smart_toy</span>
            Motor de Regras de Automação e Categorização OCR
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Regras inteligentes IF/THEN para auto-aprovação de documentos e direcionamento contábil.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Rules List */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Regras Ativas no Sistema ({regrasAutomacao.length})
          </h3>

          <div className="space-y-3">
            {regrasAutomacao.map((regra) => (
              <div
                key={regra.id}
                className={`p-4 rounded-xl border transition flex items-center justify-between gap-3 ${
                  regra.ativa ? 'bg-white border-[#d3e4fe] shadow-xs' : 'bg-gray-50 border-gray-200 opacity-60'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xs font-bold text-[#0b1c30]">{regra.nome}</h4>
                    <span className="text-[10px] font-mono font-bold bg-[#eff4ff] text-[#0b1c30] px-1.5 py-0.2 rounded">
                      SE contiver: "{regra.palavraChave}"
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-600">
                    Direcionar para: <strong>{regra.categoriaDestino}</strong> • {regra.centroCustoDestino}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    Tolerância de Confiança OCR: ≥ {regra.autoAprovarConfiancaMinima}%
                  </p>
                </div>

                <button
                  onClick={() => toggleRegraAutomacao(regra.id)}
                  className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                    regra.ativa
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                  }`}
                >
                  {regra.ativa ? 'Ativa' : 'Inativa'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Add New Rule Form */}
        <div className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">Nova Regra de Categorização</h3>

          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Nome da Regra</label>
              <input
                type="text"
                required
                placeholder="Ex: Fornecedor Galderma"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Palavra-Chave / Padrão</label>
              <input
                type="text"
                required
                placeholder="Ex: GALDERMA"
                value={palavraChave}
                onChange={(e) => setPalavraChave(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none uppercase font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Categoria de Destino</label>
              <select
                value={categoriaDestino}
                onChange={(e) => setCategoriaDestino(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white font-semibold"
              >
                <option value="Insumos Médicos & Estéticos">Insumos Médicos & Estéticos</option>
                <option value="Ocupação & Infraestrutura">Ocupação & Infraestrutura</option>
                <option value="Marketing & Publicidade">Marketing & Publicidade</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Centro de Custo Destino</label>
              <select
                value={centroCustoDestino}
                onChange={(e) => setCentroCustoDestino(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white font-semibold"
              >
                <option value="Estoque Central">Estoque Central</option>
                <option value="Clínica / Atendimento">Clínica / Atendimento</option>
                <option value="Administrativo">Administrativo</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30] transition shadow-xs mt-2"
            >
              Criar Regra de Automação
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
