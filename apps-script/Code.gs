/**
 * Parser YouTube — сбор роликов с YouTube прямо в Google Таблицу.
 *
 * Меню «Parser YouTube» → «Открыть панель поиска» открывает сайдбар справа,
 * там все фильтры поиска YouTube и большая кнопка «Поиск».
 * Результат построчно ложится в ячейки листа.
 *
 * Работает через встроенный сервис YouTube Data API v3, то есть под тем
 * Google-аккаунтом, которым вы вошли в Таблицы. Отдельный API-ключ не нужен.
 */

var SHEET_DEFAULT = 'YouTube';
var THUMB_COL = 4;
var TITLE_COL = 5;
var DESC_COL = 6;
var ROW_HEIGHT = 80;
var MAX_LIMIT = 500;

/**
 * Локали, где аргументы формулы разделяются запятой.
 * Во всех остальных, включая русскую, нужна точка с запятой:
 * =IMAGE("url"; 4; 68; 120)
 */
var COMMA_LOCALES = [
  'en_US', 'en_GB', 'en_AU', 'en_CA', 'en_IE', 'en_IN', 'en_NZ', 'en_ZA',
  'ja_JP', 'ko_KR', 'zh_CN', 'zh_TW', 'zh_HK', 'th_TH', 'ms_MY', 'hi_IN',
  'iw_IL', 'he_IL'
];

var HEADERS = [
  '№',
  'Ссылка',
  'Дата публикации',
  'Превью',
  'Название',
  'Описание',
  'Просмотры',
  'Лайки',
  'Комментарии',
  'Длительность',
  'Секунд',
  'Канал',
  'Ссылка на канал',
  'ID канала',
  'Качество',
  'Субтитры',
  'Лицензия',
  'Формат',
  'Встраивание',
  'Категория',
  'Язык',
  'Теги',
  'Статус',
  'Трансляция',
  'ID видео'
];

/** Пункт меню появляется при открытии таблицы. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Parser YouTube')
    .addItem('Открыть панель поиска', 'showSidebar')
    .addSeparator()
    .addItem('Очистить лист результатов', 'clearResultsSheet')
    .addToUi();
}

/** Ставится при установке скрипта как дополнения. */
function onInstall(e) {
  onOpen(e);
}

function showSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Parser YouTube');
  SpreadsheetApp.getUi().showSidebar(html);
}

function clearResultsSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_DEFAULT);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('Лист «' + SHEET_DEFAULT + '» не найден.');
    return;
  }
  sheet.clear();
  SpreadsheetApp.getUi().alert('Лист «' + SHEET_DEFAULT + '» очищен.');
}

/**
 * Главная точка входа из сайдбара.
 * @param {Object} form значения фильтров
 * @return {Object} {count, sheetName, quota}
 */
function runSearch(form) {
  form = form || {};
  var query = (form.q || '').trim();
  if (!query && !form.channelId) {
    throw new Error('Введите поисковый запрос или ID канала.');
  }

  var limit = Math.min(Math.max(parseInt(form.limit, 10) || 50, 1), MAX_LIMIT);
  var ids = collectVideoIds(form, query, limit);
  if (!ids.length) {
    return { count: 0, sheetName: sheetNameOf(form), quota: 0 };
  }

  var videos = fetchVideos(ids);
  var categories = fetchCategories(form.regionCode);
  var separator = formulaSeparator();
  var rows = videos.map(function (video, i) {
    return buildRow(video, i + 1, categories, separator);
  });

  var sheet = writeRows(form, rows);
  var pages = Math.ceil(ids.length / 50);
  return {
    count: rows.length,
    sheetName: sheet.getName(),
    quota: pages * 100 + Math.ceil(ids.length / 50) + 1
  };
}

/** Постранично забирает ID роликов через search.list. */
function collectVideoIds(form, query, limit) {
  var params = buildSearchParams(form, query);
  var ids = [];
  var pageToken = null;

  while (ids.length < limit) {
    params.maxResults = Math.min(50, limit - ids.length);
    if (pageToken) {
      params.pageToken = pageToken;
    } else {
      delete params.pageToken;
    }

    var response = YouTube.Search.list('id', params);
    var items = response.items || [];
    for (var i = 0; i < items.length; i++) {
      var id = items[i].id && items[i].id.videoId;
      if (id && ids.indexOf(id) === -1) {
        ids.push(id);
      }
    }

    pageToken = response.nextPageToken;
    if (!pageToken || !items.length) {
      break;
    }
  }

  return ids.slice(0, limit);
}

/** Собирает параметры search.list, пропуская пустые фильтры. */
function buildSearchParams(form, query) {
  var params = { type: 'video' };

  if (query) params.q = query;
  put(params, 'order', form.order);
  put(params, 'channelId', form.channelId);
  put(params, 'relevanceLanguage', form.relevanceLanguage);
  put(params, 'regionCode', form.regionCode);
  put(params, 'safeSearch', form.safeSearch);
  put(params, 'eventType', form.eventType);
  put(params, 'videoCategoryId', form.videoCategoryId);

  putFiltered(params, 'videoDuration', form.videoDuration);
  putFiltered(params, 'videoDefinition', form.videoDefinition);
  putFiltered(params, 'videoCaption', form.videoCaption);
  putFiltered(params, 'videoLicense', form.videoLicense);
  putFiltered(params, 'videoDimension', form.videoDimension);
  putFiltered(params, 'videoEmbeddable', form.videoEmbeddable);
  putFiltered(params, 'videoSyndicated', form.videoSyndicated);

  var after = toRfc3339(form.publishedAfter, false);
  var before = toRfc3339(form.publishedBefore, true);
  if (after) params.publishedAfter = after;
  if (before) params.publishedBefore = before;

  if (form.location && form.locationRadius) {
    params.location = String(form.location).replace(/\s+/g, '');
    params.locationRadius = String(form.locationRadius).replace(/\s+/g, '');
  }

  return params;
}

function put(params, key, value) {
  if (value !== null && value !== undefined && String(value).trim() !== '') {
    params[key] = String(value).trim();
  }
}

/** Как put, но 'any' означает «фильтр не применять». */
function putFiltered(params, key, value) {
  if (value && value !== 'any') {
    params[key] = value;
  }
}

/** '2024-01-31' → '2024-01-31T00:00:00Z' (или конец дня). */
function toRfc3339(value, endOfDay) {
  if (!value) return '';
  return value + (endOfDay ? 'T23:59:59Z' : 'T00:00:00Z');
}

/** Метаданные пачками по 50 штук, с сохранением исходного порядка. */
function fetchVideos(ids) {
  var parts = 'snippet,contentDetails,statistics,status,liveStreamingDetails';
  var byId = {};

  for (var i = 0; i < ids.length; i += 50) {
    var chunk = ids.slice(i, i + 50);
    var response = YouTube.Videos.list(parts, { id: chunk.join(',') });
    (response.items || []).forEach(function (item) {
      byId[item.id] = item;
    });
  }

  return ids.map(function (id) { return byId[id]; }).filter(function (v) { return !!v; });
}

/** Справочник категорий, чтобы писать название вместо цифры. */
function fetchCategories(regionCode) {
  var map = {};
  try {
    var response = YouTube.VideoCategories.list('snippet', {
      regionCode: regionCode || 'RU'
    });
    (response.items || []).forEach(function (item) {
      map[item.id] = item.snippet.title;
    });
  } catch (err) {
    // Справочник необязателен — без него просто останется ID категории.
  }
  return map;
}

/**
 * Чем разделять аргументы формулы в этой таблице.
 * Формула кладётся в ячейку через setValues, а он разбирает её по локали
 * документа: в русской нужна точка с запятой, в английской — запятая.
 */
function formulaSeparator() {
  var locale;
  try {
    locale = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetLocale();
  } catch (err) {
    locale = '';
  }
  return COMMA_LOCALES.indexOf(locale) === -1 ? ';' : ',';
}

/** Одна строка таблицы из одного ролика. */
function buildRow(video, index, categories, separator) {
  var snippet = video.snippet || {};
  var stats = video.statistics || {};
  var details = video.contentDetails || {};
  var status = video.status || {};
  var duration = parseDuration(details.duration);
  var categoryId = snippet.categoryId || '';

  return [
    index,
    'https://www.youtube.com/watch?v=' + video.id,
    toDate(snippet.publishedAt),
    thumbnailFormula(snippet.thumbnails, separator),
    snippet.title || '',
    snippet.description || '',
    toNumber(stats.viewCount),
    toNumber(stats.likeCount),
    toNumber(stats.commentCount),
    duration.text,
    duration.seconds,
    snippet.channelTitle || '',
    snippet.channelId ? 'https://www.youtube.com/channel/' + snippet.channelId : '',
    snippet.channelId || '',
    details.definition === 'hd' ? 'HD' : (details.definition ? 'SD' : ''),
    details.caption === 'true' ? 'Есть' : 'Нет',
    status.license === 'creativeCommon' ? 'Creative Commons' : 'Стандартная',
    details.dimension === '3d' ? '3D' : '2D',
    status.embeddable === false ? 'Запрещено' : 'Разрешено',
    categories[categoryId] || categoryId,
    snippet.defaultAudioLanguage || snippet.defaultLanguage || '',
    (snippet.tags || []).join(', '),
    status.privacyStatus || '',
    liveLabel(snippet.liveBroadcastContent, video.liveStreamingDetails),
    video.id
  ];
}

/** Превью картинкой прямо в ячейке. */
function thumbnailFormula(thumbnails, separator) {
  if (!thumbnails) return '';
  var thumb = thumbnails.medium || thumbnails.high || thumbnails.default;
  if (!thumb || !thumb.url) return '';
  var sep = separator || ';';
  return '=IMAGE("' + thumb.url + '"' + sep + ' 4' + sep + ' 68' + sep + ' 120)';
}

function liveLabel(broadcast, live) {
  if (broadcast === 'live') return 'Идёт эфир';
  if (broadcast === 'upcoming') return 'Запланирована';
  if (live && live.actualEndTime) return 'Завершённая трансляция';
  return 'Обычное видео';
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return '';
  var n = Number(value);
  return isNaN(n) ? '' : n;
}

function toDate(iso) {
  if (!iso) return '';
  var date = new Date(iso);
  return isNaN(date.getTime()) ? iso : date;
}

/** 'PT1H2M3S' → {text: '1:02:03', seconds: 3723} */
function parseDuration(iso) {
  if (!iso) return { text: '', seconds: '' };
  var match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!match) return { text: iso, seconds: '' };

  var days = Number(match[1] || 0);
  var hours = Number(match[2] || 0) + days * 24;
  var minutes = Number(match[3] || 0);
  var seconds = Number(match[4] || 0);
  var total = hours * 3600 + minutes * 60 + seconds;

  var text = hours
    ? hours + ':' + pad(minutes) + ':' + pad(seconds)
    : minutes + ':' + pad(seconds);

  return { text: text, seconds: total };
}

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

function sheetNameOf(form) {
  return (form.sheetName || '').trim() || SHEET_DEFAULT;
}

/** Пишет строки на лист и наводит внешний вид. */
function writeRows(form, rows) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var name = sheetNameOf(form);
  var sheet = ss.getSheetByName(name) || ss.insertSheet(name);

  if (form.clear) {
    sheet.clear();
  }

  var startRow;
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    startRow = 2;
  } else {
    startRow = sheet.getLastRow() + 1;
    if (!form.clear) {
      // Продолжаем нумерацию с того места, где остановились.
      var previous = sheet.getRange(startRow - 1, 1).getValue();
      if (typeof previous === 'number') {
        rows.forEach(function (row, i) { row[0] = previous + i + 1; });
      }
    }
  }

  sheet.getRange(startRow, 1, rows.length, HEADERS.length).setValues(rows);
  formatSheet(sheet, startRow, rows.length);
  SpreadsheetApp.flush();
  return sheet;
}

function formatSheet(sheet, startRow, count) {
  var header = sheet.getRange(1, 1, 1, HEADERS.length);
  header.setFontWeight('bold').setBackground('#f1f3f4');
  sheet.setFrozenRows(1);

  sheet.setColumnWidth(THUMB_COL, 140);
  sheet.setColumnWidth(TITLE_COL, 320);
  sheet.setColumnWidth(DESC_COL, 420);
  sheet.setRowHeights(startRow, count, ROW_HEIGHT);

  sheet.getRange(startRow, 3, count, 1).setNumberFormat('dd.MM.yyyy HH:mm');
  sheet.getRange(startRow, 7, count, 3).setNumberFormat('#,##0');
  sheet.getRange(startRow, DESC_COL, count, 1).setWrap(false);
  sheet.getRange(startRow, 1, count, HEADERS.length).setVerticalAlignment('middle');
}
