import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import type { User, UserRole } from '../../types';
import { UserAvatar } from '../common/UserAvatar';

export const UsuariosPermissoesView: React.FC = () => {
  const { users, units, addUser, updateUser, toggleUserActive, deleteUser, isAdmin, currentUser, showToast } = useApp();

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userToDeleteId, setUserToDeleteId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('FINANCE');
  const [unit, setUnit] = useState('Royal Face - Matriz');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const userToDelete = users.find((user) => user.id === userToDeleteId);

  const resetForm = () => {
    setEditingUserId(null);
    setName('');
    setEmail('');
    setRole('FINANCE');
    setUnit('Royal Face - Matriz');
    setAvatarUrl(undefined);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const startEditing = (user: User) => {
    setEditingUserId(user.id);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setUnit(user.unit);
    setAvatarUrl(user.avatarUrl);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      showToast('Selecione uma foto JPG, PNG ou WEBP.', 'error');
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showToast('A foto de perfil deve ter no máximo 5 MB.', 'error');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => setAvatarUrl(String(reader.result));
    reader.onerror = () => showToast('Não foi possível processar a foto selecionada.', 'error');
    reader.readAsDataURL(file);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!name || !email) return;
    const emailInUse = users.some((user) =>
      user.id !== editingUserId && user.email.toLowerCase() === email.toLowerCase()
    );
    if (emailInUse) {
      showToast('Já existe um usuário cadastrado com este e-mail.', 'error');
      return;
    }

    if (editingUserId) {
      updateUser(editingUserId, { name, email, role, unit, avatarUrl });
    } else {
      addUser({ name, email, role, unit, active: true, avatarUrl });
    }

    resetForm();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-[#e5eeff] shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-[#0b1c30] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#131b2e]">manage_accounts</span>
            Usuários e Controle de Acesso
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
                        <UserAvatar name={u.name} avatarUrl={u.avatarUrl} sizeClass="w-8 h-8" textClass="text-[10px]" />
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
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => startEditing(u)}
                          disabled={!isAdmin}
                          className="px-2 py-1 border border-[#d3e4fe] text-[#0b1c30] rounded text-[10px] font-bold hover:bg-[#eff4ff] disabled:bg-gray-100 disabled:text-gray-400"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => toggleUserActive(u.id)}
                          disabled={!isAdmin || currentUser?.id === u.id}
                          title={currentUser?.id === u.id
                            ? 'Não é possível desativar o usuário da sessão atual'
                            : !isAdmin ? 'Apenas Administradores podem alterar o status de um usuário' : undefined}
                          className={`px-2 py-1 text-white rounded text-[10px] font-bold transition ${
                            !isAdmin || currentUser?.id === u.id
                              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                              : 'bg-[#131b2e] hover:bg-[#0b1c30]'
                          }`}
                        >
                          {u.active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button
                          onClick={() => setUserToDeleteId(u.id)}
                          disabled={!isAdmin || currentUser?.id === u.id}
                          title={currentUser?.id === u.id ? 'Não é possível excluir o usuário da sessão atual' : 'Excluir usuário'}
                          className="p-1 text-gray-400 hover:text-rose-600 disabled:text-gray-200 disabled:cursor-not-allowed transition"
                        >
                          <span className="material-symbols-outlined text-base">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add User Form */}
        <div className="bg-white rounded-xl border border-[#e5eeff] p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#0b1c30] uppercase tracking-wider">
              {editingUserId ? 'Editar Usuário' : 'Novo Usuário'}
            </h3>
            {editingUserId && (
              <button type="button" onClick={resetForm} className="text-[10px] font-bold text-gray-500 hover:text-[#0b1c30]">
                Cancelar edição
              </button>
            )}
          </div>

          <form onSubmit={handleSave} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-gray-700 mb-1">Foto de Perfil (opcional)</label>
              <div className="flex items-center gap-3 p-3 bg-[#f8f9ff] border border-[#d3e4fe] rounded-lg">
                <UserAvatar name={name || 'Novo Usuário'} avatarUrl={avatarUrl} sizeClass="w-12 h-12" textClass="text-sm" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <label className="inline-flex px-2.5 py-1.5 bg-white border border-gray-300 rounded text-[10px] font-bold text-[#0b1c30] hover:bg-gray-50 cursor-pointer">
                    {avatarUrl ? 'Trocar foto' : 'Selecionar foto'}
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                      onChange={handlePhotoChange}
                      disabled={!isAdmin}
                      className="sr-only"
                    />
                  </label>
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setAvatarUrl(undefined);
                        if (photoInputRef.current) photoInputRef.current.value = '';
                      }}
                      className="ml-2 text-[10px] font-bold text-rose-600 hover:underline"
                    >
                      Remover
                    </button>
                  )}
                  <p className="text-[9px] text-gray-500">JPG, PNG ou WEBP, até 5 MB. Sem foto, serão usadas as iniciais.</p>
                </div>
              </div>
            </div>
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
                {units.filter((item) => item.ativa && item.id !== 'all').map((item) => (
                  <option key={item.id} value={item.nome}>{item.nome}</option>
                ))}
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
              {editingUserId ? 'Salvar Alterações' : 'Cadastrar Usuário'}
            </button>
          </form>
        </div>
      </div>

      {userToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-rose-600 text-2xl">person_remove</span>
              <div>
                <h3 className="text-sm font-bold text-[#0b1c30]">Excluir usuário?</h3>
                <p className="text-xs text-gray-500 mt-0.5">Essa ação removerá o acesso de {userToDelete.name}.</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setUserToDeleteId(null)}
                className="px-3 py-2 border border-gray-300 rounded-md text-xs font-semibold text-gray-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteUser(userToDelete.id);
                  if (editingUserId === userToDelete.id) resetForm();
                  setUserToDeleteId(null);
                }}
                className="px-3 py-2 bg-rose-600 text-white rounded-md text-xs font-bold hover:bg-rose-700"
              >
                Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
