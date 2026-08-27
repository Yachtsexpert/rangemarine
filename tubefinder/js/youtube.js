// Тонкая обёртка над YouTube Data API v3.
import { getApiKey } from './store.js';
import { getToken } from './auth.js';

const BASE = 'https://www.googleapis.com/youtube/v3';

async function call(path, params){
  const token = getToken();
  const key = getApiKey();
  if (!token && !key) {
    throw new Error('Нужен вход через Google или API-ключ. Нажмите «⚙ Доступ».');
  }
  const url = new URL(`${BASE}/${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '' && v !== 'any') url.searchParams.set(k, v);
  });
  if (!token && key) url.searchParams.set('key', key);

  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason || '';
    const msg = data?.error?.message || res.statusText;
    if (reason === 'quotaExceeded') throw new Error('Исчерпана дневная квота YouTube API для этого проекта.');
    if (res.status === 401) throw new Error('Токен доступа истёк — войдите через Google заново.');
    if (res.status === 403) throw new Error(`Доступ запрещён: ${msg}`);
    throw new Error(msg || 'Ошибка запроса к YouTube API');
  }
  return data;
}

export const searchVideos = (params) => call('search', { part: 'snippet', type: 'video', ...params });

// Детали (длительность, просмотры, лайки) — до 50 id за запрос.
export async function videoDetails(ids){
  const out = new Map();
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const data = await call('videos', {
      part: 'snippet,contentDetails,statistics,status',
      id: chunk.join(','),
      maxResults: 50,
    });
    (data.items || []).forEach(v => out.set(v.id, v));
  }
  return out;
}

// Каналы, на которые подписан пользователь (нужен вход).
export async function mySubscriptions(){
  const ids = new Set();
  let pageToken;
  do {
    const data = await call('subscriptions', { part: 'snippet', mine: true, maxResults: 50, pageToken });
    (data.items || []).forEach(s => ids.add(s.snippet?.resourceId?.channelId));
    pageToken = data.nextPageToken;
  } while (pageToken && ids.size < 1000);
  ids.delete(undefined);
  return ids;
}

// Принимает UC..., @handle или ссылку на канал.
export async function resolveChannelId(input){
  const raw = (input || '').trim();
  if (!raw) return '';
  const byId = raw.match(/(UC[\w-]{20,})/);
  if (byId) return byId[1];
  const handle = raw.match(/@([\w.\-]+)/)?.[1] || raw.replace(/^https?:\/\/\S+\//, '');
  const data = await call('search', { part: 'snippet', type: 'channel', q: handle, maxResults: 1 });
  return data.items?.[0]?.snippet?.channelId || data.items?.[0]?.id?.channelId || '';
}
