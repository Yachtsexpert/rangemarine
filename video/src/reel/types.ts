export type Lang = "ru" | "tr" | "en";
export type Role = "reveal" | "prove" | "invite";
export type Motion = "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "none";

export type Shot = {
  id: string;
  /** Файл в public/reel/, например "reel/pamukkale-1.jpg" или ".mp4". Только свои/лицензированные. */
  src: string;
  seconds: number;
  role: Role;
  /** Короткая подпись. Любой факт в ней должен быть в `factSource`. */
  caption?: string;
  /** Откуда взят факт из подписи (слова клиента, документ, программа тура). Пусто = подпись без фактов. */
  factSource?: string;
  /** Ken Burns для фото. Для видео не применяется (реальное движение). */
  motion?: Motion;
};

export type ReelConfig = {
  destination: string;
  language: Lang;
  goal: "awareness" | "inquiry" | "booking";
  brand?: string;
  /** Подтверждены права на коммерческую публикацию фото/видео/музыки/людей в кадре. */
  rightsConfirmed: boolean;
  /** CTA. Если пусто — нейтральный вопрос на выбранном языке. Никаких выдуманных ссылок/цен. */
  cta?: string;
  /** Контакт только если его дал клиент. */
  contact?: string;
  music?: { src: string; licensed: boolean };
  shots: Shot[];
};

export const NEUTRAL_CTA: Record<Lang, string> = {
  ru: "Поехали бы сюда?",
  tr: "Burayı ziyaret eder miydin?",
  en: "Would you visit?",
};
