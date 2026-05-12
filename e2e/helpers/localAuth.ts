import type { Page } from '@playwright/test';

type LocalRole = 'admin' | 'attendant' | 'viewer';

const SESSION_KEY = 'cipf_local_auth';
const ACTIVITY_KEY = 'cipf_last_activity';
const LOGIN_KEY = 'cipf_login_at';

export async function seedLocalSession(page: Page, role: LocalRole) {
  const user = {
    id: `e2e-${role}`,
    name:
      role === 'admin'
        ? 'ADMIN TESTE'
        : role === 'attendant'
          ? 'ATENDENTE TESTE'
          : 'CONSULTA TESTE',
    email: `${role}@teste.local`,
    role
  };

  await page.addInitScript(({ sessionKey, activityKey, loginKey, currentUser }) => {
    const now = String(Date.now());
    sessionStorage.setItem(sessionKey, JSON.stringify(currentUser));
    localStorage.setItem(activityKey, now);
    localStorage.setItem(loginKey, now);
  }, {
    sessionKey: SESSION_KEY,
    activityKey: ACTIVITY_KEY,
    loginKey: LOGIN_KEY,
    currentUser: user
  });
}

