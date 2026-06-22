import { Composition, registerRoot } from "remotion";
import { RedactorAnimation } from "./RedactorAnimation";

const FPS = 30;

const Root: React.FC = () => {
  return (
    <Composition
      id="RedactorImageRedaction"
      component={RedactorAnimation}
      durationInFrames={32 * FPS}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};

registerRoot(Root);
