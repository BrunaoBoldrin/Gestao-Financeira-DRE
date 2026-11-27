import { useState, type FormEvent } from 'react';
import { useApp } from '../../context/AppContext';
import type { FornecedorMaster, UnitConfig } from '../../types';
import { formatTaxId } from '../../utils/text';
import { ModalOverlay } from '../common/ModalOverlay';

interface NovoClienteModalProps {
  branch: UnitConfig;
  query: string;
  onClose: () => void;
  onSaved: (client: FornecedorMaster) => void;
}

const fieldClass = 'mt-1 min-h-11 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-[#131b2e]';

export function NovoClienteModal({ branch, query, onClose, onSaved }: NovoClienteModalProps) {
  const { addCliente } = useApp();
  const isDocument = /^[0-9./\s-]+$/.test(query);
  const [name, setName] = useState(isDocument ? '' : query);
  const [document, setDocument] = useState(isDocument ? formatTaxId(query) : '');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const client = await addCliente({ nome: name, cnpj: document, cidade: city }, branch.id);
      if (client) onSaved(client);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalOverlay aria-labelledby="new-client-title" className="z-50 bg-black/50 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between rounded-t-xl bg-[#0b1c30] px-6 py-3 text-white">
          <h3 id="new-client-title" className="text-base font-bold">Adicionar cliente</h3>
          <button type="button" aria-label="Fechar cadastro de cliente" onClick={onClose} disabled={saving}
            className="grid size-11 place-items-center rounded-lg text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-50">
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>
        <form onSubmit={handleSave} className="space-y-4 p-6">
          <div className="rounded-lg bg-[#eff4ff] px-3 py-2 text-sm text-[#0b1c30]">
            <span className="block text-xs font-semibold">Clínica</span>
            {branch.nome}
          </div>
          <label className="block text-xs font-semibold text-gray-700">
            Nome ou razão social *
            <input required value={name} onChange={(event) => setName(event.target.value)} maxLength={150} className={fieldClass} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold text-gray-700">
              CPF ou CNPJ (opcional)
              <input value={document} onChange={(event) => setDocument(formatTaxId(event.target.value))}
                placeholder="CPF ou CNPJ" className={fieldClass} />
            </label>
            <label className="block text-xs font-semibold text-gray-700">
              Cidade / UF (opcional)
              <input value={city} onChange={(event) => setCity(event.target.value)} maxLength={120} className={fieldClass} />
            </label>
          </div>
          <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4">
            <button type="button" onClick={onClose} disabled={saving}
              className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="min-h-11 rounded-lg bg-[#131b2e] px-4 text-sm font-bold text-white hover:bg-[#0b1c30] disabled:opacity-50">
              {saving ? 'Salvando...' : 'Salvar cliente'}
            </button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  );
}
