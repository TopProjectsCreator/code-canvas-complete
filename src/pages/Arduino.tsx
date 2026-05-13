import { Link } from "react-router-dom";

export default function ArduinoPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-12 text-foreground">
      <div className="mx-auto max-w-4xl space-y-8 rounded-2xl border border-border bg-card/40 p-8">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-widest text-primary">Arduino &amp; ESP</p>
          <h1 className="text-4xl font-bold tracking-tight">Arduino in Code Canvas</h1>
          <p className="text-base text-muted-foreground">
            A full Arduino workflow in the browser: a purpose-built <code className="rounded bg-muted px-1">.ino</code> editor,
            an interactive breadboard simulator, cloud compilation, and direct flashing to AVR, ESP, SAM, and STM32
            boards over Web Serial — no Arduino IDE install required.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">What we implement</h2>
          <ul className="list-disc space-y-2 pl-6 text-sm text-muted-foreground">
            <li><strong>.ino editor.</strong> Syntax highlighting, brace matching, library auto-suggest, and AI inline completions tailored to Arduino C++.</li>
            <li><strong>Interactive breadboard.</strong> Snap-to-grid components (LEDs, sensors, buttons, OLED, DHT, HC-SR04) wired visually — the layout is persisted to <code className="rounded bg-muted px-1">circuit.json</code>.</li>
            <li><strong>In-browser simulator.</strong> Runs your sketch against the virtual breadboard with live pin states, serial monitor, and step mode.</li>
            <li><strong>Cloud compile via Godbolt.</strong> The <code className="rounded bg-muted px-1">compile-arduino</code> backend function returns Intel HEX (AVR), ARM binaries, or UF2.</li>
            <li><strong>Direct flashing over Web Serial.</strong> Native protocol implementations — no avrdude install:
              <ul className="mt-1 list-disc space-y-1 pl-6">
                <li>STK500v1 for ATmega328P (Uno / Nano / Pro Mini)</li>
                <li>AVR109 for ATmega32U4 (Leonardo / Micro)</li>
                <li>esptool for ESP32 / ESP8266 (incl. ESP32-S2/S3/C3)</li>
                <li>SAM-BA for SAMD boards</li>
                <li>STM32 serial bootloader &amp; DFU</li>
                <li>UF2 mass-storage for RP2040 / nRF</li>
              </ul>
            </li>
            <li><strong>Library manager.</strong> Resolve and bundle Arduino libraries into the cloud build.</li>
            <li><strong>Bluetooth bridge.</strong> Optional local <code className="rounded bg-muted px-1">tools/arduino-bridge</code> for HC-05/HC-06 serial flashing.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">The deploy pipeline</h2>
          <ol className="list-decimal space-y-2 pl-6 text-sm text-muted-foreground">
            <li>You select a board in the Arduino panel.</li>
            <li>The sketch + libraries are sent to <code className="rounded bg-muted px-1">compile-arduino</code>.</li>
            <li>The function compiles and returns a HEX/BIN/UF2 payload.</li>
            <li>The browser requests a serial port via Web Serial.</li>
            <li>The matching native protocol (STK500, AVR109, esptool, SAM-BA, DFU, UF2) runs entirely in JS to flash the binary.</li>
            <li>Verification + reset, then the board boots into your sketch.</li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">Supported boards</h2>
          <ul className="list-disc space-y-1 pl-6 text-sm text-muted-foreground">
            <li>Arduino Uno / Nano / Mega 2560 / Pro Mini</li>
            <li>Arduino Leonardo / Micro</li>
            <li>ESP32 (incl. S2 / S3 / C3) — OTA &amp; serial</li>
            <li>ESP8266 / Wemos D1 Mini / NodeMCU</li>
            <li>SAMD &amp; STM32 boards via SAM-BA / DFU</li>
            <li>RP2040 / nRF via UF2</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-semibold">AI assistance</h2>
          <p className="text-sm text-muted-foreground">
            Ask the assistant to add PWM, debounce a button, drive a DHT22, or wire a new component — it can edit
            both the sketch and the breadboard layout together so the simulation stays in sync with the code.
          </p>
        </section>

        <footer className="flex flex-wrap gap-4 border-t border-border pt-6 text-sm">
          <Link to="/editor" className="text-primary underline underline-offset-4">Open the editor</Link>
          <Link to="/FTC" className="text-primary underline underline-offset-4">See FTC implementation</Link>
          <Link to="/docs" className="text-primary underline underline-offset-4">Docs</Link>
        </footer>
      </div>
    </main>
  );
}
