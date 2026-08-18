import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';
import { calculateDueDateSchedule } from '../../utils/financialDates';

export const PendingReviewView: React.FC = () => {
  const {
    documentosOCR,
    selectedDocumentForReviewId,
    setSelectedDocumentForReviewId,
    aprovarDocumentoOCR,
    rejeitarDocumentoOCR,
    addLancamentoComDDL,
    condicoesPagamento,
    bancos,
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
  const [bancoId, setBancoId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const itensSort = useSortableData(currentDoc?.dadosExtraidos.itens || []);

  useEffect(() => {
    if (currentDoc) {
      const extractedIssueDate = currentDoc.dadosExtraidos.dataEmissao || new Date().toISOString().substring(0, 10);
      const initialCondition = condicoesPagamento.find((condition) => condition.id === selectedCondicaoId) || condicoesPagamento[0];
      const suggestedDueDate = calculateDueDateSchedule(
        extractedIssueDate,
        initialCondition?.prazosDias || [0]
      )[0];
      setFornecedor(currentDoc.dadosExtraidos.fornecedor || '');
      setCnpj(currentDoc.dadosExtraidos.cnpj || '');
      setDataEmissao(extractedIssueDate);
      setDataVencimento(currentDoc.dadosExtraidos.dataVencimento || suggestedDueDate);
      setValorTotal(currentDoc.dadosExtraidos.valorTotal ? currentDoc.dadosExtraidos.valorTotal.toString() : '0');
      setCategoria(currentDoc.dadosExtraidos.categoria || 'Insumos Médicos & Estéticos');
      setCentroCusto(currentDoc.dadosExtraidos.centroCusto || 'Clínica / Atendimento');
      setObservacoes(currentDoc.dadosExtraidos.observacoes || '');
    }
  }, [currentDoc?.id, currentDoc?.status]);

  const unidadeLancamento = selectedUnit === 'Todas as Unidades' ? 'Royal Face - Matriz' : selectedUnit;
  const availableBanks = bancos.filter(
    (banco) => banco.ativo && banco.unidade === unidadeLancamento
  );

  useEffect(() => {
    if (!availableBanks.some((banco) => banco.id === bancoId)) {
      setBancoId(availableBanks[0]?.id || '');
    }
  }, [unidadeLancamento, bancos, bancoId]);

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
  const vencimentos = calculateDueDateSchedule(dataEmissao, prazos, dataVencimento);
  const vencimentoCalculadoDDL = calculateDueDateSchedule(dataEmissao, prazos)[0];
  const isPdfPreview = Boolean(currentDoc.previewUrl) && currentDoc.previewMimeType === 'application/pdf';
  const isImagePreview = Boolean(currentDoc.previewUrl) && (
    currentDoc.previewMimeType?.startsWith('image/') || !currentDoc.previewMimeType
  );

  const advanceToNextDoc = () => {
    const remaining = pendingDocs.filter((d) => d.id !== currentDoc.id);
    if (remaining.length > 0) {
      setSelectedDocumentForReviewId(remaining[0].id);
    } else {
      setSelectedDocumentForReviewId(null);
    }
  };

  const handleAprovar = () => {
    if (!dataVencimento) {
      showToast('Informe a data de vencimento antes de aprovar o documento.', 'error');
      return;
    }
    const banco = availableBanks.find((item) => item.id === bancoId);
    if (!banco) {
      showToast(`Cadastre ou selecione uma conta bancária para "${unidadeLancamento}".`, 'error');
      return;
    }
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
        bancoId: banco.id,
        contaBancaria: banco.banco,
        formaPagamento: 'BOLETO',
        unidade: unidadeLancamento,
        observacoes: observacoes || `Processado via OCR (${currentDoc.confiancaOCR}% confiança)`,
        comprovanteUrl: currentDoc.previewUrl,
        documentoRef: currentDoc.id
      },
      dataEmissao || new Date().toISOString().substring(0, 10),
      prazos,
      dataVencimento
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

            <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-100 min-h-[520px] flex items-center justify-center group">
              {isPdfPreview ? (
                <iframe
                  src={`${currentDoc.previewUrl}#view=FitH`}
                  title={`Visualização de ${currentDoc.nomeArquivo}`}
                  className="w-full h-[520px] bg-white border-0"
                />
              ) : isImagePreview ? (
                <img
                  src={currentDoc.previewUrl}
                  alt={currentDoc.nomeArquivo}
                  className="w-full h-[520px] object-contain object-top filter contrast-105 bg-white"
                />
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <span className="material-symbols-outlined text-5xl text-gray-400">description</span>
                  <p className="text-xs font-bold mt-2">Pré-visualização não disponível para este formato.</p>
                  <p className="text-[11px] mt-1">Use “Abrir em Nova Aba” para acessar o documento original.</p>
                </div>
              )}
              {currentDoc.previewUrl && (
                <a
                  href={currentDoc.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="absolute z-10 top-3 right-3 px-3 py-1.5 bg-white/95 text-[#0b1c30] rounded-md text-xs font-bold shadow-lg flex items-center gap-1 border border-gray-200 hover:bg-white"
                >
                  <span className="material-symbols-outlined text-sm">open_in_new</span>
                  Abrir em Nova Aba
                </a>
              )}
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

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">
                Conta para pagamento <span className="text-red-500">*</span>
              </label>
              <select
                value={bancoId}
                onChange={(e) => setBancoId(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] bg-white font-semibold"
              >
                <option value="" disabled>Selecione a conta...</option>
                {availableBanks.map((banco) => (
                  <option key={banco.id} value={banco.id}>{banco.banco} — {banco.unidade}</option>
                ))}
              </select>
              {availableBanks.length === 0 && (
                <p className="text-[10px] text-rose-600 mt-1">Nenhuma conta ativa cadastrada para esta unidade.</p>
              )}
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

              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
                <div>
                  <label className="block text-[10px] font-semibold text-gray-600 mb-1">
                    {prazos.length > 1 ? 'Vencimento da primeira parcela' : 'Data de vencimento'}
                  </label>
                  <input
                    type="date"
                    required
                    value={dataVencimento}
                    onChange={(e) => setDataVencimento(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-[#d3e4fe] rounded-md text-xs font-bold text-[#0b1c30] bg-white focus:ring-2 focus:ring-[#131b2e]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setDataVencimento(vencimentoCalculadoDDL)}
                  className="px-3 py-1.5 border border-[#C5A059] text-[#775a19] bg-white rounded-md text-[10px] font-bold hover:bg-[#fff8e8] transition whitespace-nowrap"
                >
                  Usar cálculo DDL
                </button>
              </div>
              <p className="text-[10px] text-gray-500">
                A data pode ser corrigida manualmente antes da aprovação.
                {prazos.length > 1 ? ' As demais parcelas manterão o intervalo definido no DDL.' : ''}
              </p>

              {/* Calculated Boletos List */}
              {numVal > 0 && prazos.length > 0 && (
                <div className="pt-1 space-y-1">
                  <span className="text-[10px] text-gray-500 font-medium block">
                    Vencimentos calculados pelo sistema:
                  </span>
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {prazos.map((dias, idx) => {
                      const dt = new Date(`${vencimentos[idx]}T12:00:00`);
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
                        <SortableTableHeader label="Item" sortKey="item" accessor={(item) => item.descricao} sortConfig={itensSort.sortConfig} onSort={itensSort.requestSort} className="p-2" />
                        <SortableTableHeader label="Qtd" sortKey="quantidade" accessor={(item) => item.quantidade} sortConfig={itensSort.sortConfig} onSort={itensSort.requestSort} className="p-2 text-center" />
                        <SortableTableHeader label="Unitário" sortKey="unitario" accessor={(item) => item.valorUnitario} sortConfig={itensSort.sortConfig} onSort={itensSort.requestSort} className="p-2 text-right" />
                        <SortableTableHeader label="Total" sortKey="total" accessor={(item) => item.valorTotal} sortConfig={itensSort.sortConfig} onSort={itensSort.requestSort} className="p-2 text-right" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {itensSort.sortedItems.map((item, idx) => (
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
