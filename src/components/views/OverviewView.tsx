import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

export const OverviewView: React.FC = () => {
  const {
    lancamentos,
    filteredLancamentos,
    documentosOCR,
    sessaoCaixa,
    selectedUnit,
    selectedMonthYear,
    setCurrentView,
    setSelectedDocumentForReviewId,
    canExecuteFinancialActions
  } = useApp();

  const totalReceitas = filteredLancamentos
    .filter((l) => l.tipo === 'RECEITA')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const totalDespesas = filteredLancamentos
    .filter((l) => l.tipo === 'DESPESA')
    .reduce((acc, curr) => acc + curr.valor, 0);

  const resultadoOperacional = totalReceitas - totalDespesas;
  const margemOperacional = totalReceitas > 0 ? (resultadoOperacional / totalReceitas) * 100 : 0;

  const pendingOCRDocs = documentosOCR.filter((d) => d.status === 'PENDENTE_REVISAO');

  // Chart data
  const chartData = [
    { mes: 'Jan', Receitas: 112000, Despesas: 84000 },
    { mes: 'Fev', Receitas: 118000, Despesas: 89000 },
    { mes: 'Mar', Receitas: 125000, Despesas: 92000 },
    { mes: 'Abr', Receitas: 128000, Despesas: 95400 },
    { mes: 'Mai (Atual)', Receitas: totalReceitas, Despesas: totalDespesas }
  ];

  const categoryPieData = [
    { name: 'Insumos Médicos', value: 28900, color: '#131b2e' },
    { name: 'Pessoal & Encargos', value: 28400, color: '#C5A059' },
    { name: 'Ocupação/Aluguel', value: 12500, color: '#003366' },
    { name: 'Marketing & Ads', value: 6800, color: '#94a3b8' },
    { name: 'Outras Despesas', value: 4450, color: '#cbd5e1' }
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner / Welcome & Quick Action */}
      <div className="bg-gradient-to-r from-[#0b1c30] via-[#131b2e] to-[#0f243d] rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#C5A059]/10 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-gray-300 text-xs">Royal Face Estética Facial</span>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
              Painel de Controle Financeiro & DRE Gerencial
            </h2>
            <p className="text-xs text-gray-300 mt-1 max-w-xl">
              Acompanhamento de fluxo de caixa, validação automática de notas via OCR, conciliação e apuração de DRE.
            </p>
          </div>

          {canExecuteFinancialActions && <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentView('pending_review')}
              className="px-4 py-2 bg-[#C5A059] text-white rounded-lg text-xs font-bold hover:bg-[#b08d46] transition flex items-center gap-1.5 shadow-md"
            >
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              Revisar Fila OCR ({pendingOCRDocs.length})
            </button>
          </div>}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Receitas */}
        <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#45464d] uppercase tracking-wider">
              Receitas Brutas
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">trending_up</span>
            </div>
          </div>
          <p className="text-2xl font-black text-[#0b1c30]">
            R$ {totalReceitas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center text-[11px] text-emerald-700 font-semibold">
            <span className="material-symbols-outlined text-sm mr-0.5">arrow_upward</span>
            +11,3% vs mês anterior
          </div>
        </div>

        {/* Despesas */}
        <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#45464d] uppercase tracking-wider">
              Despesas Operacionais
            </span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">trending_down</span>
            </div>
          </div>
          <p className="text-2xl font-black text-[#0b1c30]">
            R$ {totalDespesas.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center text-[11px] text-rose-700 font-semibold">
            <span className="material-symbols-outlined text-sm mr-0.5">arrow_downward</span>
            Dentro do orçamento previsto
          </div>
        </div>

        {/* Resultado Operacional / EBITDA */}
        <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#45464d] uppercase tracking-wider">
              Lucro Líquido
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-xl">account_balance_wallet</span>
            </div>
          </div>
          <p className="text-2xl font-black text-[#0b1c30]">
            R$ {resultadoOperacional.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="mt-2 flex items-center text-[11px] text-blue-700 font-semibold">
            <span>Margem Líquida: </span>
            <span className="ml-1 px-1.5 py-0.2 bg-blue-100 rounded text-blue-900 font-bold">
              {margemOperacional.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Status Caixa Físico */}
        <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs hover:shadow-md transition">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[#45464d] uppercase tracking-wider">
              Caixa Físico Recepção
            </span>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                sessaoCaixa.status === 'ABERTO'
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {sessaoCaixa.status}
            </span>
          </div>
          <p className="text-2xl font-black text-[#0b1c30]">
            R$ {sessaoCaixa.saldoEsperado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-[11px] text-gray-500 mt-2">
            Entradas em Dinheiro: R$ {sessaoCaixa.entradasDinheiro.toFixed(2)}
          </p>
        </div>
      </div>

      {/* OCR & Excel Import Action Banners */}
      {canExecuteFinancialActions && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pendingOCRDocs.length > 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-lg">
                <span className="material-symbols-outlined text-2xl">document_scanner</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900">
                  {pendingOCRDocs.length} Documentos na Fila de Conferência OCR
                </h4>
                <p className="text-[11px] text-amber-700">
                  Último arquivo: {pendingOCRDocs[0].nomeArquivo} ({pendingOCRDocs[0].confiancaOCR}% confiança)
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedDocumentForReviewId(pendingOCRDocs[0].id);
                setCurrentView('pending_review');
              }}
              className="px-3 py-1.5 bg-amber-700 text-white text-xs font-bold rounded-md hover:bg-amber-800 transition"
            >
              Conferir Lado a Lado
            </button>
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-100 text-emerald-800 rounded-lg">
                <span className="material-symbols-outlined text-2xl">task_alt</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-900">Fila OCR Concluída</h4>
                <p className="text-[11px] text-emerald-700">Nenhum documento aguardando auditoria no momento.</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-blue-900 via-[#131b2e] to-blue-950 text-white border border-blue-800 rounded-xl p-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#C5A059]/20 text-[#C5A059] rounded-lg">
              <span className="material-symbols-outlined text-2xl">table_chart</span>
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Importar Planilha / Dados Históricos</h4>
              <p className="text-[11px] text-gray-300">Alimente o sistema com lançamentos em lote via Excel/CSV.</p>
            </div>
          </div>
          <button
            onClick={() => setCurrentView('import_excel')}
            className="px-3 py-1.5 bg-[#C5A059] text-white text-xs font-bold rounded-md hover:bg-[#b08d46] transition flex items-center gap-1"
          >
            <span>Importar Excel</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>}

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart: Evolução Receitas x Despesas */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-[#0b1c30]">Evolução Mensal de Receitas vs Despesas</h3>
              <p className="text-xs text-gray-500">Valores consolidados em R$ no ano de 2024</p>
            </div>
            <span className="text-xs font-bold text-[#775a19] bg-[#ffdea5] px-2.5 py-1 rounded">
              Visão Competência
            </span>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, '']}
                  contentStyle={{ backgroundColor: '#0b1c30', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Bar dataKey="Receitas" fill="#0b1c30" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="#C5A059" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Composição das Despesas */}
        <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#0b1c30]">Distribuição de Custos por Categoria</h3>
            <p className="text-xs text-gray-500 mb-2">Principais centros de despesa do mês</p>

            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: any) => `R$ ${Number(val).toLocaleString('pt-BR')}`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="space-y-1.5 mt-2 border-t border-gray-100 pt-3">
            {categoryPieData.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }}></span>
                  <span className="text-gray-700 truncate">{cat.name}</span>
                </div>
                <span className="font-bold text-[#0b1c30]">
                  R$ {cat.value.toLocaleString('pt-BR')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Latest Entries Table Preview */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#e5eeff] flex items-center justify-between bg-[#f8f9ff]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">receipt</span>
            <h3 className="text-sm font-bold text-[#0b1c30]">Últimos Lançamentos Registrados</h3>
          </div>
          <button
            onClick={() => setCurrentView('receitas')}
            className="text-xs font-bold text-[#775a19] hover:underline flex items-center gap-1"
          >
            Ver todos os lançamentos
            <span className="material-symbols-outlined text-sm">chevron_right</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <th className="p-3">Data Venc.</th>
                <th className="p-3">Descrição</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Categoria</th>
                <th className="p-3 text-right">Valor</th>
                <th className="p-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredLancamentos.slice(0, 5).map((l) => (
                <tr key={l.id} className="hover:bg-gray-50 transition">
                  <td className="p-3 font-semibold text-gray-600">{l.dataVencimento}</td>
                  <td className="p-3 font-bold text-[#0b1c30] max-w-xs truncate">{l.descricao}</td>
                  <td className="p-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.tipo === 'RECEITA' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {l.tipo}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600">{l.categoria}</td>
                  <td
                    className={`p-3 text-right font-black ${
                      l.tipo === 'RECEITA' ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    R$ {l.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        l.status === 'PAGO'
                          ? 'bg-emerald-100 text-emerald-800'
                          : l.status === 'ATRASADO'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
