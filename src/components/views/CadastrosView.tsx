import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';

export const CadastrosView: React.FC = () => {
  const {
    categorias,
    addCategoria,
    updateCategoria,
    toggleCategoriaActive,
    centrosCusto,
    addCentroCusto,
    updateCentroCusto,
    toggleCentroCustoActive,
    fornecedores,
    addFornecedor,
    updateFornecedor,
    toggleFornecedorActive,
    bancos,
    addBanco,
    updateBanco,
    toggleBancoActive,
    units,
    selectedUnit,
    condicoesPagamento,
    addCondicaoPagamento,
    updateCondicaoPagamento,
    toggleCondicaoPagamentoActive,
    isAdmin,
    showToast
  } = useApp();

  const [activeTab, setActiveTab] = useState<
    'PLANO_CONTAS' | 'CENTROS_CUSTO' | 'FORNECEDORES' | 'BANCOS' | 'CONDICOES_PAGAMENTO'
  >('PLANO_CONTAS');

  // Modal / Form States
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [codigo, setCodigo] = useState('');
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState<'RECEITA' | 'DESPESA'>('DESPESA');
  const [responsavel, setResponsavel] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [cidade, setCidade] = useState('');
  const [agencia, setAgencia] = useState('');
  const [conta, setConta] = useState('');
  const [saldo, setSaldo] = useState('');
  const [bancoUnidade, setBancoUnidade] = useState('');
  const [prazosDiasStr, setPrazosDiasStr] = useState('30, 60, 90');
  const categoriasSort = useSortableData(categorias);
  const fornecedoresSort = useSortableData(fornecedores);
  const condicoesSort = useSortableData(condicoesPagamento);

  const openAddModal = () => {
    setEditingId(null);
    setCodigo('');
    setNome('');
    setTipo('DESPESA');
    setResponsavel('');
    setCnpj('');
    setCidade('');
    setAgencia('');
    setConta('');
    setSaldo('');
    setBancoUnidade(
      selectedUnit === 'Todas as Unidades'
        ? units.find((unit) => unit.ativa && unit.id !== 'all')?.nome || ''
        : selectedUnit
    );
    setShowFormModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    if (activeTab === 'PLANO_CONTAS') {
      if (!nome || !codigo) return;
      if (editingId) {
        updateCategoria(editingId, { codigo, nome, tipo });
      } else {
        addCategoria({ codigo, nome, tipo, ativa: true });
      }
    } else if (activeTab === 'CENTROS_CUSTO') {
      if (!nome || !codigo) return;
      if (editingId) {
        updateCentroCusto(editingId, { codigo, nome, responsavel });
      } else {
        addCentroCusto({ codigo, nome, responsavel, ativo: true });
      }
    } else if (activeTab === 'FORNECEDORES') {
      if (!nome) return;
      if (editingId) {
        updateFornecedor(editingId, { nome, cnpj, cidade });
      } else {
        addFornecedor({ nome, cnpj, cidade, ativo: true });
      }
    } else if (activeTab === 'BANCOS') {
      if (!nome || !bancoUnidade) return;
      if (editingId) {
        updateBanco(editingId, { banco: nome, agencia, conta, unidade: bancoUnidade, saldo: parseFloat(saldo) || 0 });
      } else {
        addBanco({ banco: nome, agencia, conta, unidade: bancoUnidade, saldo: parseFloat(saldo) || 0, ativo: true });
      }
    } else if (activeTab === 'CONDICOES_PAGAMENTO') {
      if (!nome) return;
      const parsedPrazos = prazosDiasStr
        .split(/[,/]/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));

      if (editingId) {
        updateCondicaoPagamento(editingId, { nome, prazosDias: parsedPrazos.length > 0 ? parsedPrazos : [0] });
      } else {
        addCondicaoPagamento({ nome, prazosDias: parsedPrazos.length > 0 ? parsedPrazos : [0], ativa: true });
      }
    }

    setShowFormModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">list_alt</span>
            Cadastros Auxiliares e Tabelas do Sistema
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Manutenção do plano de contas DRE, centros de custo, lista de fornecedores e contas bancárias.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (!isAdmin) {
                showToast('Ação restrita a Administradores.', 'error');
                return;
              }
              openAddModal();
            }}
            disabled={!isAdmin}
            title={!isAdmin ? 'Ação restrita a Administradores' : undefined}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition shadow-xs ${
              !isAdmin
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-[#131b2e] text-white hover:bg-[#0b1c30]'
            }`}
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            Cadastrar
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white p-1.5 rounded-xl border border-[#e5eeff] shadow-xs overflow-x-auto">
        <button
          onClick={() => setActiveTab('PLANO_CONTAS')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'PLANO_CONTAS' ? 'bg-[#131b2e] text-white shadow-xs' : 'text-gray-600 hover:bg-[#f8f9ff]'
          }`}
        >
          Plano de Contas DRE ({categorias.length})
        </button>
        <button
          onClick={() => setActiveTab('CENTROS_CUSTO')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'CENTROS_CUSTO' ? 'bg-[#131b2e] text-white shadow-xs' : 'text-gray-600 hover:bg-[#f8f9ff]'
          }`}
        >
          Centros de Custo ({centrosCusto.length})
        </button>
        <button
          onClick={() => setActiveTab('FORNECEDORES')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'FORNECEDORES' ? 'bg-[#131b2e] text-white shadow-xs' : 'text-gray-600 hover:bg-[#f8f9ff]'
          }`}
        >
          Fornecedores ({fornecedores.length})
        </button>
        <button
          onClick={() => setActiveTab('BANCOS')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'BANCOS' ? 'bg-[#131b2e] text-white shadow-xs' : 'text-gray-600 hover:bg-[#f8f9ff]'
          }`}
        >
          Contas Bancárias ({bancos.length})
        </button>
        <button
          onClick={() => setActiveTab('CONDICOES_PAGAMENTO')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
            activeTab === 'CONDICOES_PAGAMENTO' ? 'bg-[#131b2e] text-white shadow-xs' : 'text-gray-600 hover:bg-[#f8f9ff]'
          }`}
        >
          Condições de Pagamento / DDL ({condicoesPagamento.length})
        </button>
      </div>

      {/* Content Body */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden p-5">
        {activeTab === 'PLANO_CONTAS' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
              Plano de Contas DRE
            </h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f8f9ff] text-gray-700 font-bold uppercase text-[10px]">
                  <tr>
                    <SortableTableHeader label="Código" sortKey="codigo" accessor={(item) => item.codigo} sortConfig={categoriasSort.sortConfig} onSort={categoriasSort.requestSort} className="p-3" />
                    <SortableTableHeader label="Nome da Conta" sortKey="nome" accessor={(item) => item.nome} sortConfig={categoriasSort.sortConfig} onSort={categoriasSort.requestSort} className="p-3" />
                    <SortableTableHeader label="Tipo" sortKey="tipo" accessor={(item) => item.tipo} sortConfig={categoriasSort.sortConfig} onSort={categoriasSort.requestSort} className="p-3" />
                    <SortableTableHeader label="Status" sortKey="status" accessor={(item) => item.ativa} sortConfig={categoriasSort.sortConfig} onSort={categoriasSort.requestSort} className="p-3 text-center" />
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categoriasSort.sortedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3 font-mono font-bold text-[#0b1c30]">{item.codigo}</td>
                      <td className="p-3 font-semibold text-gray-800">{item.nome}</td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.tipo === 'RECEITA' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.tipo}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.ativa ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {item.ativa ? 'Ativa' : 'Inativa'}
                        </span>
                      </td>
                      <td className="p-3 text-center space-x-1">
                        <button
                          onClick={() => {
                            if (!isAdmin) {
                              showToast('Ação restrita a Administradores.', 'error');
                              return;
                            }
                            setEditingId(item.id);
                            setCodigo(item.codigo);
                            setNome(item.nome);
                            setTipo(item.tipo);
                            setShowFormModal(true);
                          }}
                          disabled={!isAdmin}
                          className={`p-1 rounded ${!isAdmin ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
                          title={!isAdmin ? 'Restrito a Administradores' : 'Editar'}
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={() => {
                            if (!isAdmin) {
                              showToast('Ação restrita a Administradores.', 'error');
                              return;
                            }
                            toggleCategoriaActive(item.id);
                          }}
                          disabled={!isAdmin}
                          className={`p-1 rounded ${
                            !isAdmin
                              ? 'text-gray-300 cursor-not-allowed'
                              : item.ativa
                              ? 'text-amber-600 hover:bg-amber-50'
                              : 'text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={!isAdmin ? 'Restrito a Administradores' : item.ativa ? 'Desativar' : 'Ativar'}
                        >
                          <span className="material-symbols-outlined text-base">
                            {item.ativa ? 'block' : 'check_circle'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'CENTROS_CUSTO' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
              Centros de Custo Operacionais
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {centrosCusto.map((cc) => (
                <div key={cc.id} className="p-4 bg-[#f8f9ff] border border-[#d3e4fe] rounded-xl flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono font-bold text-gray-400">{cc.codigo}</span>
                    <h4 className="text-xs font-bold text-[#0b1c30] mt-0.5">{cc.nome}</h4>
                    <p className="text-[11px] text-gray-500 mt-1">Responsável: {cc.responsavel || 'Não definido'}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        if (!isAdmin) {
                          showToast('Ação restrita a Administradores.', 'error');
                          return;
                        }
                        setEditingId(cc.id);
                        setCodigo(cc.codigo);
                        setNome(cc.nome);
                        setResponsavel(cc.responsavel || '');
                        setShowFormModal(true);
                      }}
                      disabled={!isAdmin}
                      className={`p-1 rounded ${!isAdmin ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-white'}`}
                      title={!isAdmin ? 'Restrito a Administradores' : 'Editar'}
                    >
                      <span className="material-symbols-outlined text-base">edit</span>
                    </button>
                    <button
                      onClick={() => {
                        if (!isAdmin) {
                          showToast('Ação restrita a Administradores.', 'error');
                          return;
                        }
                        toggleCentroCustoActive(cc.id);
                      }}
                      disabled={!isAdmin}
                      className={`p-1 rounded ${!isAdmin ? 'text-gray-300 cursor-not-allowed' : cc.ativo ? 'text-amber-600' : 'text-emerald-600'}`}
                      title={!isAdmin ? 'Restrito a Administradores' : cc.ativo ? 'Desativar' : 'Ativar'}
                    >
                      <span className="material-symbols-outlined text-base">
                        {cc.ativo ? 'block' : 'check_circle'}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'FORNECEDORES' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
              Lista de Fornecedores Cadastrados
            </h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-[#f8f9ff] text-gray-700 font-bold uppercase text-[10px]">
                  <tr>
                    <SortableTableHeader label="Razão Social / Nome" sortKey="nome" accessor={(item) => item.nome} sortConfig={fornecedoresSort.sortConfig} onSort={fornecedoresSort.requestSort} className="p-3" />
                    <SortableTableHeader label="CNPJ / CPF" sortKey="cnpj" accessor={(item) => item.cnpj} sortConfig={fornecedoresSort.sortConfig} onSort={fornecedoresSort.requestSort} className="p-3" />
                    <SortableTableHeader label="Cidade / UF" sortKey="cidade" accessor={(item) => item.cidade} sortConfig={fornecedoresSort.sortConfig} onSort={fornecedoresSort.requestSort} className="p-3" />
                    <SortableTableHeader label="Status" sortKey="status" accessor={(item) => item.ativo} sortConfig={fornecedoresSort.sortConfig} onSort={fornecedoresSort.requestSort} className="p-3 text-center" />
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {fornecedoresSort.sortedItems.map((f) => (
                    <tr key={f.id} className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-[#0b1c30]">{f.nome}</td>
                      <td className="p-3 font-mono text-gray-600">{f.cnpj || '-'}</td>
                      <td className="p-3 text-gray-600">{f.cidade || '-'}</td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${f.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                          {f.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="p-3 text-center space-x-1">
                        <button
                          onClick={() => {
                            if (!isAdmin) {
                              showToast('Ação restrita a Administradores.', 'error');
                              return;
                            }
                            setEditingId(f.id);
                            setNome(f.nome);
                            setCnpj(f.cnpj || '');
                            setCidade(f.cidade || '');
                            setShowFormModal(true);
                          }}
                          disabled={!isAdmin}
                          className={`p-1 rounded ${!isAdmin ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-blue-50'}`}
                          title={!isAdmin ? 'Restrito a Administradores' : 'Editar'}
                        >
                          <span className="material-symbols-outlined text-base">edit</span>
                        </button>
                        <button
                          onClick={() => {
                            if (!isAdmin) {
                              showToast('Ação restrita a Administradores.', 'error');
                              return;
                            }
                            toggleFornecedorActive(f.id);
                          }}
                          disabled={!isAdmin}
                          className={`p-1 rounded ${!isAdmin ? 'text-gray-300 cursor-not-allowed' : f.ativo ? 'text-amber-600' : 'text-emerald-600'}`}
                          title={!isAdmin ? 'Restrito a Administradores' : f.ativo ? 'Desativar' : 'Ativar'}
                        >
                          <span className="material-symbols-outlined text-base">
                            {f.ativo ? 'block' : 'check_circle'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'BANCOS' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
              Contas Bancárias & Caixas
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {bancos
                .filter((banco) => selectedUnit === 'Todas as Unidades' || banco.unidade === selectedUnit)
                .map((b) => (
                <div key={b.id} className="p-4 bg-[#eff4ff] border border-[#d3e4fe] rounded-xl flex justify-between items-start">
                  <div>
                    <h4 className="text-xs font-bold text-[#0b1c30]">{b.banco}</h4>
                    <p className="text-[11px] text-gray-600 font-mono mt-0.5">Ag: {b.agencia} • C/C: {b.conta}</p>
                    <p className="text-[10px] font-bold text-blue-700 mt-1">{b.unidade}</p>
                    <p className="text-[10px] text-gray-500 mt-2">Saldo atual</p>
                    <p className="text-sm font-black text-emerald-800 mt-2">
                      R$ {b.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!isAdmin) {
                        showToast('Ação restrita a Administradores.', 'error');
                        return;
                      }
                      setEditingId(b.id);
                      setNome(b.banco);
                      setAgencia(b.agencia);
                      setConta(b.conta);
                      setSaldo(b.saldo.toString());
                      setBancoUnidade(b.unidade);
                      setShowFormModal(true);
                    }}
                    disabled={!isAdmin}
                    className={`p-1 rounded ${!isAdmin ? 'text-gray-300 cursor-not-allowed' : 'text-blue-600 hover:bg-white'}`}
                    title={!isAdmin ? 'Restrito a Administradores' : 'Editar conta e ajustar saldo'}
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'CONDICOES_PAGAMENTO' && (
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
              Tabela de Condições de Pagamento e Prazos DDL (Dias A/DF)
            </h3>
            <div className="border border-gray-200 rounded-lg overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-[#f8f9ff] text-gray-700 font-bold uppercase text-[10px]">
                  <tr>
                    <SortableTableHeader label="Nome / Descrição DDL" sortKey="nome" accessor={(item) => item.nome} sortConfig={condicoesSort.sortConfig} onSort={condicoesSort.requestSort} className="p-3" />
                    <SortableTableHeader label="Prazos em Dias (DDL)" sortKey="prazo" accessor={(item) => item.prazosDias[0] ?? 0} sortConfig={condicoesSort.sortConfig} onSort={condicoesSort.requestSort} className="p-3" />
                    <SortableTableHeader label="Nº Parcelas" sortKey="parcelas" accessor={(item) => item.prazosDias.length} sortConfig={condicoesSort.sortConfig} onSort={condicoesSort.requestSort} className="p-3 text-center" />
                    <SortableTableHeader label="Status" sortKey="status" accessor={(item) => item.ativa} sortConfig={condicoesSort.sortConfig} onSort={condicoesSort.requestSort} className="p-3 text-center" />
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {condicoesSort.sortedItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-[#0b1c30]">{item.nome}</td>
                      <td className="p-3 font-mono font-bold text-blue-800">
                        {item.prazosDias.join(' / ')} dias
                      </td>
                      <td className="p-3 text-center">
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 font-extrabold rounded-full text-[10px]">
                          {item.prazosDias.length}x boleto(s)
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.ativa ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {item.ativa ? 'ATIVA' : 'INATIVA'}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => toggleCondicaoPagamentoActive(item.id)}
                          className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-[10px] font-bold"
                        >
                          {item.ativa ? 'Desativar' : 'Ativar'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Modal Add / Edit */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-[#0b1c30] text-white px-6 py-4 flex items-center justify-between">
              <h3 className="font-bold text-sm">
                {editingId ? 'Editar Cadastro' : 'Novo Cadastro'}
              </h3>
              <button onClick={() => setShowFormModal(false)} className="text-gray-400 hover:text-white">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-3">
              {activeTab === 'PLANO_CONTAS' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Código DRE (Ex: 1.01 ou 2.05)</label>
                    <input
                      type="text"
                      required
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nome da Conta</label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo</label>
                    <select
                      value={tipo}
                      onChange={(e) => setTipo(e.target.value as any)}
                      className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e] bg-white"
                    >
                      <option value="RECEITA">RECEITA</option>
                      <option value="DESPESA">DESPESA</option>
                    </select>
                  </div>
                </>
              )}

              {activeTab === 'CENTROS_CUSTO' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Código (Ex: CC-05)</label>
                    <input
                      type="text"
                      required
                      value={codigo}
                      onChange={(e) => setCodigo(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do Centro de Custo</label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Responsável</label>
                    <input
                      type="text"
                      value={responsavel}
                      onChange={(e) => setResponsavel(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                    />
                  </div>
                </>
              )}

              {activeTab === 'FORNECEDORES' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Razão Social / Nome</label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">CNPJ / CPF</label>
                    <input
                      type="text"
                      value={cnpj}
                      onChange={(e) => setCnpj(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Cidade / UF</label>
                    <input
                      type="text"
                      value={cidade}
                      onChange={(e) => setCidade(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                    />
                  </div>
                </>
              )}

              {activeTab === 'BANCOS' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Unidade / Filial <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={bancoUnidade}
                      onChange={(e) => setBancoUnidade(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e] bg-white"
                    >
                      <option value="" disabled>Selecione a unidade...</option>
                      {units.filter((unit) => unit.ativa && unit.id !== 'all').map((unit) => (
                        <option key={unit.id} value={unit.nome}>{unit.nome} ({unit.cidade})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Nome do Banco / Caixa</label>
                    <input
                      type="text"
                      required
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Agência</label>
                      <input
                        type="text"
                        value={agencia}
                        onChange={(e) => setAgencia(e.target.value)}
                        className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">Conta</label>
                      <input
                        type="text"
                        value={conta}
                        onChange={(e) => setConta(e.target.value)}
                        className="w-full px-3 py-2 border rounded text-xs focus:ring-2 focus:ring-[#131b2e]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      {editingId ? 'Saldo atual / ajuste manual (R$)' : 'Saldo inicial (R$)'}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={saldo}
                      onChange={(e) => setSaldo(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs font-bold focus:ring-2 focus:ring-[#131b2e]"
                    />
                    <span className="text-[10px] text-gray-500 mt-1 block">
                      Entradas pagas somam e saídas pagas subtraem automaticamente. Ajustes manuais ficam no histórico de auditoria.
                    </span>
                  </div>
                </>
              )}

              {activeTab === 'CONDICOES_PAGAMENTO' && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Nome da Condição (Ex: 30/60/90 Dias DDL)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: Faturado 30/60/90 DDL"
                      value={nome}
                      onChange={(e) => setNome(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#131b2e]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Prazos em Dias (separados por vírgula)
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ex: 30, 60, 90"
                      value={prazosDiasStr}
                      onChange={(e) => setPrazosDiasStr(e.target.value)}
                      className="w-full px-3 py-2 border rounded text-xs font-mono font-bold text-blue-900 focus:ring-2 focus:ring-[#131b2e]"
                    />
                    <span className="text-[10px] text-gray-500 mt-1 block">
                      Insira o número de dias após a emissão da NF para cada boleto. Ex: 0 (A Vista), 30 (30 DDL), 30, 60, 90 (3 parcelas).
                    </span>
                  </div>
                </>
              )}

              <div className="pt-4 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowFormModal(false)}
                  className="px-4 py-2 border rounded text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#131b2e] text-white rounded text-xs font-bold hover:bg-[#0b1c30]"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
