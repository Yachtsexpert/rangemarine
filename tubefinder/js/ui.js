import { fmtDuration, fmtNum, fmtDate } from './filters.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export function renderCards(root, items, mode, opts = {}){
  const { saved = new Set(), view = 'search', showQuery = false } = opts;
  root.className = `cards ${mode}`;
  if (!items.length) { root.innerHTML = ''; return; }

  root.innerHTML = items.map(v => {
    const url = `https://www.youtube.com/watch?v=${v.id}`;
    const isShort = v.duration && v.duration <= 60;
    const rate = v.views ? (v.likes / v.views) : 0;
    return `
    <article class="card">
      <a class="thumb" href="${url}" target="_blank" rel="noopener">
        <img loading="lazy" src="${esc(v.thumb)}" alt="">
        ${isShort ? '<span class="badge-short">SHORTS</span>' : ''}
        ${v.duration ? `<span class="len">${fmtDuration(v.duration)}</span>` : ''}
      </a>
      <div class="card-body">
        <h3 class="card-title"><a href="${url}" target="_blank" rel="noopener">${esc(v.title)}</a></h3>
        <div class="card-chan">
          <a href="https://www.youtube.com/channel/${esc(v.channelId)}" target="_blank" rel="noopener">${esc(v.channelTitle)}</a>
          · ${fmtDate(v.publishedAt)}
        </div>
        <div class="card-meta">
          <span class="chip">👁 ${fmtNum(v.views)}</span>
          <span class="chip">👍 ${fmtNum(v.likes)}</span>
          <span class="chip">💬 ${fmtNum(v.comments)}</span>
          ${rate > 0.05 ? `<span class="chip hot">🔥 ${(rate * 100).toFixed(1)}% лайков</span>` : ''}
          ${v.definition === 'hd' ? '<span class="chip">HD</span>' : ''}
          ${v.caption === 'true' ? '<span class="chip">СС</span>' : ''}
          ${showQuery && v.query ? `<span class="chip q">${esc(v.query)}</span>` : ''}
        </div>
        <p class="card-desc">${esc(v.description)}</p>
        <div class="card-actions">
          <a href="${url}" target="_blank" rel="noopener">Смотреть</a>
          <button type="button" data-copy="${url}">Копировать ссылку</button>
          ${view === 'saved'
            ? `<button type="button" data-remove="${v.id}">Убрать</button>`
            : `<button type="button" class="${saved.has(v.id) ? 'saved' : ''}" data-save="${v.id}">${saved.has(v.id) ? '★ Сохранено' : '☆ В коллекцию'}</button>`}
        </div>
      </div>
    </article>`;
  }).join('');

  root.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        const old = btn.textContent; btn.textContent = 'Скопировано ✓';
        setTimeout(() => { btn.textContent = old; }, 1500);
      } catch {}
    });
  });
}

export function renderStats(el, { fetched, shown, ms }){
  el.classList.remove('hidden');
  const cut = fetched - shown;
  el.innerHTML = `Загружено с YouTube: <b>${fetched}</b> · после фильтров: <b>${shown}</b>`
    + (cut > 0 ? ` · отсеяно: <b>${cut}</b>` : '')
    + ` · за <b>${(ms / 1000).toFixed(1)} с</b>`;
}

export function toCSV(items){
  const head = ['Название', 'Канал', 'Дата', 'Просмотры', 'Лайки', 'Комментарии', 'Длительность', 'Ссылка'];
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const rows = items.map(v => [
    v.title, v.channelTitle, v.publishedAt?.slice(0, 10), v.views, v.likes, v.comments,
    fmtDuration(v.duration), `https://www.youtube.com/watch?v=${v.id}`,
  ].map(cell).join(';'));
  return '﻿' + [head.map(cell).join(';'), ...rows].join('\r\n');
}

export function download(name, text){
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
