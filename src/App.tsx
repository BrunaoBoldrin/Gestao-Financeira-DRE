import React, { useEffect, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { canAccessView, ROLE_DEFAULT_VIEW } from './config/accessControl';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNavigation } from './components/layout/MobileNavigation';
import type { TipoLancamento } from './types';
import { usePwaInstall } from './hooks/usePwaInstall';
import { AuthScreen } from './components/auth/AuthScreen';

// Modals
import { NovoLancamentoModal } from './components/modals/NovoLancamentoModal';
import { UploadOCRModal } from './components/modals/UploadOCRModal';

// Views
import { OverviewView } from './components/views/OverviewView';
import { InboxView } from './components/views/InboxView';
import { PendingReviewView } from './components/views/PendingReviewView';
import { ReceitasView } from './components/views/ReceitasView';
import { CaixaFisicoView } from './components/views/CaixaFisicoView';
import { FluxoCaixaView } from './components/views/FluxoCaixaView';
import { DREGerencialView } from './components/views/DREGerencialView';
import { PontoEquilibrioView } from './components/views/PontoEquilibrioView';
import { DocumentosView } from './components/views/DocumentosView';
import { FechamentoMensalView } from './components/views/FechamentoMensalView';
import { CadastrosView } from './components/views/CadastrosView';
import { ImportExcelView } from './components/views/ImportExcelView';
import { AutomacoesView } from './components/views/AutomacoesView';
import { HistoricoAuditoriaView } from './components/views/HistoricoAuditoriaView';
import { UsuariosPermissoesView } from './components/views/UsuariosPermissoesView';
import { ConfiguracoesGeraisView } from './components/views/ConfiguracoesGeraisView';

const MainAppContent: React.FC = () => {
  const { currentView, currentUser, persistenceStatus, persistenceMessage, retryPersistence } = useApp();

  const pwaInstall = usePwaInstall();
  const [newTransaction, setNewTransaction] = useState<TipoLancamento | null>(null);
  const [isUploadOCROpen, setIsUploadOCROpen] = useState(false);

  useEffect(() => {
    setNewTransaction(null);
    setIsUploadOCROpen(false);
  }, [currentUser?.id]);

  useEffect(() => { window.scrollTo(0, 0); }, [currentView, currentUser?.id]);

  if (!currentUser) {
    return <AuthScreen />;
  }

  const renderActiveView = () => {
    const allowedView = canAccessView(currentUser.role, currentView)
      ? currentView
      : ROLE_DEFAULT_VIEW[currentUser.role];

    switch (allowedView) {
      case 'overview':
        return <OverviewView />;
      case 'inbox':
        return <InboxView onOpenUploadModal={() => setIsUploadOCROpen(true)} />;
      case 'pending_review':
        return <PendingReviewView />;
      case 'receitas':
        return <ReceitasView onOpenNovoLancamentoModal={() => setNewTransaction('DESPESA')} />;
      case 'despesas':
        return <ReceitasView onOpenNovoLancamentoModal={() => setNewTransaction('DESPESA')} />;
      case 'caixa_fisico':
        return <CaixaFisicoView />;
      case 'fluxo_caixa':
        return <FluxoCaixaView />;
      case 'dre':
        return <DREGerencialView />;
      case 'ponto_equilibrio':
        return <PontoEquilibrioView />;
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
        return <ConfiguracoesGeraisView pwaInstall={pwaInstall} />;
      default:
        return <OverviewView />;
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9ff] text-[#0b1c30] flex flex-col font-sans antialiased selection:bg-[#ffdea5] selection:text-[#775a19]">
      {/* Header */}
      <Header
        onOpenNovoLancamentoModal={() => setNewTransaction('DESPESA')}
        onOpenUploadModal={() => setIsUploadOCROpen(true)}
      />

      {persistenceStatus === 'LOCAL_DEMO' && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-[11px] font-semibold text-amber-900 text-center">
          {persistenceMessage}
        </div>
      )}
      {(persistenceStatus === 'ERROR' || persistenceStatus === 'CONFLICT') && (
        <div className="bg-rose-50 border-b border-rose-200 px-4 py-2 text-[11px] font-semibold text-rose-900 flex items-center justify-center gap-3">
          <span>{persistenceMessage}</span>
          <button onClick={retryPersistence} className="underline font-black">Recarregar</button>
        </div>
      )}

      <div className="flex min-w-0 flex-1">
        {/* Sidebar */}
        <Sidebar />

        {/* Main View Area */}
        <main className="app-main mx-auto w-full min-w-0 max-w-[1600px] flex-1">
          {renderActiveView()}
        </main>
      </div>

      {/* Modals */}
      <MobileNavigation onOpenNew={setNewTransaction} onOpenUpload={() => setIsUploadOCROpen(true)} />
      {newTransaction && <NovoLancamentoModal
        isOpen
        tipoInicial={newTransaction}
        onClose={() => setNewTransaction(null)}
      />}

      <UploadOCRModal
        isOpen={isUploadOCROpen}
        onClose={() => setIsUploadOCROpen(false)}
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
