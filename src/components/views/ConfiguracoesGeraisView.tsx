import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

export const ConfiguracoesGeraisView: React.FC = () => {
  const { units, addUnit, updateUnit, toggleUnitActive, exportBackupJSON, showToast } = useApp();

  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [nomeUnit, setNomeUnit] = useState('');
  const [cnpjUnit, setCnpjUnit] = useState('');
  const [cidadeUnit, setCidadeUnit] = useState('');

  const handleBackup = () => {
    const jsonStr = exportBackupJSON();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_royalface_financeiro_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup completo baixado com sucesso em JSON!', 'success');
  };

  const openAddUnitModal = () => {
    setEditingUnitId(null);
    setNomeUnit('');
    setCnpjUnit('');
    setCidadeUnit('');
    setShowUnitModal(true);
  };

  const handleSaveUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomeUnit) return;

    if (editingUnitId) {
      updateUnit(editingUnitId, { nome: nomeUnit, cnpj: cnpjUnit, cidade: cidadeUnit });
    } else {
      addUnit({ nome: nomeUnit, cnpj: cnpjUnit, cidade: cidadeUnit, ativa: true });
    }

    setShowUnitModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">settings</span>
            Configurações Gerais do Sistema & Filiais
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Cadastro de novas unidades/filiais, parâmetros do grupo e exportação de backup.
          </p>
        </div>

        <button
          onClick={handleBackup}
          className="px-4 py-2 bg-[#131b2e] text-white rounded-lg text-xs font-bold hover:bg-[#0b1c30] flex items-center gap-1.5 transition shadow-xs"
        >
          <span className="material-symbols-outlined text-base">download</span>
          Exportar Backup Completo (JSON)
        </button>
      </div>

      {/* Units / Branches Section */}
      <div className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0b1c30] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-blue-600">location_city</span>
              Gerenciamento de Unidades e Filiais
            </h3>
            <p className="text-xs text-gray-500">
              Cadastre novas franquias ou clínicas para filtrar separadamente no sistema.
            </p>
          </div>

          <button
            onClick={openAddUnitModal}
            className="px-3 py-1.5 bg-blue-600 text-white rounded-md text-xs font-bold hover:bg-blue-700 flex items-center gap-1 transition shadow-xs"
          >
            <span className="material-symbols-outlined text-base">add</span>
            Nova Filial / Unidade
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
          {units.filter((u) => u.id !== 'all').map((u) => (
            <div key={u.id} className="p-4 bg-[#f8f9ff] border border-[#d3e4fe] rounded-xl flex flex-col justify-between space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#0b1c30]">{u.nome}</h4>
                  <p className="text-[11px] text-gray-500 font-mono mt-0.5">CNPJ: {u.cnpj || 'Não informado'}</p>
                  <p className="text-[11px] text-gray-600 mt-0.5">Cidade: {u.cidade}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${u.ativa !== false ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'}`}>
                  {u.ativa !== false ? 'Ativa' : 'Inativa'}
                </span>
              </div>

              <div className="flex justify-end gap-1 pt-2 border-t border-gray-200">
                <button
                  onClick={() => {
                    setEditingUnitId(u.id);
                    setNomeUnit(u.nome);
                    setCnpjUnit(u.cnpj || '');
                    setCidadeUnit(u.cidade || '');
                    setShowUnitModal(true);
                  }}
                  className="px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 rounded"
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleUnitActive(u.id)}
                  className={`px-2 py-1 text-xs font-semibold rounded ${u.ativa !== false ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                >
                  {u.ativa !== false ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Settings */}
        <div className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Dados da Matriz / Holding
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-gray-500 font-semibold mb-1">Razão Social</label>
              <input
                type="text"
                readOnly
                value="ROYAL FACE GESTAO E FRANQUIAS ESTETICAS S.A."
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md font-bold text-[#0b1c30]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-gray-500 font-semibold mb-1">CNPJ Matriz</label>
                <input
                  type="text"
                  readOnly
                  value="12.345.678/0001-90"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md font-mono text-gray-800"
                />
              </div>
              <div>
                <label className="block text-gray-500 font-semibold mb-1">Inscrição Estadual</label>
                <input
                  type="text"
                  readOnly
                  value="110.293.840.119"
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md font-mono text-gray-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* System Settings & Compliance */}
        <div className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Parâmetros Contábeis & Conformidade
          </h3>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 bg-[#f8f9ff] border border-[#d3e4fe] rounded-lg">
              <div>
                <p className="font-bold text-[#0b1c30]">Regime de Contabilidade Padrão</p>
                <p className="text-[10px] text-gray-500">DRE por Competência / Fluxo por Caixa</p>
              </div>
              <span className="text-[10px] font-bold bg-[#131b2e] text-white px-2 py-0.5 rounded">
                NBC TG 26
              </span>
            </div>

            <div className="flex items-center justify-between p-3 bg-[#f8f9ff] border border-[#d3e4fe] rounded-lg">
              <div>
                <p className="font-bold text-[#0b1c30]">Motor OCR com IA Gemini</p>
                <p className="text-[10px] text-gray-500">Extração inteligente sem custo de uso</p>
              </div>
              <span className="text-[10px] font-bold bg-purple-100 text-purple-800 px-2 py-0.5 rounded">
                Gratuito
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Add/Edit Unit */}
      {showUnitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-[#0b1c30] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingUnitId ? 'Editar Filial' : 'Nova Filial / Unidade'}
              </h3>
              <button onClick={() => setShowUnitModal(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveUnit} className="p-6 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nome da Unidade / Filial</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Royal Face - Unidade Morumbi"
                  value={nomeUnit}
                  onChange={(e) => setNomeUnit(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">CNPJ da Filial</label>
                <input
                  type="text"
                  placeholder="00.000.000/0001-00"
                  value={cnpjUnit}
                  onChange={(e) => setCnpjUnit(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-xs font-mono focus:ring-2 focus:ring-[#131b2e]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Cidade / Estado</label>
                <input
                  type="text"
                  placeholder="Ex: São Paulo / SP"
                  value={cidadeUnit}
                  onChange={(e) => setCidadeUnit(e.target.value)}
                  className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                />
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUnitModal(false)}
                  className="px-4 py-2 border rounded text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#131b2e] text-white rounded text-xs font-bold hover:bg-[#0b1c30]"
                >
                  Salvar Filial
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
