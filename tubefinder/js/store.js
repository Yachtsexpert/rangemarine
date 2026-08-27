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

/* ---- коллекции сохранённых роликов ---- */
const K_COLL = 'tubefinder:collections';
export const getCollections = () => read(K_COLL, { 'Избранное': [] });

export function collectionNames(){
  const names = Object.keys(getCollections());
  return names.length ? names : ['Избранное'];
}

export function addToCollection(name, video){
  const c = getCollections();
  const list = c[name] || (c[name] = []);
  if (!list.some(v => v.id === video.id)) list.unshift({ ...video, savedAt: new Date().toISOString() });
  write(K_COLL, c);
}

export function removeFromCollection(name, id){
  const c = getCollections();
  c[name] = (c[name] || []).filter(v => v.id !== id);
  write(K_COLL, c);
}

export function deleteCollection(name){
  const c = getCollections();
  delete c[name];
  write(K_COLL, Object.keys(c).length ? c : { 'Избранное': [] });
}

export function savedIds(){
  const ids = new Set();
  Object.values(getCollections()).forEach(list => list.forEach(v => ids.add(v.id)));
  return ids;
}

export const savedTotal = () => savedIds().size;

export function createCollection(name){
  const c = getCollections();
  if (!c[name]) { c[name] = []; write(K_COLL, c); }
}
