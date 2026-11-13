# Видео (Remotion)

Видео в коде: каждый кадр — это React-компонент. Результат — обычный MP4.

## Быстрый старт

```bash
cd video
npm install          # один раз
npm run dev          # открывает Remotion Studio (превью с таймлайном) в браузере
```

Правьте `src/Video.tsx` — превью обновляется само.

## Где что менять

| Что | Где |
|---|---|
| Формат (9:16 / 16:9), FPS | `VIDEO_WIDTH`, `VIDEO_HEIGHT`, `VIDEO_FPS` в `src/Video.tsx` |
| Тексты, цвета, длительность сцен | массив `scenes` в `src/Video.tsx` |
| Анимация появления | `interpolate(frame, [от, до], [было, стало])` в `Scene` |
| Регистрация ролика | `src/Root.tsx` (`<Composition id="Video" …>`) |
| Свои файлы (видео, фото, музыка, лого) | папка `public/`, подключаются через `staticFile("имя.mp4")` |

## Рендер

```bash
npx remotion still Video --frame=30 out/check.png   # проверить один кадр
npx remotion render Video out/video.mp4             # готовый MP4
```

## Правила, чтобы не ломалось

1. Анимация — только через `useCurrentFrame()` + `interpolate`. CSS `transition`/`animation` не работают.
2. Секунды → кадры: `seconds * fps`.
3. Текст держите в безопасной зоне: поля ~80 px по бокам, ~100 px сверху/снизу.
4. Одна идея на сцену; если тесно — разнесите по времени, а не уменьшайте шрифт.

## Что добавлять дальше

```bash
npx remotion add @remotion/media        # <Video>/<Audio>: свои клипы и музыка
npx remotion add @remotion/transitions  # переходы между сценами (fade, slide, wipe)
npx remotion add @remotion/captions     # субтитры
npx remotion add @remotion/google-fonts # шрифты
```

Видеофайл: положите `clip.mp4` в `public/` и вставьте
`<Video src={staticFile("clip.mp4")} />` (из `@remotion/media`) внутрь сцены.
Музыка: `<Audio src={staticFile("music.mp3")} volume={0.4} />`.

## Если Remotion не может скачать браузер (нет доступа к remotion.media)

Укажите установленный Chrome/Chromium вручную:

```bash
npx remotion render Video out/video.mp4 --browser-executable=/путь/к/chrome --chrome-mode=chrome-for-testing
```

---

# Reels по методу 3R (Reveal → Prove → Invite)

Композиция `Reel` собирает честный вертикальный ролик 1080×1920, 30 fps из **ваших реальных** фото и видео.
Полная методика и стадии работы: `skills/authentic-destination-reels/SKILL.md`.
Всё бесплатно: Ken Burns и склейки делает сам Remotion, генеративный ИИ и платные кредиты не используются.

## Как сделать Reel

1. Положите свои фото (`.jpg/.png`) и видео (`.mp4`) в `public/reel/`. Папка в git не попадает.
2. Скопируйте `src/reel/reel.example.json` в `src/reel/reel.json` и заполните:
   - `destination`, `language` (`ru`/`tr`/`en`), `goal`;
   - `shots` — 4–7 шотов: первый `reveal` (хук, 3–4 с), средние `prove` (реальные детали), последний `invite` (призыв);
   - `cta` и `contact` — только если дал клиент. Пусто = нейтральный вопрос («Поехали бы сюда?»), без выдуманных ссылок и цен;
   - `rightsConfirmed: true` — только когда подтверждены права на фото, видео, людей в кадре и музыку.
3. `npm run dev` и выберите композицию **Reel** — превью.
4. Проверка и рендер:
```bash
npx remotion still Reel --frame=60 out/check.png
npx remotion render Reel out/reel.mp4
```

## Встроенные проверки (по SKILL.md)
| Ситуация | Что делает проект |
|---|---|
| Нет ни одного шота | `HOLD`: рендер остановлен, текст подсказывает, что загрузить |
| Права не подтверждены | Рендер возможен, на видео плашка «ЧЕРНОВИК · права не подтверждены» |
| Цифры в подписи без `factSource` | Предупреждение «Требует проверки» (цена/время/дата не публикуются без источника) |
| Музыка без `licensed: true` | `HOLD` |
| Файл `.mp4` в шоте | Берётся реальное движение, без искусственного зума |

Что проект **не** делает: не генерирует кадры и клипы ИИ, не придумывает факты, цены и ссылки на бронирование.

## Производство и контроль стоимости
Каркас стадий — `production/01…09` (в каждой `attempts/ approved/ disapproved/`; дальше идёт только `approved/`).
Лог генераций — `production/cost-log.csv`, итог — `node scripts/cost.mjs`.
Что подтверждено и что нет по бесплатным инструментам — `docs/FREE-PIPELINE.md`.
