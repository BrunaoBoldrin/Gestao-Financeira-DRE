import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface UploadOCRModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UploadOCRModal: React.FC<UploadOCRModalProps> = ({ isOpen, onClose }) => {
  const { uploadDocumentoOCR, setCurrentView } = useApp();
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadDocumentoOCR(e.target.files[0]);
      onClose();
      setCurrentView('pending_review');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadDocumentoOCR(e.dataTransfer.files[0]);
      onClose();
      setCurrentView('pending_review');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-[#0b1c30] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]">cloud_upload</span>
            <h3 className="font-bold text-base">Importação & Leitura OCR de Notas</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6">
          <p className="text-xs text-gray-600 mb-4">
            Envie arquivos PDF, XML ou Imagens (NF-e, NFS-e, Recibos ou Cupons). O motor OCR fará a extração automática dos dados para conferência lado a lado.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 text-center transition flex flex-col items-center justify-center cursor-pointer ${
              dragActive
                ? 'border-[#C5A059] bg-[#eff4ff]'
                : 'border-gray-300 bg-[#f8f9ff] hover:border-[#131b2e]'
            }`}
          >
            <span className="material-symbols-outlined text-4xl text-[#C5A059] mb-2">upload_file</span>
            <p className="text-xs font-bold text-[#0b1c30] mb-1">
              Arraste e solte seus comprovantes ou notas fiscais aqui
            </p>
            <p className="text-[11px] text-gray-500 mb-4">Suporta PDF, PNG, JPG, XML até 20MB</p>

            <label className="px-4 py-2 bg-[#131b2e] text-white rounded-md text-xs font-bold hover:bg-[#0b1c30] cursor-pointer shadow-xs transition">
              <span>Selecionar Arquivo</span>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.xml"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2.5">
            <span className="material-symbols-outlined text-blue-600 text-lg shrink-0 mt-0.5">auto_awesome</span>
            <p className="text-[11px] text-blue-800 leading-relaxed">
              <strong>Regra Inteligente:</strong> Documentos com grau de confiança superior a 95% e fornecedor reconhecido no cadastro aplicam categorização automática instantânea.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
