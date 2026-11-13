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
