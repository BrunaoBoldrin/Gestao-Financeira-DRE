import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { canAccessView } from './config/accessControl';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';

// Modals
import { NovoLancamentoModal } from './components/modals/NovoLancamentoModal';
import { UploadOCRModal } from './components/modals/UploadOCRModal';
import { NovoParcelamentoModal } from './components/modals/NovoParcelamentoModal';

// Views
import { OverviewView } from './components/views/OverviewView';
import { InboxView } from './components/views/InboxView';
import { PendingReviewView } from './components/views/PendingReviewView';
import { ReceitasView } from './components/views/ReceitasView';
import { DespesasView } from './components/views/DespesasView';
import { ParcelamentosView } from './components/views/ParcelamentosView';
import { CaixaFisicoView } from './components/views/CaixaFisicoView';
import { FluxoCaixaView } from './components/views/FluxoCaixaView';
import { DREGerencialView } from './components/views/DREGerencialView';
import { DocumentosView } from './components/views/DocumentosView';
import { FechamentoMensalView } from './components/views/FechamentoMensalView';
import { CadastrosView } from './components/views/CadastrosView';
import { ImportExcelView } from './components/views/ImportExcelView';
import { AutomacoesView } from './components/views/AutomacoesView';
import { HistoricoAuditoriaView } from './components/views/HistoricoAuditoriaView';
import { UsuariosPermissoesView } from './components/views/UsuariosPermissoesView';
import { ConfiguracoesGeraisView } from './components/views/ConfiguracoesGeraisView';

const MainAppContent: React.FC = () => {
  const { currentView, currentUser, users, setCurrentUser } = useApp();

  const [isNovoLancamentoOpen, setIsNovoLancamentoOpen] = useState(false);
  const [isUploadOCROpen, setIsUploadOCROpen] = useState(false);
  const [isNovoParcelamentoOpen, setIsNovoParcelamentoOpen] = useState(false);

  useEffect(() => {
    setIsNovoLancamentoOpen(false);
    setIsUploadOCROpen(false);
    setIsNovoParcelamentoOpen(false);
  }, [currentUser?.id]);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#f8f9ff] flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white border border-[#e5eeff] rounded-2xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-11 h-11 rounded-xl bg-[#0b1c30] text-[#C5A059] flex items-center justify-center font-black">
              RF
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-[#0b1c30]">Gestão Financeira & DRE</h1>
              <p className="text-xs text-amber-700 font-semibold">Ambiente de teste de perfis</p>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Selecione um usuário ativo para testar as páginas e permissões correspondentes ao perfil.
          </p>

          <div className="space-y-2">
            {users.filter((user) => user.active).map((user) => (
              <button
                key={user.id}
                onClick={() => setCurrentUser(user)}
                className="w-full p-3 border border-gray-200 rounded-xl flex items-center justify-between hover:bg-[#f8f9ff] hover:border-[#C5A059] transition text-left"
              >
                <div>
                  <p className="text-sm font-bold text-[#0b1c30]">{user.name}</p>
                  <p className="text-xs text-gray-500">{user.email} • {user.unit}</p>
                </div>
                <span className="text-[10px] font-bold text-[#775a19] bg-[#ffdea5] px-2 py-1 rounded">
                  {user.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const renderActiveView = () => {
    if (!canAccessView(currentUser.role, currentView)) {
      return <OverviewView />;
    }

    switch (currentView) {
      case 'overview':
        return <OverviewView />;
      case 'inbox':
        return <InboxView onOpenUploadModal={() => setIsUploadOCROpen(true)} />;
      case 'pending_review':
        return <PendingReviewView />;
      case 'receitas':
        return <ReceitasView onOpenNovoLancamentoModal={() => setIsNovoLancamentoOpen(true)} />;
      case 'despesas':
        return (
          <DespesasView
            onOpenNovoLancamentoModal={() => setIsNovoLancamentoOpen(true)}
            onOpenUploadModal={() => setIsUploadOCROpen(true)}
          />
        );
      case 'parcelamentos':
        return (
          <ParcelamentosView
            onOpenNovoParcelamentoModal={() => setIsNovoParcelamentoOpen(true)}
          />
        );
      case 'caixa_fisico':
        return <CaixaFisicoView />;
      case 'fluxo_caixa':
        return <FluxoCaixaView />;
      case 'dre':
        return <DREGerencialView />;
      case 'documentos':
        return <DocumentosView />;
      case 'fechamento':
        return <FechamentoMensalView />;
      case 'cadastros':
        return <CadastrosView />;
      case 'import_excel':
        return <ImportExcelView />;
      case 'automacoes':
        return <AutomacoesView />;
      case 'historico':
        return <HistoricoAuditoriaView />;
      case 'usuarios':
        return <UsuariosPermissoesView />;
      case 'configuracoes':
        return <ConfiguracoesGeraisView />;
      default:
        return <OverviewView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col font-sans antialiased selection:bg-[#ffdea5] selection:text-[#775a19]">
      {/* Header */}
      <Header
        onOpenNovoLancamentoModal={() => setIsNovoLancamentoOpen(true)}
        onOpenUploadModal={() => setIsUploadOCROpen(true)}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar />

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-[1600px] mx-auto w-full">
          {renderActiveView()}
        </main>
      </div>

      {/* Modals */}
      <NovoLancamentoModal
        isOpen={isNovoLancamentoOpen}
        onClose={() => setIsNovoLancamentoOpen(false)}
      />

      <UploadOCRModal
        isOpen={isUploadOCROpen}
        onClose={() => setIsUploadOCROpen(false)}
      />

      <NovoParcelamentoModal
        isOpen={isNovoParcelamentoOpen}
        onClose={() => setIsNovoParcelamentoOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainAppContent />
    </AppProvider>
  );
}
