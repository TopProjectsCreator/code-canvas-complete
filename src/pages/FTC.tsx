import { Link } from "react-router-dom";

export default function FTCPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-border bg-card/40 p-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-primary">FIRST Tech Challenge</p>
          <h1 className="text-4xl font-bold tracking-tight">FTC in Code Canvas</h1>
          <p className="text-base text-muted-foreground">
            A complete browser-based workflow for FTC teams: write OpModes, configure hardware, build a real APK in
            the cloud, and flash it directly to a REV Control Hub over USB — no Android Studio install required.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What we implement</h2>
          <ul className="list-disc space-y-2 pl-6 text-sm text-muted-foreground">
            <li><strong>FtcRobotController clone.</strong> The official FTC SDK 10.x is cloned directly from the wpilibsuite GitHub repos when you create an FTC project.</li>
            <li><strong>Java &amp; Kotlin OpModes.</strong> Templates for TeleOp, Autonomous, and LinearOpMode patterns.</li>
            <li><strong>Hardware configuration editor.</strong> Visual editor for the robot config JSON — declare motors, servos, sensors, and I2C devices without hand-editing XML.</li>
            <li><strong>Cloud Gradle compile.</strong> The <code className="rounded bg-muted px-1">compile-ftc</code> backend function builds your TeamCode module and returns a signed APK.</li>
            <li><strong>ADB-over-WebUSB flashing.</strong> The browser talks ADB directly to a REV Control Hub via WebUSB and runs <code className="rounded bg-muted px-1">pm install -r</code>.</li>
            <li><strong>Live logcat.</strong> Stream <code className="rounded bg-muted px-1">RobotCore</code> and <code className="rounded bg-muted px-1">TeamCode</code> log lines back into the IDE for debugging.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">The deploy pipeline</h2>
          <ol className="list-decimal space-y-2 pl-6 text-sm text-muted-foreground">
            <li>You hit <strong>Build &amp; Deploy</strong> in the FTC panel.</li>
            <li>Source files are sent to the <code className="rounded bg-muted px-1">compile-ftc</code> edge function.</li>
            <li>Gradle builds the APK against the FTC SDK and returns it as base64.</li>
            <li>The browser requests a USB device with the ADB interface filter.</li>
            <li>An ADB handshake is performed in JavaScript (<code className="rounded bg-muted px-1">src/lib/webusb-adb.ts</code>).</li>
            <li>The APK is pushed to <code className="rounded bg-muted px-1">/sdcard/FIRST/TeamCode.apk</code> and installed.</li>
            <li>logcat is polled and streamed back into the panel.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Supported hardware</h2>
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li>REV Control Hub (FTC SDK 10.x)</li>
            <li>REV Expansion Hub (via Control Hub)</li>
            <li>Any WebUSB-capable browser on Chrome/Edge desktop</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">AI assistance</h2>
          <p className="text-sm text-muted-foreground">
            The assistant understands FTC SDK conventions — it can scaffold OpModes, wire hardware map names to
            your config, suggest PID tuning, and explain DS errors from logcat.
          </p>
        </section>

        <footer className="flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
          <Link to="/editor" className="text-primary underline underline-offset-4">Open the editor</Link>
          <Link to="/ardurino" className="text-primary underline underline-offset-4">See Arduino implementation</Link>
          <Link to="/docs" className="text-primary underline underline-offset-4">Docs</Link>
        </footer>
      </div>
    </main>
  );
}
