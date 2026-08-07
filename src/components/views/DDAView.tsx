import React from 'react';
import { useApp } from '../../context/AppContext';

export const DDAView: React.FC = () => {
  const { boletosDDA, marcarDDAPago, showToast } = useApp();

  const handleCopyBarcode = (code: string) => {
    navigator.clipboard.writeText(code);
    showToast('Linha digitável copiada para a área de transferência!', 'info');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-blue-600">receipt_long</span>
            DDA - Débito Direto Autorizado (Boletos no CNPJ)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Varredura automática de boletos bancários emitidos contra os CNPJs do grupo Royal Face.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-900">
          <span className="material-symbols-outlined text-blue-600 text-base">sync</span>
          <span>CIP Conectada • Varredura Ativa</span>
        </div>
      </div>

      {/* DDA Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boletosDDA.map((boleto) => (
          <div
            key={boleto.id}
            className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    CNPJ: {boleto.cnpjCedente}
                  </span>
                  <h4 className="text-xs font-bold text-[#0b1c30] line-clamp-1 mt-0.5">
                    {boleto.cedente}
                  </h4>
                </div>

                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    boleto.status === 'PAGO'
                      ? 'bg-emerald-100 text-emerald-800'
                      : boleto.status === 'VINCULADO'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {boleto.status}
                </span>
              </div>

              {/* Value and due date */}
              <div className="p-3 bg-[#f8f9ff] rounded-lg border border-[#d3e4fe] space-y-1 mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">Valor do Boleto:</span>
                  <span className="text-base font-black text-[#0b1c30]">
                    R$ {boleto.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-gray-500">Data Vencimento:</span>
                  <span className="font-bold text-rose-700">{boleto.dataVencimento}</span>
                </div>
                <div className="flex justify-between items-center text-[11px] pt-1 border-t border-[#d3e4fe]">
                  <span className="text-gray-500">Sugestão Categoria:</span>
                  <span className="font-semibold text-gray-800">{boleto.categoriaSugerida}</span>
                </div>
              </div>

              {/* Barcode block */}
              <div className="bg-gray-50 p-2 rounded border border-gray-200 text-[10px] font-mono text-gray-600 break-all mb-4 flex items-center justify-between">
                <span className="truncate pr-2">{boleto.codigoBarras}</span>
                <button
                  onClick={() => handleCopyBarcode(boleto.codigoBarras)}
                  className="text-blue-600 hover:text-blue-800 font-sans font-bold shrink-0 flex items-center gap-0.5"
                  title="Copiar Linha Digitável"
                >
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-end gap-2">
              {boleto.status !== 'PAGO' ? (
                <button
                  onClick={() => marcarDDAPago(boleto.id)}
                  className="w-full py-2 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30] transition flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <span className="material-symbols-outlined text-sm">payments</span>
                  Autorizar & Pagar Boleto
                </button>
              ) : (
                <div className="w-full text-center py-1.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Boleto Liquidado
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
