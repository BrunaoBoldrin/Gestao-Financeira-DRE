import { useEffect, useState } from 'react';

interface InstallPrompt extends Event {
  prompt(): Promise<unknown>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const getDisplayMode = () => window.matchMedia('(display-mode: standalone)');
const isStandalone = () => getDisplayMode().matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function usePwaInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const displayMode = getDisplayMode();
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    const onDisplayMode = (event: MediaQueryListEvent) => {
      if (event.matches) onInstalled();
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    displayMode.addEventListener('change', onDisplayMode);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      displayMode.removeEventListener('change', onDisplayMode);
    };
  }, []);

  const requestInstall = async (): Promise<boolean> => {
    if (!prompt) return false;
    setPrompt(null);
    try {
      await prompt.prompt();
      if ((await prompt.userChoice).outcome !== 'accepted') return false;
      setInstalled(true);
      return true;
    } catch {
      return false;
    }
  };

  return { installed, canInstall: prompt !== null, requestInstall };
}

export type PwaInstall = ReturnType<typeof usePwaInstall>;
