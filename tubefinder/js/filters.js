// Клиентские фильтры и сортировка — то, чего не умеет сам API.
export function parseDuration(iso){
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  const [, d, h, mi, s] = m.map(x => Number(x || 0));
  return d * 86400 + h * 3600 + mi * 60 + s;
}

export const fmtDuration = (sec) => {
  if (!sec) return '';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
};

export const fmtNum = (n) => (n === null || n === undefined || n === '') ? '—' : Number(n).toLocaleString('ru-RU');

export function fmtDate(iso){
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

const words = (str) => (str || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

export function applyFilters(items, f){
  const inc = words(f.include);
  const exc = words(f.exclude);
  // несколько запросов: ролик подходит, если совпал хотя бы с одним из них
  const qSets = f.titleOnly
    ? (f.queries || []).map(q => words(q.replace(/[,\s]+/g, ','))).filter(set => set.length)
    : [];

  return items.filter(v => {
    const title = (v.title || '').toLowerCase();
    const chan = (v.channelTitle || '').toLowerCase();

    if (qSets.length && !qSets.some(set => set.every(w => title.includes(w)))) return false;
    if (inc.length && !inc.every(w => title.includes(w))) return false;
    if (exc.length && exc.some(w => title.includes(w) || (v.description || '').toLowerCase().includes(w))) return false;
    if (f.channelName && !chan.includes(f.channelName.toLowerCase())) return false;

    if (f.viewsMin !== '' && v.views < Number(f.viewsMin)) return false;
    if (f.viewsMax !== '' && v.views > Number(f.viewsMax)) return false;
    if (f.lenMin !== '' && v.duration < Number(f.lenMin) * 60) return false;
    if (f.lenMax !== '' && v.duration > Number(f.lenMax) * 60) return false;

    if (f.noShorts && v.duration && v.duration <= 60) return false;
    if (f.onlyShorts && !(v.duration && v.duration <= 60)) return false;

    if (f.onlySubs && !f.subs.has(v.channelId)) return false;
    if (f.hideSubs && f.subs.has(v.channelId)) return false;

    return true;
  });
}

export function sortItems(items, mode){
  const arr = [...items];
  const by = {
    views:      (a, b) => b.views - a.views,
    likes:      (a, b) => b.likes - a.likes,
    date:       (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt),
    'date-asc': (a, b) => new Date(a.publishedAt) - new Date(b.publishedAt),
    duration:   (a, b) => b.duration - a.duration,
    engagement: (a, b) => (b.likes / Math.max(b.views, 1)) - (a.likes / Math.max(a.views, 1)),
  }[mode];
  return by ? arr.sort(by) : arr;
}
