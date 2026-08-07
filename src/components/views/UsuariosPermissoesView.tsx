import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';

export const UsuariosPermissoesView: React.FC = () => {
  const { users, addUser, toggleUserActive, isAdmin, currentUser } = useApp();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('FINANCE');
  const [unit, setUnit] = useState('Royal Face - Matriz');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!name || !email) return;

    addUser({
      name,
      email,
      role,
      unit,
      active: true,
      avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150`
    });

    setName('');
    setEmail('');
  };

  return (
    <div className="space-y-6">
      {/* Permission Warning Banner if not Admin */}
      {!isAdmin && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs font-medium">
          <span className="material-symbols-outlined text-amber-600 text-lg">shield_lock</span>
          <div>
            <p className="font-bold text-amber-900">Modo de Visualização (Perfil: {currentUser?.role || 'AUDITOR'})</p>
            <p className="mt-0.5 text-amber-800">
              Apenas usuários com perfil <strong>ADMINISTRADOR</strong> podem cadastrar novos usuários ou alterar permissões e status de acesso no sistema.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">manage_accounts</span>
            Usuários e Controle de Acesso por Perfil (RBAC)
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Gestão de usuários, atribuição de perfis (Administrador, Financeiro, Auditoria) e filiais.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Users Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#e5eeff] shadow-xs overflow-hidden">
          <div className="p-4 bg-[#f8f9ff] border-b border-[#e5eeff]">
            <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
              Usuários Cadastrados ({users.length})
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#eff4ff] text-[#0b1c30] uppercase text-[10px] font-bold tracking-wider">
                  <th className="p-3">Usuário / E-mail</th>
                  <th className="p-3">Perfil</th>
                  <th className="p-3">Unidade</th>
                  <th className="p-3">Último Acesso</th>
                  <th className="p-3 text-center">Status</th>
                  <th className="p-3 text-center">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition">
                    <td className="p-3">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={u.avatarUrl || 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150'}
                          alt={u.name}
                          className="w-7 h-7 rounded-full border border-[#C5A059] object-cover"
                        />
                        <div>
                          <p className="font-bold text-[#0b1c30]">{u.name}</p>
                          <p className="text-[10px] text-gray-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="text-[10px] font-bold text-[#775a19] bg-[#ffdea5] px-2 py-0.5 rounded">
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 text-gray-700">{u.unit}</td>
                    <td className="p-3 text-gray-500 text-[10px] font-mono">{u.lastAccess}</td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.active ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => toggleUserActive(u.id)}
                        disabled={!isAdmin}
                        title={!isAdmin ? 'Apenas Administradores podem alterar o status de um usuário' : undefined}
                        className={`px-2 py-1 text-white rounded text-[10px] font-bold transition ${
                          !isAdmin
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-[#131b2e] hover:bg-[#0b1c30]'
                        }`}
                      >
                        {u.active ? 'Desativar' : 'Ativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add User Form */}
        <div className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">Novo Usuário</h3>

          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Nome Completo</label>
              <input
                type="text"
                required
                disabled={!isAdmin}
                placeholder="Ex: Dra. Marcela Costa"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">E-mail Corporativo</label>
              <input
                type="email"
                required
                disabled={!isAdmin}
                placeholder="marcela@royalface.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Perfil / Papel</label>
              <select
                value={role}
                disabled={!isAdmin}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white font-semibold disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="ADMIN">Administrador (Acesso Total)</option>
                <option value="FINANCE">Financeiro (Lançamentos e Caixas)</option>
                <option value="AUDITOR">Auditoria (Apenas Leitura e Relatórios)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Unidade Atribuída</label>
              <select
                value={unit}
                disabled={!isAdmin}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-md text-xs focus:ring-2 focus:ring-[#131b2e] focus:outline-none bg-white font-semibold disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="Royal Face - Matriz">Royal Face - Matriz</option>
                <option value="Royal Face - Unidade Centro">Royal Face - Unidade Centro</option>
                <option value="Todas as Unidades">Todas as Unidades</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={!isAdmin}
              className={`w-full py-2 rounded-md text-xs font-bold transition shadow-xs mt-2 ${
                !isAdmin
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-[#131b2e] text-white hover:bg-[#0b1c30]'
              }`}
            >
              Cadastrar Usuário
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
