import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserAvatar } from '../common/UserAvatar';

interface HeaderProps {
  onOpenMenu: () => void;
  menuOpen: boolean;
  onOpenNovoLancamentoModal: () => void;
  onOpenUploadModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onOpenNovoLancamentoModal, onOpenUploadModal, onOpenMenu, menuOpen }) => {
  const {
    currentUser,
    currentView,
    selectedUnit,
    setSelectedUnit,
    setCurrentView,
    documentosOCR,
    units,
    logoutUser,
    persistenceStatus,
    persistenceMessage,
    isFinance,
    canExecuteFinancialActions
  } = useApp();

  const [showUserMenu, setShowUserMenu] = useState(false);

  const pendingOCRCount = documentosOCR.filter((d) => d.status === 'PENDENTE_REVISAO').length;
  const persistenceBadge = persistenceStatus === 'SAVING'
    ? { icon: 'sync', label: 'Salvando...', className: 'bg-amber-50 border-amber-200 text-amber-800' }
    : persistenceStatus === 'CONNECTED'
      ? { icon: 'cloud_done', label: 'Salvo', className: 'bg-emerald-50 border-emerald-200 text-emerald-800' }
      : persistenceStatus === 'ERROR' || persistenceStatus === 'CONFLICT'
        ? { icon: 'cloud_off', label: 'Não salvo', className: 'bg-rose-50 border-rose-200 text-rose-800' }
        : null;

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#e5eeff] px-4 lg:px-6 py-3 flex flex-wrap gap-2 items-center justify-between shadow-xs">
      <button type="button" onClick={onOpenMenu} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen} aria-controls="app-navigation" className="lg:hidden p-2 rounded-lg bg-[#eff4ff]"><span className="material-symbols-outlined">menu</span></button>
      {/* Left: Unit Selector & Search */}
      <div className="flex items-center gap-3 lg:gap-6">
        {currentView !== 'overview' && <div className="relative">
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
              disabled={isFinance}
              title={isFinance ? 'Perfil Financeiro limitado à unidade cadastrada' : undefined}
              className={`pl-8 pr-7 py-1.5 bg-[#f8f9ff] border border-[#d3e4fe] rounded-md text-xs font-semibold text-[#0b1c30] focus:outline-none focus:ring-2 focus:ring-[#131b2e] max-w-[min(220px,45vw)] truncate ${
                isFinance ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'
              }`}
            >
              {!isFinance && <option value="Todas as Unidades">Todas as Unidades (Consolidado)</option>}
              {units.filter((u) =>
                u.ativa !== false && u.id !== 'all' && (!isFinance || u.nome === currentUser?.unit)
              ).map((u) => (
                <option key={u.id} value={u.nome}>
                  {u.nome} ({u.cidade})
                </option>
              ))}
            </select>
          </div>
        </div>}

      </div>

      {/* Right: Quick Actions, Badges & User Menu */}
      <div className="flex items-center gap-2 lg:gap-4 ml-auto">
        {/* Quick Action Buttons */}
        {canExecuteFinancialActions && (
          <>
            <button
              onClick={onOpenUploadModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition bg-[#eff4ff] border border-[#d3e4fe] text-[#0b1c30] hover:bg-[#e5eeff]"
            >
              <span className="material-symbols-outlined text-base">upload_file</span>
              <span>Caixa de Entrada / OCR</span>
            </button>

            <button
              onClick={() => setCurrentView('import_excel')}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition bg-[#f8f9ff] border border-[#C5A059]/50 text-[#0b1c30] hover:bg-[#fff9ed]"
            >
              <span className="material-symbols-outlined text-base text-[#C5A059]">table_chart</span>
              <span>Importar Excel</span>
            </button>

            <button
              aria-label="Novo lançamento"
              onClick={onOpenNovoLancamentoModal}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold shadow-xs transition bg-[#131b2e] text-white hover:bg-[#0b1c30]"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              <span className="hidden sm:inline">Novo Lançamento</span>
            </button>
          </>
        )}

        {persistenceBadge && (
          <div
            title={persistenceMessage}
            className={`hidden lg:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-[10px] font-bold ${persistenceBadge.className}`}
          >
            <span className={`material-symbols-outlined text-base ${persistenceStatus === 'SAVING' ? 'animate-spin' : ''}`}>
              {persistenceBadge.icon}
            </span>
            <span>{persistenceBadge.label}</span>
          </div>
        )}

        <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>

        {/* Notifications / Badges */}
        <div className="flex items-center gap-2">
          {canExecuteFinancialActions && pendingOCRCount > 0 && (
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
            <UserAvatar name={currentUser?.name || 'Usuário'} avatarUrl={currentUser?.avatarUrl} />
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
                <p className="text-gray-500 text-[11px]">{currentUser?.username}</p>
                <p className="text-gray-400 text-[10px] mt-0.5">{currentUser?.unit}</p>
              </div>

              {persistenceStatus !== 'LOCAL_DEMO' && <div className="border-t border-gray-100 mt-2 pt-1">
                <button
                  onClick={async () => {
                    setShowUserMenu(false);
                    await logoutUser();
                  }}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium"
                >
                  <span className="material-symbols-outlined text-base">logout</span>
                  Sair do Sistema
                </button>
              </div>}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
