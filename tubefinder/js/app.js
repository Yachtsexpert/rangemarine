import * as store from './store.js';
import { signIn, signOut, getSession, getToken, onAuthChange } from './auth.js';
import { searchVideos, videoDetails, mySubscriptions, resolveChannelId } from './youtube.js';
import { parseDuration, applyFilters, sortItems } from './filters.js';
import { renderCards, renderStats, toCSV, download } from './ui.js';

const $ = (id) => document.getElementById(id);
const el = {
  form: $('search-form'), q: $('q'), titleOnly: $('title-only'),
  order: $('order'), max: $('max'), period: $('period'), customDates: $('custom-dates'),
  dateFrom: $('date-from'), dateTo: $('date-to'),
  duration: $('duration'), definition: $('definition'), region: $('region'), lang: $('lang'),
  viewsMin: $('views-min'), viewsMax: $('views-max'), lenMin: $('len-min'), lenMax: $('len-max'),
  include: $('include'), exclude: $('exclude'), channelName: $('channel-name'), channelId: $('channel-id'),
  noShorts: $('no-shorts'), onlyShorts: $('only-shorts'), cc: $('cc'), creative: $('creative'),
  embeddable: $('embeddable'), safe: $('safe'), onlySubs: $('only-subs'), hideSubs: $('hide-subs'),
  event: $('event'),
  btnSearch: $('btn-search'), btnMore: $('btn-more'), btnReset: $('btn-reset'), btnExport: $('btn-export'),
  clientSort: $('client-sort'), viewMode: $('view-mode'),
  list: $('results-list'), stats: $('stats'), error: $('error'), empty: $('empty'), title: $('results-title'),
  presetList: $('preset-list'), presetSave: $('btn-preset-save'), presetDel: $('btn-preset-del'),
  modal: $('modal'), inClient: $('in-client'), inKey: $('in-key'),
  btnSettings: $('btn-settings'), btnKeysSave: $('btn-keys-save'), btnKeysClose: $('btn-keys-close'),
  btnSignin: $('btn-signin'), btnSignout: $('btn-signout'), profile: $('profile'),
  profilePic: $('profile-pic'), profileName: $('profile-name'), profileMail: $('profile-mail'),
  acctHint: $('acct-hint'),
  tabSearch: $('tab-search'), tabSaved: $('tab-saved'), savedCount: $('saved-count'),
  collBar: $('coll-bar'), collSelect: $('coll-select'), collClear: $('btn-coll-clear'),
};

const FIELDS = ['q','titleOnly','order','max','period','dateFrom','dateTo','duration','definition','region','lang',
  'viewsMin','viewsMax','lenMin','lenMax','include','exclude','channelName','channelId','noShorts','onlyShorts',
  'cc','creative','embeddable','safe','onlySubs','hideSubs','event'];

const EMPTY_SEARCH = '<div class="empty-icon">🔍</div><p>Введите название ролика справа, настройте фильтры и нажмите <b>Поиск</b>.</p>';
const EMPTY_FILTERED = '<div class="empty-icon">🫧</div><p>Ничего не осталось после фильтров. Ослабьте условия справа.</p>';
const EMPTY_SAVED = '<div class="empty-icon">⭐</div><p>Коллекция пуста. Сохраняйте ролики кнопкой «☆ В коллекцию».</p>';
const NEW_COLLECTION = '__new__';

const state = {
  view: 'search',        // 'search' | 'saved'
  items: [],             // всё, что пришло от API
  displayed: [],         // то, что сейчас на экране (для экспорта и сохранения)
  pageTokens: {},        // токен следующей страницы для каждого запроса
  lastParams: null,
  subs: null,
};

/* ---------- форма ---------- */
function readForm(){
  const v = {};
  FIELDS.forEach(k => { const n = el[k]; v[k] = n.type === 'checkbox' ? n.checked : (n.value ?? '').trim(); });
  v.queries = v.q.split('\n').map(s => s.trim()).filter(Boolean);
  return v;
}
function writeForm(v){
  FIELDS.forEach(k => {
    if (!(k in v)) return;
    const n = el[k];
    if (n.type === 'checkbox') n.checked = !!v[k]; else n.value = v[k];
  });
  togglePeriod();
}
const togglePeriod = () => el.customDates.classList.toggle('hidden', el.period.value !== 'custom');

function apiParams(f){
  const p = {
    order: f.order,
    regionCode: f.region,
    relevanceLanguage: f.lang,
    videoDuration: f.duration,
    videoDefinition: f.definition,
    maxResults: 50,
  };
  if (f.cc) p.videoCaption = 'closedCaption';
  if (f.creative) p.videoLicense = 'creativeCommon';
  if (f.embeddable) p.videoEmbeddable = 'true';
  if (f.safe) p.safeSearch = 'strict';
  if (f.event) p.eventType = f.event;

  if (f.period === 'custom') {
    if (f.dateFrom) p.publishedAfter = new Date(`${f.dateFrom}T00:00:00Z`).toISOString();
    if (f.dateTo)   p.publishedBefore = new Date(`${f.dateTo}T23:59:59Z`).toISOString();
  } else if (f.period) {
    p.publishedAfter = new Date(Date.now() - Number(f.period) * 86400e3).toISOString();
  }
  return p;
}

const normalize = (id, s, d) => ({
  id,
  title: s.title,
  description: s.description,
  channelId: s.channelId,
  channelTitle: s.channelTitle,
  publishedAt: s.publishedAt,
  thumb: s.thumbnails?.medium?.url || s.thumbnails?.default?.url || '',
  duration: parseDuration(d?.contentDetails?.duration),
  views: Number(d?.statistics?.viewCount || 0),
  likes: Number(d?.statistics?.likeCount || 0),
  comments: Number(d?.statistics?.commentCount || 0),
  definition: d?.contentDetails?.definition,
  caption: d?.contentDetails?.caption,
});

/* ---------- поиск ---------- */
async function runSearch(append = false){
  const f = readForm();
  if (!f.queries.length) { el.q.focus(); return; }

  showView('search');
  setBusy(true);
  el.error.classList.add('hidden');
  const t0 = performance.now();

  try {
    if (!append) { state.items = []; state.pageTokens = {}; el.list.innerHTML = ''; }

    const base = apiParams(f);
    if (f.channelId) {
      const cid = await resolveChannelId(f.channelId);
      if (!cid) throw new Error(`Не удалось определить канал по «${f.channelId}»`);
      base.channelId = cid;
    }
    if ((f.onlySubs || f.hideSubs) && getToken() && !state.subs) {
      state.subs = await mySubscriptions();
    }

    const target = Number(f.max);
    const seen = new Set(state.items.map(v => v.id));

    for (const query of f.queries) {
      if (append && state.pageTokens[query] === null) continue;   // страницы по этому запросу кончились
      let token = append ? state.pageTokens[query] : undefined;
      let got = 0;

      while (got < target) {
        const res = await searchVideos({ ...base, q: query, pageToken: token });
        const raw = (res.items || []).filter(i => i.id?.videoId && !seen.has(i.id.videoId));
        const details = raw.length ? await videoDetails(raw.map(i => i.id.videoId)) : new Map();
        raw.forEach(i => {
          const id = i.id.videoId;
          seen.add(id);
          state.items.push({ ...normalize(id, i.snippet, details.get(id)), query });
          got++;
        });
        token = res.nextPageToken;
        if (!token) break;
      }
      state.pageTokens[query] = token || null;
    }

    state.lastParams = f;
    render();
    store.setPref('lastSearch', f);
    renderStats(el.stats, { fetched: state.items.length, shown: state.displayed.length, ms: performance.now() - t0 });
  } catch (e) {
    el.error.textContent = e.message;
    el.error.classList.remove('hidden');
  } finally {
    setBusy(false);
  }
}

/* ---------- отрисовка ---------- */
function render(){
  return state.view === 'saved' ? renderSaved() : renderResults();
}

function renderResults(){
  const f = state.lastParams || readForm();
  state.displayed = sortItems(
    applyFilters(state.items, { ...f, subs: state.subs || new Set() }),
    el.clientSort.value
  );
  renderCards(el.list, state.displayed, el.viewMode.value, {
    saved: store.savedIds(),
    showQuery: (f.queries || []).length > 1,
  });
  el.title.textContent = `Результаты · ${state.displayed.length}`;
  el.empty.innerHTML = state.items.length ? EMPTY_FILTERED : EMPTY_SEARCH;
  el.empty.classList.toggle('hidden', state.displayed.length > 0);
  el.btnMore.classList.toggle('hidden', !Object.values(state.pageTokens).some(Boolean));
  el.btnExport.disabled = !state.displayed.length;
}

function renderSaved(){
  const name = el.collSelect.value;
  const items = store.getCollections()[name] || [];
  state.displayed = sortItems(items, el.clientSort.value);
  renderCards(el.list, state.displayed, el.viewMode.value, { view: 'saved' });
  el.title.textContent = `${name} · ${items.length}`;
  el.empty.innerHTML = EMPTY_SAVED;
  el.empty.classList.toggle('hidden', items.length > 0);
  el.btnMore.classList.add('hidden');
  el.btnExport.disabled = !items.length;
}

function showView(view){
  state.view = view;
  el.tabSearch.classList.toggle('active', view === 'search');
  el.tabSaved.classList.toggle('active', view === 'saved');
  el.collBar.classList.toggle('hidden', view !== 'saved');
  el.stats.classList.toggle('hidden', view !== 'search' || !state.items.length);
  render();
}

function setBusy(on){
  el.btnSearch.disabled = on;
  el.btnSearch.querySelector('.search-btn-ico').innerHTML = on ? '<span class="spinner"></span>' : '🔎';
  el.btnSearch.querySelector('.search-btn-txt').textContent = on ? 'Ищем…' : 'Поиск';
}

/* ---------- коллекции ---------- */
function refreshCollections(selected){
  const names = store.collectionNames();
  const keep = selected || (names.includes(el.collSelect.value) ? el.collSelect.value : names[0]);
  el.collSelect.innerHTML = names.map(n => `<option value="${n}"${n === keep ? ' selected' : ''}>${n}</option>`).join('')
    + `<option value="${NEW_COLLECTION}">＋ новая коллекция…</option>`;
  el.savedCount.textContent = store.savedTotal();
}

const currentCollection = () => {
  const v = el.collSelect.value;
  return (!v || v === NEW_COLLECTION) ? store.collectionNames()[0] : v;
};

/* ---------- пресеты ---------- */
function refreshPresets(selected = ''){
  const p = store.getPresets();
  el.presetList.innerHTML = '<option value="">— пресеты —</option>' +
    Object.keys(p).map(n => `<option value="${n}"${n === selected ? ' selected' : ''}>${n}</option>`).join('');
}

/* ---------- аккаунт ---------- */
function refreshAuthUI(){
  const s = getSession();
  el.btnSignin.classList.toggle('hidden', !!s);
  el.profile.classList.toggle('hidden', !s);
  [el.onlySubs, el.hideSubs].forEach(n => { n.disabled = !s; if (!s) n.checked = false; });
  if (s) {
    el.profileName.textContent = s.profile?.name || 'Аккаунт Google';
    el.profileMail.textContent = s.profile?.email || '';
    if (s.profile?.picture) el.profilePic.src = s.profile.picture;
    el.acctHint.textContent = 'Вы вошли — поиск идёт от вашего аккаунта, доступны фильтры по подпискам.';
  } else {
    el.acctHint.textContent = 'Войдите через Google — станут доступны фильтры по вашим подпискам и поиск от вашего имени.';
  }
}

/* ---------- события ---------- */
el.form.addEventListener('submit', (e) => { e.preventDefault(); runSearch(false); });
el.q.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); runSearch(false); }
});
el.btnMore.addEventListener('click', () => runSearch(true));
el.period.addEventListener('change', togglePeriod);
el.clientSort.addEventListener('change', () => { store.setPref('sort', el.clientSort.value); render(); });
el.viewMode.addEventListener('change', () => { store.setPref('view', el.viewMode.value); render(); });
el.noShorts.addEventListener('change', () => { if (el.noShorts.checked) el.onlyShorts.checked = false; });
el.onlyShorts.addEventListener('change', () => { if (el.onlyShorts.checked) el.noShorts.checked = false; });

el.tabSearch.addEventListener('click', () => showView('search'));
el.tabSaved.addEventListener('click', () => showView('saved'));

el.collSelect.addEventListener('change', () => {
  if (el.collSelect.value === NEW_COLLECTION) {
    const name = prompt('Название новой коллекции:', 'Новая коллекция');
    if (name && name.trim()) {
      store.createCollection(name.trim());
      refreshCollections(name.trim());
    } else {
      refreshCollections();
    }
  }
  render();
});

el.collClear.addEventListener('click', () => {
  const name = currentCollection();
  if (confirm(`Удалить коллекцию «${name}» со всеми роликами?`)) {
    store.deleteCollection(name);
    refreshCollections();
    render();
  }
});

// сохранение и удаление роликов
el.list.addEventListener('click', (e) => {
  const saveBtn = e.target.closest('[data-save]');
  if (saveBtn) {
    const video = state.displayed.find(v => v.id === saveBtn.dataset.save);
    if (!video) return;
    const name = currentCollection();
    if (store.savedIds().has(video.id)) {
      store.removeFromCollection(name, video.id);
    } else {
      store.addToCollection(name, video);
    }
    refreshCollections();
    render();
    return;
  }
  const rmBtn = e.target.closest('[data-remove]');
  if (rmBtn) {
    store.removeFromCollection(currentCollection(), rmBtn.dataset.remove);
    refreshCollections();
    render();
  }
});

el.btnReset.addEventListener('click', () => {
  el.form.reset();
  togglePeriod();
  state.items = []; state.displayed = []; state.pageTokens = {}; state.lastParams = null;
  el.list.innerHTML = ''; el.stats.classList.add('hidden');
  el.empty.innerHTML = EMPTY_SEARCH;
  el.empty.classList.remove('hidden');
  el.title.textContent = 'Результаты';
  el.btnMore.classList.add('hidden');
});

el.btnExport.addEventListener('click', () => {
  const tag = state.view === 'saved' ? currentCollection().replace(/\s+/g, '-') : 'search';
  download(`tubefinder-${tag}-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(state.displayed));
});

el.presetSave.addEventListener('click', () => {
  const name = prompt('Название пресета:', el.q.value.split('\n')[0].slice(0, 40) || 'Мой поиск');
  if (!name) return;
  store.savePreset(name, readForm());
  refreshPresets(name);
});
el.presetDel.addEventListener('click', () => {
  const name = el.presetList.value;
  if (name && confirm(`Удалить пресет «${name}»?`)) { store.deletePreset(name); refreshPresets(); }
});
el.presetList.addEventListener('change', () => {
  const p = store.getPresets()[el.presetList.value];
  if (p) writeForm(p);
});

el.btnSettings.addEventListener('click', () => {
  el.inClient.value = store.getClientId();
  el.inKey.value = store.getApiKey();
  el.modal.classList.remove('hidden');
});
el.btnKeysClose.addEventListener('click', () => el.modal.classList.add('hidden'));
el.btnKeysSave.addEventListener('click', () => {
  store.setKeys(el.inClient.value, el.inKey.value);
  el.modal.classList.add('hidden');
});
el.modal.addEventListener('click', (e) => { if (e.target === el.modal) el.modal.classList.add('hidden'); });

el.btnSignin.addEventListener('click', async () => {
  try { await signIn(); }
  catch (e) { el.error.textContent = e.message; el.error.classList.remove('hidden'); }
});
el.btnSignout.addEventListener('click', () => { state.subs = null; signOut(); });
onAuthChange(refreshAuthUI);

/* ---------- старт ---------- */
(function init(){
  const prefs = store.getPrefs();
  if (prefs.sort) el.clientSort.value = prefs.sort;
  if (prefs.view) el.viewMode.value = prefs.view;
  if (prefs.lastSearch) writeForm({ ...prefs.lastSearch, q: prefs.lastSearch.q || '' });
  refreshPresets();
  refreshCollections();
  refreshAuthUI();
  togglePeriod();
  if (!store.getClientId() && !store.getApiKey()) el.modal.classList.remove('hidden');
})();
