import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { SortableTableHeader } from '../common/SortableTableHeader';
import { useSortableData } from '../../hooks/useSortableData';
import { normalizeDateValue } from '../../utils/dateRange';

export const DocumentosView: React.FC = () => {
  const { documentosOCR, showToast } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredDocs = documentosOCR.filter(
    (d) =>
      d.nomeArquivo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.dadosExtraidos.fornecedor.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const { sortedItems: sortedDocs, sortConfig, requestSort } = useSortableData(filteredDocs);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]">folder_open</span>
            GED - Central de Documentos & Comprovantes Fiscais
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Repositório digital com controle de versão, integridade via hash MD5/SHA256 e busca de metadados.
          </p>
        </div>

        <div className="relative w-72">
          <span className="material-symbols-outlined text-gray-400 absolute left-2.5 top-2.5 text-lg">
            search
          </span>
          <input
            type="text"
            placeholder="Buscar por arquivo ou fornecedor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-[#f8f9ff] border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
          />
        </div>
      </div>

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
        <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff]">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
            Arquivos Armazenados no Servidor Seguro
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                <SortableTableHeader label="Nome do Arquivo" sortKey="arquivo" accessor={(item) => item.nomeArquivo} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Tipo" sortKey="tipo" accessor={(item) => item.tipo} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Fornecedor" sortKey="fornecedor" accessor={(item) => item.dadosExtraidos.fornecedor} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Data Upload" sortKey="data" accessor={(item) => normalizeDateValue(item.dataUpload)} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Hash MD5 Integridade" sortKey="hash" accessor={(item) => item.id} sortConfig={sortConfig} onSort={requestSort} className="p-3" />
                <SortableTableHeader label="Valor Extraído" sortKey="valor" accessor={(item) => item.dadosExtraidos.valorTotal} sortConfig={sortConfig} onSort={requestSort} className="p-3 text-right" />
                <th className="p-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedDocs.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition">
                  <td className="p-3 font-bold text-[#0b1c30] flex items-center gap-2">
                    <span className="material-symbols-outlined text-gray-400">description</span>
                    <span>{doc.nomeArquivo}</span>
                  </td>
                  <td className="p-3">
                    <span className="bg-[#f8f9ff] text-gray-700 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                      {doc.tipo}
                    </span>
                  </td>
                  <td className="p-3 text-gray-700">{doc.dadosExtraidos.fornecedor}</td>
                  <td className="p-3 font-mono text-gray-500">{doc.dataUpload}</td>
                  <td className="p-3 font-mono text-[10px] text-gray-400">
                    e99a18c428cb38d5f260853678922e03
                  </td>
                  <td className="p-3 text-right font-black text-[#0b1c30]">
                    R$ {doc.dadosExtraidos.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="p-3 text-center">
                    <a
                      href={doc.previewUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 bg-[#131b2e] text-white rounded text-[11px] font-bold hover:bg-[#0b1c30] transition inline-flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-sm">download</span>
                      Download
                    </a>
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
