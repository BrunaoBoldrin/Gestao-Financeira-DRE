import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';

interface HeaderProps {
  onOpenNovoLancamentoModal: () => void;
  onOpenUploadModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNovoLancamentoModal, onOpenUploadModal }) => {
  const {
    currentUser,
    setCurrentUser,
    selectedUnit,
    setSelectedUnit,
    selectedMonthYear,
    setSelectedMonthYear,
    setCurrentView,
    documentosOCR,
    units,
    users,
    showToast,
    isAuditor
  } = useApp();

  const [showUserMenu, setShowUserMenu] = useState(false);

  const pendingOCRCount = documentosOCR.filter((d) => d.status === 'PENDENTE_REVISAO').length;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#e5eeff] px-4 lg:px-6 py-3 flex items-center justify-between shadow-xs">
      {/* Left: Unit Selector & Search */}
      <div className="flex items-center gap-3 lg:gap-6">
        <div className="relative">
          <label className="block text-[10px] font-semibold text-[#45464d] uppercase tracking-wider mb-0.5">
            Unidade / Filial
          </label>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined text-gray-400 absolute left-2 pointer-events-none text-lg">
              location_city
            </span>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="pl-8 pr-7 py-1.5 bg-[#f8f9ff] border border-[#d3e4fe] rounded-md text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#131b2e] cursor-pointer max-w-[220px] truncate"
            >
              <option value="Todas as Unidades">Todas as Unidades (Consolidado)</option>
              {units.filter((u) => u.ativa !== false && u.id !== 'all').map((u) => (
                <option key={u.id} value={u.nome}>
                  {u.nome} ({u.cidade})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Month Year Selector */}
        <div>
          <label className="block text-[10px] font-semibold text-[#45464d] uppercase tracking-wider mb-0.5">
            Competência
          </label>
          <div className="relative flex items-center">
            <span className="material-symbols-outlined text-gray-400 absolute left-2 pointer-events-none text-lg">
              calendar_month
            </span>
            <select
              value={selectedMonthYear}
              onChange={(e) => setSelectedMonthYear(e.target.value)}
              className="pl-8 pr-6 py-1.5 bg-[#f8f9ff] border border-[#d3e4fe] rounded-md text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#131b2e] cursor-pointer"
            >
              <option value="TODOS">Todas as Competências</option>
              <option value="2024-05">Maio / 2024 (Atual)</option>
              <option value="2024-04">Abril / 2024</option>
              <option value="2024-03">Março / 2024</option>
              <option value="2024-02">Fevereiro / 2024</option>
              <option value="2024-01">Janeiro / 2024</option>
            </select>
          </div>
        </div>
      </div>

      {/* Right: Quick Actions, Badges & User Menu */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Quick Action Buttons */}
        <button
          onClick={() => {
            if (isAuditor) {
              showToast('Acesso negado: Perfil Auditoria possui apenas acesso de leitura.', 'error');
              return;
            }
            onOpenUploadModal();
          }}
          disabled={isAuditor}
          title={isAuditor ? 'Perfil Auditoria possui apenas permissão de leitura' : undefined}
          className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
            isAuditor
              ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
              : 'bg-[#eff4ff] border border-[#d3e4fe] text-[#0b1c30] hover:bg-[#e5eeff]'
          }`}
        >
          <span className="material-symbols-outlined text-base">upload_file</span>
          <span>Caixa de Entrada / OCR</span>
        </button>

        <button
          onClick={() => {
            if (isAuditor) {
              showToast('Acesso negado: Perfil Auditoria possui apenas acesso de leitura.', 'error');
              return;
            }
            setCurrentView('import_excel');
          }}
          disabled={isAuditor}
          title={isAuditor ? 'Perfil Auditoria possui apenas permissão de leitura' : undefined}
          className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
            isAuditor
              ? 'bg-gray-100 border border-gray-200 text-gray-400 cursor-not-allowed opacity-60'
              : 'bg-[#f8f9ff] border border-[#C5A059]/50 text-[#0b1c30] hover:bg-[#fff9ed]'
          }`}
        >
          <span className="material-symbols-outlined text-base text-[#C5A059]">table_chart</span>
          <span>Importar Excel</span>
        </button>

        <button
          onClick={() => {
            if (isAuditor) {
              showToast('Acesso negado: Perfil Auditoria possui apenas acesso de leitura.', 'error');
              return;
            }
            onOpenNovoLancamentoModal();
          }}
          disabled={isAuditor}
          title={isAuditor ? 'Perfil Auditoria possui apenas permissão de leitura' : undefined}
          className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-xs transition ${
            isAuditor
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed opacity-60'
              : 'bg-[#131b2e] text-white hover:bg-[#0b1c30]'
          }`}
        >
          <span className="material-symbols-outlined text-base">add_circle</span>
          <span className="hidden sm:inline">Novo Lançamento</span>
        </button>

        <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>

        {/* Notifications / Badges */}
        <div className="flex items-center gap-2">
          {pendingOCRCount > 0 && (
            <button
              onClick={() => setCurrentView('pending_review')}
              className="relative p-2 text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition flex items-center gap-1 text-xs font-medium"
              title={`${pendingOCRCount} documentos aguardando revisão OCR`}
            >
              <span className="material-symbols-outlined text-lg">find_in_page</span>
              <span className="bg-amber-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                {pendingOCRCount}
              </span>
            </button>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2.5 p-1 rounded-md hover:bg-gray-100 transition focus:outline-none"
          >
            <img
              src={currentUser?.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
              alt={currentUser?.name}
              className="w-8 h-8 rounded-full border border-[#C5A059] object-cover"
            />
            <div className="text-left hidden md:block">
              <p className="text-xs font-bold text-[#0b1c30] leading-tight">{currentUser?.name}</p>
              <span className="text-[10px] font-semibold text-[#775a19] bg-[#ffdea5] px-1.5 py-0.2 rounded">
                {currentUser?.role === 'ADMIN' ? 'Administrador' : currentUser?.role === 'FINANCE' ? 'Financeiro' : 'Auditoria'}
              </span>
            </div>
            <span className="material-symbols-outlined text-gray-500 text-base">expand_more</span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-xl py-2 z-50 text-xs">
              <div className="px-4 py-2 border-b border-gray-100 bg-[#f8f9ff]">
                <p className="font-bold text-[#0b1c30]">{currentUser?.name}</p>
                <p className="text-gray-500 text-[11px]">{currentUser?.email}</p>
                <p className="text-gray-400 text-[10px] mt-0.5">{currentUser?.unit}</p>
              </div>

              <div className="px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Alternar Perfil de Teste
              </div>

              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setCurrentUser(u);
                    setShowUserMenu(false);
                    showToast(`Sessão alterada para ${u.name} (${u.role})`, 'info');
                  }}
                  className={`w-full text-left px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition ${
                    currentUser?.id === u.id ? 'bg-[#eff4ff] font-bold text-[#131b2e]' : 'text-gray-700'
                  }`}
                >
                  <div>
                    <p>{u.name}</p>
                    <span className="text-[10px] text-gray-500">{u.role}</span>
                  </div>
                  {currentUser?.id === u.id && (
                    <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  )}
                </button>
              ))}

              <div className="border-t border-gray-100 mt-2 pt-1">
                <button
                  onClick={() => {
                    setCurrentUser(null);
                    setShowUserMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Sair do Sistema
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
