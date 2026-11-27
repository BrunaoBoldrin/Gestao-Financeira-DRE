import React, { useId, useState } from 'react';
import { normalizeText } from '../../utils/text';

interface Option { id: string; nome: string; codigo: string }
interface Props {
  label: string;
  placeholder?: string;
  emptyMessage?: string;
  value: string;
  required?: boolean;
  disabled?: boolean;
  options: Option[];
  onChange: (value: string) => void;
  onSelect: (option: Option) => void;
  createAction?: { label: string; onCreate: (value: string) => void };
}
export const CadastroSearch: React.FC<Props> = ({ label, value, options, onChange, onSelect, createAction, required = true, disabled = false, placeholder = 'Digite o nome ou código do cadastro', emptyMessage = 'Nenhum cadastro ativo encontrado. Cadastre a conta em Cadastros → Plano de Contas ou solicite ao administrador.' }) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const query = normalizeText(value);
  const digits = query.replace(/\D/g, '');
  const matches = options.filter(({ nome, codigo }) =>
    normalizeText(nome + ' ' + codigo).includes(query) ||
    (/^[0-9./\s-]+$/.test(query) && digits && codigo.replace(/\D/g, '').includes(digits))
  );
  const select = (option: Option) => { onSelect(option); setOpen(false); setActive(-1); };
  const canCreate = !disabled && query.length > 0 && matches.length === 0 && createAction;
  const create = () => {
    setOpen(false);
    createAction?.onCreate(value.trim());
  };
  return (
    <div onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-700 mb-1">{label}{required ? ' *' : ''}</label>
      <input id={id} role="combobox" aria-expanded={open} aria-controls={id + '-list'}
        aria-autocomplete="list" aria-activedescendant={open && active >= 0 && matches[active] ? id + '-' + active : undefined}
        required={required} disabled={disabled} autoComplete="off" value={value} placeholder={placeholder}
        onClick={() => setOpen(true)}
        onFocus={() => { setOpen(true); setActive(-1); }}
        onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => Math.min(index + 1, matches.length - 1)); }
          if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => Math.max(index - 1, 0)); }
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
          if (event.key === 'Enter' && open) {
            const option = matches[active] || (matches.length === 1 ? matches[0] : undefined);
            if (option || required || canCreate) event.preventDefault();
            if (option) select(option);
            else if (canCreate) create();
          }
        }}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#131b2e] focus:outline-none"
      />
      {open && <ul id={id + '-list'} role="listbox" aria-label={label}
        className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-[#d3e4fe] bg-white divide-y divide-gray-100">
        {matches.map((option, index) => <li key={option.id} id={id + '-' + index} role="option"
          aria-selected={index === active} onMouseDown={event => event.preventDefault()}
          onClick={() => select(option)}
          ref={element => { if (element && index === active) element.scrollIntoView({ block: 'nearest' }); }}
          className={`cursor-pointer px-3 py-3 text-sm break-words ${index === active ? 'bg-[#eff4ff]' : 'hover:bg-gray-50'}`}>
          <span className="text-xs text-gray-500 mr-2">{option.codigo}</span>{option.nome}
        </li>)}
        {matches.length === 0 && <li className="p-3 text-xs text-gray-500" role="presentation">
          {canCreate ? 'Nenhum resultado para esta busca.' : options.length ? 'Nenhum resultado para esta busca. Tente outro nome ou código.' : emptyMessage}
        </li>}
      </ul>}
      {open && canCreate && (
        <button type="button" onClick={create}
          className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-lg border border-[#d3e4fe] bg-[#eff4ff] px-3 py-2 text-left text-sm font-semibold text-[#0b1c30] hover:bg-[#dbeafe]">
          <span className="material-symbols-outlined text-lg" aria-hidden="true">add</span>
          {canCreate.label}
        </button>
      )}
    </div>
  );
};
