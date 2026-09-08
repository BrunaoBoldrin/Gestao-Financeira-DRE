import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';


export const AuthScreen: React.FC = () => {
  const {
    persistenceStatus,
    persistenceMessage,
    loginUser,
    setupInitialAdmin,
    retryPersistence
  } = useApp();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [setupToken, setSetupToken] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState('');

  const isSetup = persistenceStatus === 'SETUP_REQUIRED';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError('');
    if (isSetup && password !== passwordConfirmation) {
      setLocalError('A confirmação da senha não confere.');
      return;
    }
    setSubmitting(true);
    const success = isSetup
      ? await setupInitialAdmin({ setupToken, name, username: 'admin', password })
      : await loginUser(username, password);
    if (!success) setLocalError('Confira os dados informados e tente novamente.');
    setSubmitting(false);
  };

  if (persistenceStatus === 'LOADING') {
    return (
      <div className="min-h-screen bg-[#081728] flex items-center justify-center p-6 text-white">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl border-2 border-[#C5A059] border-t-transparent animate-spin" />
          <p className="mt-4 text-sm font-semibold text-gray-200">Carregando...</p>
        </div>
      </div>
    );
  }

  if (persistenceStatus === 'ERROR') {
    return (
      <div className="min-h-screen bg-[#081728] flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-rose-100 p-7 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 text-rose-700 flex items-center justify-center">
            <span className="material-symbols-outlined">database_off</span>
          </div>
          <h1 className="mt-4 text-lg font-black text-[#0b1c30]">Sistema indisponível</h1>
          <p className="mt-2 text-xs text-gray-600">{persistenceMessage}</p>
          <button onClick={retryPersistence} className="mt-5 px-4 py-2.5 bg-[#131b2e] text-white rounded-lg text-xs font-bold">
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#081728] flex items-center justify-center p-5 relative overflow-hidden">
      <div className="absolute -top-32 -right-24 w-96 h-96 rounded-full bg-[#C5A059]/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-28 w-96 h-96 rounded-full bg-blue-500/10 blur-3xl" />

      <div className="w-full max-w-md relative">
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#C5A059] text-[#081728] flex items-center justify-center text-lg font-black shadow-lg">RF</div>
          <h1 className="mt-4 text-2xl font-black text-white tracking-tight">Gestão Financeira & DRE</h1>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-2xl border border-white/20 p-7 space-y-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#9b762a]">
              {isSetup ? 'Configuração inicial' : 'Acesso ao sistema'}
            </p>
            <h2 className="mt-1 text-lg font-black text-[#0b1c30]">
              {isSetup ? 'Criar administrador' : 'Entrar'}
            </h2>
            <p className="mt-1 text-xs text-gray-500">{persistenceMessage}</p>
          </div>

          {isSetup && (
            <>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Chave de configuração do Render</label>
                <input type="password" required minLength={16} value={setupToken} onChange={(event) => setSetupToken(event.target.value)} autoComplete="off" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#C5A059] focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nome do administrador</label>
                <input type="text" required minLength={2} value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#C5A059] focus:outline-none" />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Usuário</label>
            <input type="text" required value={isSetup ? 'admin' : username} readOnly={isSetup} onChange={(event) => setUsername(event.target.value)} autoComplete="username" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#C5A059] focus:outline-none" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">Senha</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} required minLength={isSetup ? 12 : 1} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={isSetup ? 'new-password' : 'current-password'} className="w-full px-3 py-2.5 pr-11 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#C5A059] focus:outline-none" />
              <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute inset-y-0 right-0 px-3 text-gray-500" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                <span className="material-symbols-outlined text-lg">{showPassword ? 'visibility_off' : 'visibility'}</span>
              </button>
            </div>
            {isSetup && <p className="mt-1 text-[10px] text-gray-500">Use pelo menos 12 caracteres.</p>}
          </div>

          {isSetup && (
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">Confirmar senha</label>
              <input type={showPassword ? 'text' : 'password'} required minLength={12} value={passwordConfirmation} onChange={(event) => setPasswordConfirmation(event.target.value)} autoComplete="new-password" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#C5A059] focus:outline-none" />
            </div>
          )}

          {(localError || (persistenceStatus !== 'AUTH_REQUIRED' && persistenceStatus !== 'SETUP_REQUIRED')) && (
            <p className="text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-2.5">
              {localError || persistenceMessage}
            </p>
          )}

          <button type="submit" disabled={submitting} className="w-full py-3 bg-[#131b2e] hover:bg-[#0b1c30] disabled:bg-gray-400 text-white rounded-lg text-sm font-bold transition shadow-lg flex items-center justify-center gap-2">
            {submitting && <span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />}
            {submitting ? 'Entrando...' : isSetup ? 'Criar administrador e entrar' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};
