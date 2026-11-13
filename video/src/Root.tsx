import { Composition } from "remotion";
import { Video, VIDEO_FPS, VIDEO_HEIGHT, VIDEO_WIDTH, totalDuration } from "./Video";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Video"
      component={Video}
      durationInFrames={totalDuration}
      fps={VIDEO_FPS}
      width={VIDEO_WIDTH}
      height={VIDEO_HEIGHT}
    />
  );
};
