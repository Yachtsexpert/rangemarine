const SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

const PAGE_SIZE = 50;
const MAX_RESULTS = 200;

const el = (id) => document.getElementById(id);
const state = { token: null, tokenClient: null, rows: [] };

function getClientId() {
  return localStorage.getItem('yt_client_id') || '';
}

function setStatus(text, isError = false) {
  el('status').textContent = text;
  el('status').classList.toggle('error', isError);
}

function initAuth() {
  const clientId = getClientId();
  if (!clientId) {
    el('setupBanner').classList.remove('hidden');
    el('signInBtn').disabled = true;
    return;
  }
  if (!window.google?.accounts?.oauth2) {
    setTimeout(initAuth, 300);
    return;
  }
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (response) => {
      if (response.error) {
        setStatus('Ошибка авторизации: ' + response.error, true);
        return;
      }
      state.token = response.access_token;
      onSignedIn();
    }
  });
  el('signInBtn').disabled = false;
}

async function onSignedIn() {
  el('signInBtn').classList.add('hidden');
  el('signOutBtn').classList.remove('hidden');
  el('searchBtn').disabled = false;
  setStatus('Готово к поиску.');
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + state.token }
    });
    const info = await res.json();
    el('userEmail').textContent = info.email || '';
  } catch {
    el('userEmail').textContent = '';
  }
}

function signOut() {
  if (state.token) google.accounts.oauth2.revoke(state.token, () => {});
  state.token = null;
  el('userEmail').textContent = '';
  el('signInBtn').classList.remove('hidden');
  el('signOutBtn').classList.add('hidden');
  el('searchBtn').disabled = true;
  setStatus('Вы вышли из аккаунта.');
}

async function apiGet(path, params) {
  const url = new URL('https://www.googleapis.com/youtube/v3/' + path);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== '' && v != null) url.searchParams.set(k, v);
  });
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + state.token } });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Запрос к YouTube API не удался (' + res.status + ')');
  }
  return data;
}

function collectFilters() {
  const toRfc3339 = (value, endOfDay) =>
    value ? new Date(value + (endOfDay ? 'T23:59:59Z' : 'T00:00:00Z')).toISOString() : '';

  return {
    q: el('q').value.trim(),
    limit: Math.min(Math.max(parseInt(el('limit').value, 10) || PAGE_SIZE, 1), MAX_RESULTS),
    order: el('order').value,
    publishedAfter: toRfc3339(el('publishedAfter').value, false),
    publishedBefore: toRfc3339(el('publishedBefore').value, true),
    videoDuration: el('videoDuration').value,
    videoDefinition: el('videoDefinition').value,
    videoCaption: el('videoCaption').value,
    relevanceLanguage: el('relevanceLanguage').value,
    regionCode: el('regionCode').value,
    eventType: el('eventType').value,
    videoLicense: el('videoLicense').value,
    channelId: el('channelId').value.trim(),
    safeSearch: el('safeSearch').value
  };
}

async function collectVideoIds(filters) {
  const ids = [];
  let pageToken = '';
  while (ids.length < filters.limit) {
    const data = await apiGet('search', {
      part: 'id',
      type: 'video',
      maxResults: Math.min(PAGE_SIZE, filters.limit - ids.length),
      pageToken,
      q: filters.q,
      order: filters.order,
      publishedAfter: filters.publishedAfter,
      publishedBefore: filters.publishedBefore,
      videoDuration: filters.videoDuration,
      videoDefinition: filters.videoDefinition,
      videoCaption: filters.videoCaption,
      relevanceLanguage: filters.relevanceLanguage,
      regionCode: filters.regionCode,
      eventType: filters.eventType,
      videoLicense: filters.videoLicense,
      channelId: filters.channelId,
      safeSearch: filters.safeSearch
    });
    ids.push(...(data.items || []).map((item) => item.id.videoId).filter(Boolean));
    pageToken = data.nextPageToken || '';
    if (!pageToken) break;
  }
  return ids.slice(0, filters.limit);
}

async function fetchVideoDetails(ids) {
  const videos = [];
  for (let i = 0; i < ids.length; i += PAGE_SIZE) {
    const data = await apiGet('videos', {
      part: 'snippet,statistics,contentDetails',
      id: ids.slice(i, i + PAGE_SIZE).join(',')
    });
    videos.push(...(data.items || []));
  }
  return videos;
}

function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return '';
  const [, d, h, min, s] = m.map((v) => (v ? parseInt(v, 10) : 0));
  const total = d * 86400 + h * 3600 + min * 60 + s;
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return hh ? `${hh}:${pad(mm)}:${pad(ss)}` : `${mm}:${pad(ss)}`;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toRow(video, index) {
  const s = video.snippet || {};
  const stats = video.statistics || {};
  const details = video.contentDetails || {};
  const thumb = s.thumbnails?.medium?.url || s.thumbnails?.default?.url || '';
  return {
    number: index + 1,
    url: 'https://www.youtube.com/watch?v=' + video.id,
    publishedAt: s.publishedAt || '',
    thumbnail: thumb,
    title: s.title || '',
    description: s.description || '',
    views: stats.viewCount ? Number(stats.viewCount) : null,
    likes: stats.likeCount ? Number(stats.likeCount) : null,
    comments: stats.commentCount ? Number(stats.commentCount) : null,
    duration: parseDuration(details.duration),
    channel: s.channelTitle || '',
    channelUrl: s.channelId ? 'https://www.youtube.com/channel/' + s.channelId : '',
    definition: (details.definition || '').toUpperCase(),
    caption: details.caption === 'true' ? 'есть' : 'нет',
    tags: (s.tags || []).join(', ')
  };
}

function renderRows(rows) {
  const body = el('resultsBody');
  body.textContent = '';
  const fmt = (n) => (n == null ? '—' : n.toLocaleString('ru-RU'));

  for (const row of rows) {
    const tr = document.createElement('tr');

    const add = (className, build) => {
      const td = document.createElement('td');
      if (className) td.className = className;
      build(td);
      tr.appendChild(td);
    };

    add('num', (td) => (td.textContent = row.number));
    add('', (td) => {
      const a = document.createElement('a');
      a.href = row.url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'открыть';
      td.appendChild(a);
    });
    add('', (td) => (td.textContent = formatDate(row.publishedAt)));
    add('', (td) => {
      if (!row.thumbnail) return;
      const a = document.createElement('a');
      a.href = row.url;
      a.target = '_blank';
      a.rel = 'noopener';
      const img = document.createElement('img');
      img.className = 'thumb';
      img.src = row.thumbnail;
      img.alt = row.title;
      img.loading = 'lazy';
      a.appendChild(img);
      td.appendChild(a);
    });
    add('title', (td) => (td.textContent = row.title));
    add('desc', (td) => (td.textContent = row.description));
    add('numeric', (td) => (td.textContent = fmt(row.views)));
    add('numeric', (td) => (td.textContent = fmt(row.likes)));
    add('numeric', (td) => (td.textContent = fmt(row.comments)));
    add('numeric', (td) => (td.textContent = row.duration));
    add('', (td) => {
      if (!row.channelUrl) {
        td.textContent = row.channel;
        return;
      }
      const a = document.createElement('a');
      a.href = row.channelUrl;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = row.channel;
      td.appendChild(a);
    });
    add('', (td) => (td.textContent = row.definition));
    add('', (td) => (td.textContent = row.caption));
    add('tags', (td) => (td.textContent = row.tags));

    body.appendChild(tr);
  }
}

async function runSearch() {
  const filters = collectFilters();
  if (!filters.q && !filters.channelId) {
    setStatus('Введите поисковый запрос или ID канала.', true);
    return;
  }

  el('searchBtn').disabled = true;
  setStatus('Ищем на YouTube…');

  try {
    const ids = await collectVideoIds(filters);
    if (!ids.length) {
      state.rows = [];
      renderRows([]);
      setStatus('Ничего не найдено — попробуйте ослабить фильтры.');
      return;
    }
    setStatus(`Найдено ${ids.length}, загружаем метаданные…`);
    const videos = await fetchVideoDetails(ids);
    state.rows = videos.map(toRow);
    renderRows(state.rows);
    setStatus(`Готово: ${state.rows.length} роликов.`);
  } catch (err) {
    setStatus(err.message, true);
  } finally {
    el('searchBtn').disabled = false;
    const empty = state.rows.length === 0;
    el('exportBtn').disabled = empty;
    el('copyBtn').disabled = empty;
  }
}

const COLUMNS = [
  ['№', (r) => r.number],
  ['Ссылка', (r) => r.url],
  ['Дата публикации', (r) => formatDate(r.publishedAt)],
  ['Превью', (r) => r.thumbnail],
  ['Название', (r) => r.title],
  ['Описание', (r) => r.description],
  ['Просмотры', (r) => r.views ?? ''],
  ['Лайки', (r) => r.likes ?? ''],
  ['Комментарии', (r) => r.comments ?? ''],
  ['Длительность', (r) => r.duration],
  ['Канал', (r) => r.channel],
  ['Качество', (r) => r.definition],
  ['Субтитры', (r) => r.caption],
  ['Теги', (r) => r.tags]
];

function exportCsv() {
  const escape = (v) => '"' + String(v).replace(/"/g, '""') + '"';
  const lines = [COLUMNS.map(([name]) => escape(name)).join(',')];
  for (const row of state.rows) {
    lines.push(COLUMNS.map(([, get]) => escape(get(row))).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'youtube-parser.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function copyForSheets() {
  const clean = (v) => String(v).replace(/[\t\r\n]+/g, ' ');
  const lines = [COLUMNS.map(([name]) => name).join('\t')];
  for (const row of state.rows) {
    lines.push(COLUMNS.map(([, get]) => clean(get(row))).join('\t'));
  }
  await navigator.clipboard.writeText(lines.join('\n'));
  setStatus('Скопировано — вставьте в Google Таблицу (Ctrl+V).');
}

function resetFilters() {
  ['q', 'publishedAfter', 'publishedBefore', 'channelId'].forEach((id) => (el(id).value = ''));
  el('limit').value = '50';
  el('order').value = 'relevance';
  el('videoDuration').value = 'any';
  el('videoDefinition').value = 'any';
  el('videoCaption').value = 'any';
  el('relevanceLanguage').value = '';
  el('regionCode').value = '';
  el('eventType').value = '';
  el('videoLicense').value = 'any';
  el('safeSearch').value = 'none';
}

el('saveClientIdBtn').addEventListener('click', () => {
  const value = el('clientIdInput').value.trim();
  if (!value) return;
  localStorage.setItem('yt_client_id', value);
  el('setupBanner').classList.add('hidden');
  initAuth();
});
el('signInBtn').addEventListener('click', () => state.tokenClient?.requestAccessToken());
el('signOutBtn').addEventListener('click', signOut);
el('searchBtn').addEventListener('click', runSearch);
el('resetBtn').addEventListener('click', resetFilters);
el('exportBtn').addEventListener('click', exportCsv);
el('copyBtn').addEventListener('click', copyForSheets);
el('q').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !el('searchBtn').disabled) runSearch();
});

el('clientIdInput').value = getClientId();
initAuth();
