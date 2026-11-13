import {
  AbsoluteFill,
  Easing,
  Series,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

// ===== НАСТРОЙКИ ВИДЕО =====
export const VIDEO_WIDTH = 1080; // вертикальное 9:16 (Reels/Shorts/TikTok). Для YouTube: 1920x1080
export const VIDEO_HEIGHT = 1920;
export const VIDEO_FPS = 30;

// ===== СЦЕНЫ: меняйте текст и длительность (в секундах) =====
const scenes = [
  { title: "Заголовок", subtitle: "Первая сцена — зацепите зрителя", seconds: 3, bg: "#0b3d5c" },
  { title: "Главная мысль", subtitle: "Одна идея на одну сцену", seconds: 4, bg: "#14506e" },
  { title: "Призыв к действию", subtitle: "Что сделать зрителю дальше", seconds: 3, bg: "#0b3d5c" },
];

export const totalDuration = scenes.reduce((s, sc) => s + sc.seconds * VIDEO_FPS, 0);

const Scene: React.FC<{ title: string; subtitle: string; bg: string }> = ({
  title,
  subtitle,
  bg,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const ease = Easing.bezier(0.16, 1, 0.3, 1);

  // Все анимации — только через frame (CSS-анимации в Remotion не работают)
  const titleOpacity = interpolate(frame, [0, 0.5 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const titleY = interpolate(frame, [0, 0.6 * fps], [60, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
  const subOpacity = interpolate(frame, [0.4 * fps, 0.9 * fps], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: bg,
        justifyContent: "center",
        alignItems: "center",
        padding: "100px 80px", // безопасные поля
        fontFamily: "Helvetica, Arial, sans-serif",
        color: "white",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 120,
          fontWeight: 800,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 52, marginTop: 40, opacity: subOpacity }}>{subtitle}</div>
    </AbsoluteFill>
  );
};

export const Video: React.FC = () => (
  <Series>
    {scenes.map((sc, i) => (
      <Series.Sequence key={i} durationInFrames={sc.seconds * VIDEO_FPS}>
        <Scene title={sc.title} subtitle={sc.subtitle} bg={sc.bg} />
      </Series.Sequence>
    ))}
  </Series>
);
