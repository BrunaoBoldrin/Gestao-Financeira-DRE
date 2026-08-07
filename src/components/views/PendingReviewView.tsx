import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';

export const PendingReviewView: React.FC = () => {
  const {
    documentosOCR,
    selectedDocumentForReviewId,
    setSelectedDocumentForReviewId,
    aprovarDocumentoOCR,
    rejeitarDocumentoOCR,
    addLancamentoComDDL,
    condicoesPagamento,
    setCurrentView,
    showToast,
    selectedUnit
  } = useApp();

  const pendingDocs = documentosOCR.filter((d) => d.status === 'PENDENTE_REVISAO');

  const currentDoc =
    documentosOCR.find((d) => d.id === selectedDocumentForReviewId) ||
    pendingDocs[0] ||
    documentosOCR[0];

  const [fornecedor, setFornecedor] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [dataEmissao, setDataEmissao] = useState('');
  const [dataVencimento, setDataVencimento] = useState('');
  const [valorTotal, setValorTotal] = useState('');
  const [categoria, setCategoria] = useState('');
  const [centroCusto, setCentroCusto] = useState('');
  const [selectedCondicaoId, setSelectedCondicaoId] = useState<string>('cond-3'); // 30 dias default
  const [observacoes, setObservacoes] = useState('');

  useEffect(() => {
    if (currentDoc) {
      setFornecedor(currentDoc.dadosExtraidos.fornecedor || '');
      setCnpj(currentDoc.dadosExtraidos.cnpj || '');
      setDataEmissao(currentDoc.dadosExtraidos.dataEmissao || new Date().toISOString().substring(0, 10));
      setDataVencimento(currentDoc.dadosExtraidos.dataVencimento || new Date().toISOString().substring(0, 10));
      setValorTotal(currentDoc.dadosExtraidos.valorTotal ? currentDoc.dadosExtraidos.valorTotal.toString() : '0');
      setCategoria(currentDoc.dadosExtraidos.categoria || 'Insumos Médicos & Estéticos');
      setCentroCusto(currentDoc.dadosExtraidos.centroCusto || 'Clínica / Atendimento');
      setObservacoes(currentDoc.dadosExtraidos.observacoes || '');
    }
  }, [currentDoc?.id]);

  if (!currentDoc || currentDoc.status !== 'PENDENTE_REVISAO') {
    return (
      <div className="p-12 text-center bg-white rounded-xl border border-[#e5eeff] shadow-xs max-w-lg mx-auto my-10 space-y-4">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
          <span className="material-symbols-outlined text-3xl">task_alt</span>
        </div>
        <div>
          <h3 className="text-lg font-bold text-[#0b1c30]">Fila de OCR Concluída!</h3>
          <p className="text-xs text-gray-500 mt-1">
            Nenhum documento pendente de revisão ou auditoria no momento.
          </p>
        </div>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => setCurrentView('inbox')}
            className="px-4 py-2 bg-[#131b2e] text-white text-xs font-bold rounded-lg hover:bg-[#0b1c30] transition"
          >
            Ir para Caixa de Entrada
          </button>
          <button
            onClick={() => setCurrentView('despesas')}
            className="px-4 py-2 border border-gray-300 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-50 transition"
          >
            Ver Lançamentos de Despesas
          </button>
        </div>
      </div>
    );
  }

  const numVal = parseFloat(valorTotal) || 0;
  const activeCond = condicoesPagamento.find((c) => c.id === selectedCondicaoId) || condicoesPagamento[0];
  const prazos = activeCond ? activeCond.prazosDias : [0];

  const advanceToNextDoc = () => {
    const remaining = pendingDocs.filter((d) => d.id !== currentDoc.id);
    if (remaining.length > 0) {
      setSelectedDocumentForReviewId(remaining[0].id);
    } else {
      setSelectedDocumentForReviewId(null);
    }
  };

  const handleAprovar = () => {
    aprovarDocumentoOCR(currentDoc.id, {
      fornecedor,
      cnpj,
      dataEmissao,
      dataVencimento,
      valorTotal: numVal,
      categoria,
      centroCusto,
      observacoes
    });

    // Create DDL expense entries automatically
    addLancamentoComDDL(
      {
        descricao: `${currentDoc.nomeArquivo} - ${fornecedor}`,
        tipo: 'DESPESA',
        categoria: categoria || 'Insumos Médicos & Estéticos',
        centroCusto: centroCusto || 'Clínica / Atendimento',
        valor: numVal,
        dataVencimento: dataVencimento || dataEmissao,
        status: 'PENDENTE',
        fornecedorCliente: fornecedor || 'Fornecedor Diverso',
        contaBancaria: 'Itaú Uniclass - C/C 45892-1',
        formaPagamento: 'BOLETO',
        unidade: selectedUnit === 'Todas as Unidades' ? 'Royal Face - Matriz' : selectedUnit
      },
      dataEmissao || new Date().toISOString().substring(0, 10),
      prazos
    );

    advanceToNextDoc();
  };

  const handleRejeitar = () => {
    rejeitarDocumentoOCR(currentDoc.id);
    showToast(`Documento "${currentDoc.nomeArquivo}" rejeitado e removido da fila.`, 'info');
    advanceToNextDoc();
  };

  return (
    <div className="space-y-4">
      {/* Top Document Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#e5eeff] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[#C5A059] text-2xl">rule</span>
          <div>
            <h2 className="text-base font-bold text-[#0b1c30]">
              Auditoria e Conferência OCR Lado a Lado
            </h2>
            <p className="text-xs text-gray-500">
              Verifique os dados extraídos pelo OCR em paralelo com a imagem/PDF original do documento.
            </p>
          </div>
        </div>

        {/* Document Selector Pills */}
        <div className="flex items-center gap-2 overflow-x-auto max-w-md">
          {documentosOCR.map((doc) => (
            <button
              key={doc.id}
              onClick={() => setSelectedDocumentForReviewId(doc.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                doc.id === currentDoc.id
                  ? 'bg-[#131b2e] text-white shadow-xs'
                  : 'bg-[#f8f9ff] text-gray-700 hover:bg-[#e5eeff]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {doc.status === 'APROVADO' ? 'check_circle' : 'pending'}
              </span>
              <span className="truncate max-w-[100px]">{doc.nomeArquivo}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Split View Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Image/PDF Viewer */}
        <div className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-gray-500">visibility</span>
                <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
                  Documento Original ({currentDoc.nomeArquivo})
                </h3>
              </div>

              <span className="text-[10px] font-bold text-[#775a19] bg-[#ffdea5] px-2 py-0.5 rounded">
                Score OCR: {currentDoc.confiancaOCR}% Confiança
              </span>
            </div>

            <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-100 min-h-[420px] flex items-center justify-center group">
              <img
                src={currentDoc.previewUrl}
                alt={currentDoc.nomeArquivo}
                className="w-full h-[420px] object-cover object-top filter contrast-105"
              />
              <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                <a
                  href={currentDoc.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-white text-[#0b1c30] rounded-md text-xs font-bold shadow-lg flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  Abrir em Nova Aba
                </a>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-gray-100 text-[11px] text-gray-500 flex justify-between">
            <span>Formato: {currentDoc.tipo}</span>
            <span>Data Upload: {currentDoc.dataUpload}</span>
          </div>
        </div>

        {/* Right Column: Extracted Form Data for Review */}
        <div className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#C5A059]">edit_note</span>
                <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
                  Campos Extraídos pelo Motor OCR
                </h3>
              </div>
              <span
                className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                  currentDoc.status === 'APROVADO'
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {currentDoc.status}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                  Razão Social / Fornecedor
                </label>
                <input
                  type="text"
                  value={fornecedor}
                  onChange={(e) => setFornecedor(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs font-bold text-[#0b1c30] focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">CNPJ Fornecedor</label>
                <input
                  type="text"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs font-mono focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Valor Total (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorTotal}
                  onChange={(e) => setValorTotal(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs font-black text-rose-700 focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Data de Emissão (Boleto/NF)</label>
                <input
                  type="date"
                  value={dataEmissao}
                  onChange={(e) => setDataEmissao(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs font-semibold focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
                />
              </div>
            </div>

            {/* DDL Condition selector and live preview */}
            <div className="bg-[#f8f9ff] border border-[#C5A059]/40 p-3 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#0b1c30] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[#C5A059] text-base">event_note</span>
                  Condição de Pagamento (DDL)
                </label>
                {numVal > 0 && prazos.length > 1 && (
                  <span className="text-[10px] font-extrabold text-[#775a19] bg-[#ffdea5] px-2 py-0.5 rounded">
                    Faturado em {prazos.length} parcelas DDL
                  </span>
                )}
              </div>

              <select
                value={selectedCondicaoId}
                onChange={(e) => setSelectedCondicaoId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-[#d3e4fe] rounded-md text-xs font-bold text-[#0b1c30] bg-white focus:ring-2 focus:ring-[#131b2e]"
              >
                {condicoesPagamento.filter((c) => c.ativa).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>

              {/* Calculated Boletos List */}
              {numVal > 0 && prazos.length > 0 && (
                <div className="pt-1 space-y-1">
                  <span className="text-[10px] text-gray-500 font-medium block">
                    Vencimentos calculados pelo sistema:
                  </span>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {prazos.map((dias, idx) => {
                      const dt = new Date((dataEmissao || new Date().toISOString().substring(0, 10)) + 'T12:00:00');
                      dt.setDate(dt.getDate() + dias);
                      const dtFormatted = dt.toLocaleDateString('pt-BR');
                      const valPart = (numVal / prazos.length);

                      return (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-white px-2 py-1 rounded border border-gray-200 text-[11px]"
                        >
                          <span className="font-medium text-gray-700">
                            Boleto {idx + 1}/{prazos.length} ({dias} dias DDL)
                          </span>
                          <span className="font-bold text-[#0b1c30]">
                            R$ {valPart.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} &bull; Venc: {dtFormatted}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Categoria DRE</label>
                <select
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white font-semibold"
                >
                  <option value="Insumos Médicos & Estéticos">Insumos Médicos & Estéticos</option>
                  <option value="Serviços Terceirizados">Serviços Terceirizados</option>
                  <option value="Ocupação & Infraestrutura">Ocupação & Infraestrutura</option>
                  <option value="Marketing & Publicidade">Marketing & Publicidade</option>
                  <option value="Energia / Água / Telecom">Energia / Água / Telecom</option>
                  <option value="Aluguel & Imóveis">Aluguel & Imóveis</option>
                  <option value="Impostos & Taxas">Impostos & Taxas</option>
                  <option value="Manutenção & Equipamentos">Manutenção & Equipamentos</option>
                  <option value="Softwares & Sistemas">Softwares & Sistemas</option>
                  <option value="Despesas Operacionais">Despesas Operacionais</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Centro de Custo</label>
                <select
                  value={centroCusto}
                  onChange={(e) => setCentroCusto(e.target.value)}
                  className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white font-semibold"
                >
                  <option value="Estoque Central">Estoque Central</option>
                  <option value="Clínica / Atendimento">Clínica / Atendimento</option>
                  <option value="Administrativo">Administrativo</option>
                  <option value="TI & Sistemas">TI & Sistemas</option>
                  <option value="Marketing & Vendas">Marketing & Vendas</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1 flex items-center justify-between">
                <span>Observações / Notas da Auditoria OCR</span>
                <span className="text-[10px] text-gray-400 font-normal">Informações adicionais para o financeiro</span>
              </label>
              <textarea
                rows={2}
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Ex: Pagamento com 5% de desconto até dia 10; Autorizado por Dra. Mariana..."
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white font-medium"
              />
            </div>

            {/* Extracted Items Table if present */}
            {currentDoc.dadosExtraidos.itens && currentDoc.dadosExtraidos.itens.length > 0 && (
              <div className="mt-3">
                <label className="block text-[11px] font-semibold text-gray-700 mb-1">Itens de Produto Extraídos</label>
                <div className="border border-gray-200 rounded-lg overflow-hidden text-[11px]">
                  <table className="w-full text-left">
                    <thead className="bg-[#f8f9ff] text-gray-600 font-bold">
                      <tr>
                        <th className="p-2">Item</th>
                        <th className="p-2 text-center">Qtd</th>
                        <th className="p-2 text-right">Unitário</th>
                        <th className="p-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {currentDoc.dadosExtraidos.itens.map((item, idx) => (
                        <tr key={idx}>
                          <td className="p-2 text-gray-800">{item.descricao}</td>
                          <td className="p-2 text-center font-bold">{item.quantidade}</td>
                          <td className="p-2 text-right">R$ {item.valorUnitario.toFixed(2)}</td>
                          <td className="p-2 text-right font-bold text-[#0b1c30]">
                            R$ {item.valorTotal.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
            <button
              onClick={handleRejeitar}
              className="px-4 py-2 border border-rose-300 text-rose-700 rounded-md text-xs font-bold hover:bg-rose-50 transition flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-base">cancel</span>
              Rejeitar Documento
            </button>

            <button
              onClick={handleAprovar}
              className="px-6 py-2.5 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30] transition flex items-center gap-1.5 shadow-md"
            >
              <span className="material-symbols-outlined text-base">task_alt</span>
              Aprovar & Gerar Lançamento Financeiro
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
