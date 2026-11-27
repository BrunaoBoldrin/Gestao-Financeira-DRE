import { ModalOverlay } from '../common/ModalOverlay';
import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

const photoExtensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png'
};

interface UploadOCRModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UploadOCRModal: React.FC<UploadOCRModalProps> = ({ isOpen, onClose }) => {
  const { uploadDocumentoOCR, setCurrentView, showToast } = useApp();
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  const processFiles = (files: File[]) => {
    const validFiles = files.filter((file) => {
      const extension = file.name.toLowerCase().split('.').pop();
      if (!extension || !['pdf', 'png', 'jpg', 'jpeg', 'xml'].includes(extension)) {
        showToast(`Formato inválido em "${file.name}". Envie PDF, PNG, JPG, JPEG ou XML.`, 'error');
        return false;
      }
      if (file.size > 15 * 1024 * 1024) {
        showToast(`O arquivo "${file.name}" deve ter no máximo 15 MB.`, 'error');
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    validFiles.forEach((file) => void uploadDocumentoOCR(file));
    onClose();
    setCurrentView('pending_review');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: FileList | null = e.currentTarget.files;
    if (!files?.length) return;
    const selectedFiles = Array.from(files);
    e.currentTarget.value = '';
    processFiles(selectedFiles);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const photo: File | undefined = e.currentTarget.files?.[0];
    e.currentTarget.value = '';
    if (!photo) return;

    if (/\.(jpe?g|png)$/i.test(photo.name)) {
      processFiles([photo]);
      return;
    }

    const extension = photoExtensions[photo.type];
    if (!extension) {
      showToast('Envie uma foto em JPG ou PNG.', 'error');
      return;
    }
    processFiles([new File([photo], `foto-ocr.${extension}`, {
      type: photo.type,
      lastModified: photo.lastModified
    })]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  return (
    <ModalOverlay aria-labelledby="upload-document-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
        <div className="bg-[#0b1c30] text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#C5A059]" aria-hidden="true">cloud_upload</span>
            <h3 id="upload-document-title" className="font-bold text-base">Enviar documento para OCR</h3>
          </div>
          <button type="button" aria-label="Fechar envio" onClick={onClose} className="grid size-11 shrink-0 place-items-center rounded-lg text-gray-300 hover:bg-white/10 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6">
          <p className="mb-4 text-sm text-gray-600">
            Envie faturas, notas ou comprovantes. O documento ficará em Pendências / OCR para conferência.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed p-4 text-center transition sm:p-6 ${
              dragActive
                ? 'border-[#C5A059] bg-[#eff4ff]'
                : 'border-gray-300 bg-[#f8f9ff] hover:border-[#131b2e]'
            }`}
          >
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#131b2e] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0b1c30] focus-within:ring-2 focus-within:ring-[#C5A059]">
                <span className="material-symbols-outlined text-xl" aria-hidden="true">upload_file</span>
                Selecionar arquivos
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.xml"
                  multiple
                  onChange={handleFileChange}
                  className="sr-only"
                />
              </label>
              <label className="relative flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#d3e4fe] bg-white px-3 py-2 text-sm font-semibold text-[#0b1c30] transition hover:bg-[#eff4ff] focus-within:ring-2 focus-within:ring-[#C5A059]">
                <span className="material-symbols-outlined text-xl" aria-hidden="true">photo_camera</span>
                Tirar foto
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  capture="environment"
                  onChange={handlePhotoChange}
                  className="sr-only"
                />
              </label>
            </div>
            <p className="mt-3 hidden text-xs text-gray-600 sm:block">Você também pode arrastar os arquivos até aqui.</p>
            <p className="mt-1 text-xs text-gray-600">PDF, XML, JPG ou PNG, até 15 MB por arquivo.</p>
          </div>
        </div>
      </div>
    </ModalOverlay>
  );
};
