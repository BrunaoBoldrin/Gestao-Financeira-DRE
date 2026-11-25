import { useState } from 'react';
import type { PwaInstall } from '../../hooks/usePwaInstall';

export function PwaInstallPanel({ installed, canInstall, requestInstall }: PwaInstall) {
  const [showHelp, setShowHelp] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const userAgent = navigator.userAgent;
  const appleMobile = /iPhone|iPad|iPod/.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(userAgent);

  async function install() {
    if (!canInstall) {
      setShowHelp(true);
      return;
    }
    setRequesting(true);
    const accepted = await requestInstall();
    setRequesting(false);
    setShowHelp(!accepted);
  }

  return (
    <section aria-labelledby="install-app-title" className="rounded-xl border border-[#e5eeff] bg-white p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span aria-hidden="true" className="material-symbols-outlined rounded-lg bg-[#eff4ff] p-2 text-[#0b1c30]">install_mobile</span>
          <div>
            <h2 id="install-app-title" className="text-sm font-bold text-[#0b1c30]">Aplicativo no celular</h2>
            <p className="mt-1 text-sm text-slate-600">Adicione o Gestão Financeira e DRE à tela inicial do seu celular.</p>
          </div>
        </div>
        {installed ? (
          <p role="status" className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">Aplicativo instalado</p>
        ) : (
          <button type="button" onClick={install} disabled={requesting}
            className="rounded-lg bg-[#131b2e] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#0b1c30] disabled:opacity-50">
            {requesting ? 'Aguardando confirmação…' : 'Instalar aplicativo'}
          </button>
        )}
      </div>

      {showHelp && !installed && (
        <div role="status" className="mt-4 space-y-3 rounded-lg border border-[#d3e4fe] bg-[#f8f9ff] p-4 text-sm text-slate-700">
          {(!android || appleMobile) && (
            <div>
              <h3 className="font-semibold text-[#0b1c30]">iPhone ou iPad</h3>
              <p>Abra o sistema no Safari. Toque em <strong>Compartilhar</strong> → <strong>Adicionar à Tela de Início</strong>. Se aparecer, ative <strong>Abrir como App Web</strong> e toque em <strong>Adicionar</strong>.</p>
            </div>
          )}
          {!appleMobile && (
            <div>
              <h3 className="font-semibold text-[#0b1c30]">Android</h3>
              <p>Abra o sistema no Chrome. No menu <strong>⋮</strong>, toque em <strong>Instalar app</strong> ou <strong>Adicionar à tela inicial</strong> e confirme.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
