import {
  AbsoluteFill,
  Audio,
  Easing,
  Img,
  OffthreadVideo,
  Series,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Motion, NEUTRAL_CTA, ReelConfig, Shot } from "./types";

export const REEL_FPS = 30;
export const REEL_W = 1080;
export const REEL_H = 1920;

const isVideo = (src: string) => /\.(mp4|mov|webm)$/i.test(src);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const kenBurns = (motion: Motion, p: number) => {
  switch (motion) {
    case "zoom-out": return { scale: 1.14 - 0.14 * p, x: 0 };
    case "pan-left": return { scale: 1.12, x: 40 - 80 * p };
    case "pan-right": return { scale: 1.12, x: -40 + 80 * p };
    case "none": return { scale: 1, x: 0 };
    default: return { scale: 1 + 0.12 * p, x: 0 };
  }
};

const ShotView: React.FC<{ shot: Shot; caption?: string; big: boolean }> = ({ shot, caption, big }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const p = interpolate(frame, [0, durationInFrames], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const { scale, x } = kenBurns(shot.motion ?? "zoom-in", p);
  const capOpacity = interpolate(frame, [0.2 * fps, 0.7 * fps], [0, 1], clamp);
  const capY = interpolate(frame, [0.2 * fps, 0.8 * fps], [30, 0], { ...clamp, easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const src = staticFile(shot.src);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000", overflow: "hidden" }}>
      {isVideo(shot.src) ? (
        <OffthreadVideo src={src} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `translateX(${x}px) scale(${scale})` }} />
      )}
      {caption ? (
        <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: "100px 80px 220px" }}>
          <div
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontWeight: 800,
              fontSize: big ? 96 : 64,
              lineHeight: 1.1,
              color: "#fff",
              textAlign: "center",
              background: "rgba(0,0,0,0.55)",
              padding: "28px 40px",
              borderRadius: 28,
              opacity: capOpacity,
              transform: `translateY(${capY}px)`,
            }}
          >
            {caption}
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};

export const Reel: React.FC<{ reel: ReelConfig }> = ({ reel }) => {
  const last = reel.shots.length - 1;
  const cta = reel.cta?.trim() || NEUTRAL_CTA[reel.language];
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <Series>
        {reel.shots.map((s, i) => {
          // Reveal: хук в начале; Invite: CTA в конце (+ контакт, только если дан клиентом)
          const caption =
            i === last && s.role === "invite"
              ? [s.caption, cta, reel.contact].filter(Boolean).join("\n")
              : s.caption;
          return (
            <Series.Sequence key={s.id} durationInFrames={Math.round(s.seconds * REEL_FPS)}>
              <ShotView shot={s} caption={caption} big={s.role === "reveal"} />
            </Series.Sequence>
          );
        })}
      </Series>
      {reel.music?.licensed ? <Audio src={staticFile(reel.music.src)} volume={0.5} /> : null}
      {!reel.rightsConfirmed ? (
        <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", paddingTop: 110 }}>
          <div style={{ fontFamily: "Arial, sans-serif", fontSize: 38, fontWeight: 700, color: "#fff", background: "rgba(200,30,30,0.85)", padding: "10px 24px", borderRadius: 12 }}>
            ЧЕРНОВИК · права не подтверждены
          </div>
        </AbsoluteFill>
      ) : null}
    </AbsoluteFill>
  );
};
