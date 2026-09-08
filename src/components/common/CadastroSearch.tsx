import React, { useId, useState } from 'react';

interface Option { id: string; nome: string; codigo: string }
interface Props {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onSelect: (option: Option) => void;
}
export const CadastroSearch: React.FC<Props> = ({ label, value, options, onChange, onSelect }) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const matches = options.filter(option => normalize(option.nome + ' ' + option.codigo).includes(normalize(value)));
  const select = (option: Option) => { onSelect(option); setOpen(false); setActive(-1); };
  return (
    <div onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-700 mb-1">{label} *</label>
      <input id={id} role="combobox" aria-expanded={open} aria-controls={id + '-list'}
        aria-autocomplete="list" aria-activedescendant={open && active >= 0 && matches[active] ? id + '-' + active : undefined}
        required autoComplete="off" value={value} placeholder="Digite o nome ou código do cadastro"
        onFocus={() => { setOpen(true); setActive(-1); }}
        onChange={event => { onChange(event.target.value); setOpen(true); setActive(-1); }}
        onKeyDown={event => {
          if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => Math.min(index + 1, matches.length - 1)); }
          if (event.key === 'ArrowUp') { event.preventDefault(); setOpen(true); setActive(index => Math.max(index - 1, 0)); }
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
          if (event.key === 'Enter' && open) {
            event.preventDefault();
            const option = matches[active] || (matches.length === 1 ? matches[0] : undefined);
            if (option) select(option);
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
          Nenhum cadastro ativo encontrado. Cadastre a conta em Cadastros → Plano de Contas ou solicite ao administrador.
        </li>}
      </ul>}
    </div>
  );
};
