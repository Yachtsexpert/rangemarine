import { ReelConfig } from "./types";

/** Возвращает список блокирующих проблем (статус HOLD). Пусто = можно рендерить. */
export const validateReel = (r: ReelConfig): string[] => {
  const e: string[] = [];
  if (!r.shots || r.shots.length === 0) {
    e.push("HOLD: нет материала. Положите хотя бы 1 своё фото/видео в public/reel/ и добавьте шот в src/reel/reel.json.");
  }
  r.shots?.forEach((s) => {
    if (!s.src) e.push(`HOLD: у шота ${s.id} не указан файл.`);
    if (!(s.seconds > 0)) e.push(`HOLD: у шота ${s.id} некорректная длительность.`);
    if (s.caption && /\d/.test(s.caption) && !s.factSource) {
      e.push(`Требует проверки: в подписи шота ${s.id} есть цифры (цена/время/дата?), но не указан factSource.`);
    }
  });
  if (r.music && !r.music.licensed) {
    e.push("HOLD: музыка без подтверждённой лицензии. Уберите music или поставьте licensed: true, если лицензия есть.");
  }
  const total = r.shots?.reduce((a, s) => a + s.seconds, 0) ?? 0;
  if (total > 90) e.push(`Слишком длинно для Reels: ${total} с.`);
  return e;
};
