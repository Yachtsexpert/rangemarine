// Локальное хранилище: ключи доступа, пресеты фильтров, настройки вида.
const K_CLIENT = 'tubefinder:client_id';
const K_APIKEY = 'tubefinder:api_key';
const K_PRESETS = 'tubefinder:presets';
const K_PREFS = 'tubefinder:prefs';

const read = (k, fallback) => {
  try { const v = localStorage.getItem(k); return v === null ? fallback : JSON.parse(v); }
  catch { return fallback; }
};
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

export const getClientId = () => read(K_CLIENT, '') || '';
export const getApiKey   = () => read(K_APIKEY, '') || '';
export const setKeys = (clientId, apiKey) => { write(K_CLIENT, clientId.trim()); write(K_APIKEY, apiKey.trim()); };

export const getPresets = () => read(K_PRESETS, {});
export function savePreset(name, values){ const p = getPresets(); p[name] = values; write(K_PRESETS, p); }
export function deletePreset(name){ const p = getPresets(); delete p[name]; write(K_PRESETS, p); }

export const getPrefs = () => read(K_PREFS, {});
export function setPref(key, value){ const p = getPrefs(); p[key] = value; write(K_PREFS, p); }
