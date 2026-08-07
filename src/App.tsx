import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
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
  const { currentView } = useApp();

  const [isNovoLancamentoOpen, setIsNovoLancamentoOpen] = useState(false);
  const [isUploadOCROpen, setIsUploadOCROpen] = useState(false);
  const [isNovoParcelamentoOpen, setIsNovoParcelamentoOpen] = useState(false);

  const renderActiveView = () => {
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
