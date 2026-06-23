import { Composition, registerRoot } from "remotion";
import { RedactorAnimation } from "./RedactorAnimation";
import { LspAnimation } from "./LspAnimation";

const FPS = 30;

const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="RedactorImageRedaction"
        component={RedactorAnimation}
        durationInFrames={39 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
      <Composition
        id="LspIntroduction"
        component={LspAnimation}
        durationInFrames={36 * FPS}
        fps={FPS}
        width={1920}
        height={1080}
      />
    </>
  );
};

registerRoot(Root);
