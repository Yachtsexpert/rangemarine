/**
 * TubeFinder для Google Таблиц.
 *
 * Ищет ролики на YouTube и раскладывает их по ячейкам активной таблицы.
 * Работает через встроенную службу Apps Script «YouTube Data API v3»
 * (Редактор скриптов → Службы → + → YouTube Data API v3),
 * поэтому ни Google Cloud Console, ни OAuth-клиент, ни API-ключ не нужны.
 */

var HEADER = [
  'Название', 'Канал', 'Дата', 'Просмотры', 'Лайки', 'Комментарии',
  'Длительность', 'Секунды', 'Тип', 'Запрос', 'Ссылка', 'ID видео', 'Описание'
];

var PROP_LAST = 'tubefinder:last';

/* ---------- меню ---------- */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TubeFinder')
    .addItem('Поиск роликов…', 'showSidebar')
    .addItem('Повторить последний поиск', 'repeatLastSearch')
    .addToUi();
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('TubeFinder');
  SpreadsheetApp.getUi().showSidebar(html);
}

/** Настройки последнего поиска — боковая панель подставляет их при открытии. */
function getSavedSettings() {
  var raw = PropertiesService.getDocumentProperties().getProperty(PROP_LAST);
  return raw ? JSON.parse(raw) : null;
}

function repeatLastSearch() {
  var params = getSavedSettings();
  if (!params) {
    SpreadsheetApp.getUi().alert('Сохранённого поиска ещё нет — откройте «Поиск роликов…».');
    return;
  }
  var res = runSearch(params);
  SpreadsheetApp.getActiveSpreadsheet().toast(
    'Записано роликов: ' + res.written + ' (найдено ' + res.found + ')', 'TubeFinder', 5);
}

/* ---------- поиск ---------- */

/**
 * Главная точка входа: вызывается из боковой панели.
 * @param {Object} params настройки поиска
 * @return {Object} {found, written, sheetName}
 */
function runSearch(params) {
  var queries = String(params.q || '').split('\n')
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s.length; });
  if (!queries.length) throw new Error('Введите хотя бы один запрос.');

  var target = Number(params.max) || 50;
  var collected = [];
  var seen = {};

  queries.forEach(function (query) {
    var pageToken = null;
    var got = 0;

    while (got < target) {
      var res = YouTube.Search.list('snippet', searchArgs(params, query, pageToken));
      var fresh = (res.items || []).filter(function (item) {
        var id = item.id && item.id.videoId;
        return id && !seen[id];
      });

      if (fresh.length) {
        var ids = fresh.map(function (item) { return item.id.videoId; });
        var details = {};
        YouTube.Videos.list('snippet,contentDetails,statistics', {
          id: ids.join(','), maxResults: 50
        }).items.forEach(function (v) { details[v.id] = v; });

        fresh.forEach(function (item) {
          var id = item.id.videoId;
          seen[id] = true;
          collected.push(normalize(id, item.snippet, details[id], query));
          got++;
        });
      }

      pageToken = res.nextPageToken;
      if (!pageToken) break;
    }
  });

  var rows = sortRows(applyFilters(collected, params, queries), params.sort);
  var sheetName = writeToSheet(rows, params);

  PropertiesService.getDocumentProperties().setProperty(PROP_LAST, JSON.stringify(params));
  return { found: collected.length, written: rows.length, sheetName: sheetName };
}

/** Параметры для search.list — то, что умеет отфильтровать сам YouTube. */
function searchArgs(params, query, pageToken) {
  var args = { q: query, type: 'video', maxResults: 50 };

  if (params.order) args.order = params.order;
  if (params.region) args.regionCode = params.region;
  if (params.lang) args.relevanceLanguage = params.lang;
  if (params.duration && params.duration !== 'any') args.videoDuration = params.duration;
  if (params.definition && params.definition !== 'any') args.videoDefinition = params.definition;
  if (params.cc) args.videoCaption = 'closedCaption';
  if (params.creative) args.videoLicense = 'creativeCommon';
  if (params.safe) args.safeSearch = 'strict';
  if (params.event) args.eventType = params.event;
  if (params.channelId) args.channelId = resolveChannelId(params.channelId);
  if (pageToken) args.pageToken = pageToken;

  if (params.period === 'custom') {
    if (params.dateFrom) args.publishedAfter = new Date(params.dateFrom + 'T00:00:00Z').toISOString();
    if (params.dateTo) args.publishedBefore = new Date(params.dateTo + 'T23:59:59Z').toISOString();
  } else if (params.period) {
    var days = Number(params.period);
    args.publishedAfter = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  }
  return args;
}

/** Принимает UC…, @handle или ссылку на канал. */
function resolveChannelId(input) {
  var raw = String(input || '').trim();
  if (!raw) return '';
  var byId = raw.match(/(UC[\w-]{20,})/);
  if (byId) return byId[1];

  var handle = raw.match(/@([\w.\-]+)/);
  var q = handle ? handle[1] : raw.replace(/^https?:\/\/\S+\//, '');
  var res = YouTube.Search.list('snippet', { q: q, type: 'channel', maxResults: 1 });
  if (!res.items || !res.items.length) throw new Error('Канал «' + raw + '» не найден.');
  return res.items[0].snippet.channelId || res.items[0].id.channelId;
}

function normalize(id, snippet, details, query) {
  var content = (details && details.contentDetails) || {};
  var stats = (details && details.statistics) || {};
  var seconds = parseDuration(content.duration);
  return {
    id: id,
    title: snippet.title,
    description: snippet.description || '',
    channelTitle: snippet.channelTitle,
    channelId: snippet.channelId,
    publishedAt: snippet.publishedAt,
    seconds: seconds,
    views: Number(stats.viewCount || 0),
    likes: Number(stats.likeCount || 0),
    comments: Number(stats.commentCount || 0),
    definition: content.definition || '',
    query: query
  };
}

/* ---------- фильтры на стороне скрипта ---------- */

function words(str) {
  return String(str || '').split(',')
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(function (s) { return s.length; });
}

function applyFilters(items, params, queries) {
  var inc = words(params.include);
  var exc = words(params.exclude);
  var chan = String(params.channelName || '').toLowerCase();

  // «искать именно в названии»: ролик проходит, если совпал хотя бы с одним запросом
  var qSets = params.titleOnly ? queries.map(function (q) {
    return words(q.replace(/[,\s]+/g, ','));
  }).filter(function (set) { return set.length; }) : [];

  return items.filter(function (v) {
    var title = String(v.title).toLowerCase();
    var text = title + ' ' + String(v.description).toLowerCase();

    if (qSets.length && !qSets.some(function (set) {
      return set.every(function (w) { return title.indexOf(w) !== -1; });
    })) return false;

    if (inc.length && !inc.every(function (w) { return title.indexOf(w) !== -1; })) return false;
    if (exc.length && exc.some(function (w) { return text.indexOf(w) !== -1; })) return false;
    if (chan && String(v.channelTitle).toLowerCase().indexOf(chan) === -1) return false;

    if (params.viewsMin !== '' && params.viewsMin != null && v.views < Number(params.viewsMin)) return false;
    if (params.viewsMax !== '' && params.viewsMax != null && v.views > Number(params.viewsMax)) return false;
    if (params.lenMin !== '' && params.lenMin != null && v.seconds < Number(params.lenMin) * 60) return false;
    if (params.lenMax !== '' && params.lenMax != null && v.seconds > Number(params.lenMax) * 60) return false;

    if (params.noShorts && v.seconds && v.seconds <= 60) return false;
    if (params.onlyShorts && !(v.seconds && v.seconds <= 60)) return false;

    return true;
  });
}

function sortRows(items, mode) {
  var by = {
    views: function (a, b) { return b.views - a.views; },
    likes: function (a, b) { return b.likes - a.likes; },
    date: function (a, b) { return new Date(b.publishedAt) - new Date(a.publishedAt); },
    'date-asc': function (a, b) { return new Date(a.publishedAt) - new Date(b.publishedAt); },
    duration: function (a, b) { return b.seconds - a.seconds; },
    engagement: function (a, b) {
      return (b.likes / Math.max(b.views, 1)) - (a.likes / Math.max(a.views, 1));
    }
  }[mode];
  return by ? items.slice().sort(by) : items;
}

function parseDuration(iso) {
  var m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!m) return 0;
  var d = Number(m[1] || 0), h = Number(m[2] || 0), mi = Number(m[3] || 0), s = Number(m[4] || 0);
  return d * 86400 + h * 3600 + mi * 60 + s;
}

function formatDuration(sec) {
  if (!sec) return '';
  var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  return h ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
}

/* ---------- запись в таблицу ---------- */

function writeToSheet(items, params) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet;

  if (params.target === 'new') {
    var base = (String(params.q || '').split('\n')[0] || 'Поиск').slice(0, 60);
    var name = base + ' ' + Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'dd.MM HH:mm');
    sheet = ss.insertSheet(name.replace(/[\[\]\*\/\\\?:]/g, ' '));
  } else {
    sheet = ss.getActiveSheet();
    if (params.clear) sheet.clear();
  }

  var startRow = 1;
  if (sheet.getLastRow() > 0 && !params.clear && params.target !== 'new') {
    startRow = sheet.getLastRow() + 1;   // дописываем в конец
  }

  var rows = items.map(function (v) {
    return [
      v.title,
      v.channelTitle,
      v.publishedAt ? new Date(v.publishedAt) : '',
      v.views,
      v.likes,
      v.comments,
      formatDuration(v.seconds),
      v.seconds,
      (v.seconds && v.seconds <= 60) ? 'Shorts' : 'видео',
      v.query,
      'https://www.youtube.com/watch?v=' + v.id,
      v.id,
      String(v.description).slice(0, 500)
    ];
  });

  var writeHeader = startRow === 1;
  if (writeHeader) {
    sheet.getRange(1, 1, 1, HEADER.length).setValues([HEADER])
      .setFontWeight('bold').setBackground('#f1f3f4');
    sheet.setFrozenRows(1);
    startRow = 2;
  }

  if (rows.length) {
    sheet.getRange(startRow, 1, rows.length, HEADER.length).setValues(rows);
    sheet.getRange(startRow, 3, rows.length, 1).setNumberFormat('dd.mm.yyyy');
    sheet.getRange(startRow, 4, rows.length, 3).setNumberFormat('# ##0');
  }

  if (writeHeader) {
    [320, 160, 90, 90, 80, 100, 100, 80, 70, 120, 260, 120, 400]
      .forEach(function (w, i) { sheet.setColumnWidth(i + 1, w); });
  }

  sheet.activate();
  return sheet.getName();
}
