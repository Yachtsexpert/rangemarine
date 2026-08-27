// Вход через Google (OAuth 2.0, implicit token flow — бэкенд не нужен).
import { getClientId } from './store.js';

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

const K_TOKEN = 'tubefinder:token';
let tokenClient = null;
let listeners = [];

export const onAuthChange = (fn) => { listeners.push(fn); };
const emit = () => listeners.forEach(fn => fn(getSession()));

function saveSession(s){ try { sessionStorage.setItem(K_TOKEN, JSON.stringify(s)); } catch {} }

export function getSession(){
  try {
    const s = JSON.parse(sessionStorage.getItem(K_TOKEN) || 'null');
    if (!s || !s.token || s.expires < Date.now()) return null;
    return s;
  } catch { return null; }
}

export const getToken = () => (getSession()?.token || null);

// Ждём загрузки библиотеки Google Identity Services.
function gisReady(){
  return new Promise((resolve, reject) => {
    const started = Date.now();
    (function tick(){
      if (window.google?.accounts?.oauth2) return resolve();
      if (Date.now() - started > 12000) return reject(new Error('Не удалось загрузить Google Identity Services'));
      setTimeout(tick, 100);
    })();
  });
}

export async function signIn(){
  const clientId = getClientId();
  if (!clientId) throw new Error('Не указан OAuth Client ID. Откройте «⚙ Доступ» и вставьте его.');
  await gisReady();

  const token = await new Promise((resolve, reject) => {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (resp) => {
        if (resp.error) return reject(new Error(resp.error_description || resp.error));
        resolve(resp);
      },
      error_callback: (err) => reject(new Error(err?.message || 'Вход отменён')),
    });
    tokenClient.requestAccessToken({ prompt: getSession() ? '' : 'consent' });
  });

  const session = {
    token: token.access_token,
    expires: Date.now() + (Number(token.expires_in || 3600) - 60) * 1000,
    profile: null,
  };
  saveSession(session);

  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    if (r.ok) { session.profile = await r.json(); saveSession(session); }
  } catch {}

  emit();
  return session;
}

export function signOut(){
  const s = getSession();
  if (s?.token && window.google?.accounts?.oauth2) {
    try { google.accounts.oauth2.revoke(s.token); } catch {}
  }
  try { sessionStorage.removeItem(K_TOKEN); } catch {}
  emit();
}
