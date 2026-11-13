import { Composition } from "remotion";
import { Reel, REEL_FPS, REEL_H, REEL_W } from "./reel/Reel";
import { validateReel } from "./reel/validate";
import reel from "./reel/reel.json";
import { ReelConfig } from "./reel/types";
import { Video, VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH, totalDuration } from "./Video";

export const RemotionRoot: React.FC = () => {
  return (
    <>
    <Composition
      id="Reel"
      component={Reel}
      durationInFrames={90}
      fps={REEL_FPS}
      width={REEL_W}
      height={REEL_H}
      defaultProps={{ reel: reel as ReelConfig }}
      calculateMetadata={({ props }) => {
        const errors = validateReel(props.reel);
        const hold = errors.filter((e) => e.startsWith("HOLD"));
        if (hold.length) throw new Error(hold.join("\n"));
        errors.forEach((e) => console.warn(e));
        const frames = props.reel.shots.reduce((a, s) => a + Math.round(s.seconds * REEL_FPS), 0);
        return { durationInFrames: frames };
      }}
    />
    <Composition
      id="Video"
      component={Video}
      durationInFrames={totalDuration}
      fps={VIDEO_FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
    />
    </>
  );
};
