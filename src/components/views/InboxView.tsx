import React from 'react';
import { useApp } from '../../context/AppContext';

interface InboxViewProps {
  onOpenUploadModal: () => void;
}

export const InboxView: React.FC<InboxViewProps> = ({ onOpenUploadModal }) => {
  const { documentosOCR, setCurrentView, setSelectedDocumentForReviewId } = useApp();

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]">inbox</span>
            Caixa de Entrada de Documentos
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Central de recepção de arquivos fiscal e financeiro (NF-e, NFS-e, Recibos e Cupons).
          </p>
        </div>

        <button
          onClick={onOpenUploadModal}
          className="px-4 py-2 bg-[#131b2e] text-white rounded-lg text-xs font-bold hover:bg-[#0b1c30] flex items-center gap-2 transition shadow-xs"
        >
          <span className="material-symbols-outlined text-base">cloud_upload</span>
          Upload de Documento (OCR)
        </button>
      </div>

      {/* Grid of Documents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documentosOCR.map((doc) => (
          <div
            key={doc.id}
            className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-lg bg-[#eff4ff] text-[#131b2e] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-2xl">
                      {doc.tipo === 'NFE' ? 'receipt' : 'description'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#0b1c30] truncate max-w-[180px]">
                      {doc.nomeArquivo}
                    </h4>
                    <p className="text-[10px] text-gray-400">{doc.tamanho} • {doc.dataUpload}</p>
                  </div>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    doc.status === 'APROVADO'
                      ? 'bg-emerald-100 text-emerald-800'
                      : doc.status === 'REJEITADO'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {doc.status === 'PENDENTE_REVISAO' ? 'Pendente' : doc.status}
                </span>
              </div>

              {/* Extracted Data Box */}
              <div className="bg-[#f8f9ff] p-3 rounded-lg border border-[#d3e4fe] space-y-1.5 text-xs mb-4">
                <div className="flex justify-between">
                  <span className="text-gray-500">Fornecedor:</span>
                  <span className="font-bold text-[#0b1c30] truncate max-w-[150px]">
                    {doc.dadosExtraidos.fornecedor}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valor Extraído:</span>
                  <span className="font-extrabold text-[#0b1c30]">
                    R$ {doc.dadosExtraidos.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vencimento:</span>
                  <span className="font-semibold text-gray-700">{doc.dadosExtraidos.dataVencimento}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-[#d3e4fe]">
                  <span className="text-[10px] text-gray-500">Confiança do Motor OCR:</span>
                  <span className="text-[10px] font-bold text-[#775a19] bg-[#ffdea5] px-1.5 py-0.2 rounded">
                    {doc.confiancaOCR}%
                  </span>
                </div>
              </div>
            </div>

            {/* Card Footer Actions */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-[10px] text-gray-400">ID: {doc.id}</span>
              <button
                onClick={() => {
                  setSelectedDocumentForReviewId(doc.id);
                  setCurrentView('pending_review');
                }}
                className="px-3 py-1.5 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30] transition flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">find_in_page</span>
                Conferir Lado a Lado
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
