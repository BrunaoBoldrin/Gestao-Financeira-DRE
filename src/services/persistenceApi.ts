import { ApplicationStateSnapshot, User, UserRole } from '../types';


export class PersistenceApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: unknown
  ) {
    super(message);
  }
}

const requestJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, { credentials: 'same-origin', ...init });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail;
    const message = typeof detail === 'string'
      ? detail
      : detail?.message || `Falha na API (HTTP ${response.status}).`;
    throw new PersistenceApiError(message, response.status, detail);
  }
  return payload as T;
};

export interface PersistenceAuthStatus {
  databaseConfigured: boolean;
  encryptionConfigured: boolean;
  setupTokenConfigured: boolean;
  setupRequired: boolean;
  authenticated: boolean;
  user: User | null;
  error?: string | null;
}

export const getPersistenceAuthStatus = () =>
  requestJson<PersistenceAuthStatus>('/api/auth/status');

export const loginUser = (email: string, password: string) =>
  requestJson<{ success: boolean; user: User }>('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

export const setupInitialAdmin = (data: {
  setupToken: string;
  name: string;
  email: string;
  password: string;
}) => requestJson<{ success: boolean; user: User }>('/api/auth/setup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data)
});

export const logoutUser = () =>
  requestJson<{ success: boolean }>('/api/auth/logout', { method: 'POST' });

export interface CreateAuthUserInput {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  unit: string;
  active: boolean;
}

export type UpdateAuthUserInput = Omit<CreateAuthUserInput, 'password'> & {
  password?: string;
};

export const createAuthUser = (data: CreateAuthUserInput) =>
  requestJson<{ success: boolean; user: User }>('/api/auth/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

export const listAuthUsers = () =>
  requestJson<{ users: User[] }>('/api/auth/users');

export const updateAuthUser = (id: string, data: UpdateAuthUserInput) =>
  requestJson<{ success: boolean; user: User }>(`/api/auth/users/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

export const deleteAuthUser = (id: string) =>
  requestJson<{ success: boolean }>(`/api/auth/users/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });

export const loadApplicationState = () =>
  requestJson<{ revision: number; empty: boolean; data: ApplicationStateSnapshot | null }>('/api/state');

export const saveApplicationState = (
  expectedRevision: number,
  data: ApplicationStateSnapshot
) => requestJson<{ success: boolean; revision: number }>('/api/state', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ expectedRevision, data })
});

export const uploadPersistentFile = async (file: File) => {
  const form = new FormData();
  form.append('file', file);
  return requestJson<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    url: string;
  }>('/api/files', { method: 'POST', body: form });
};
