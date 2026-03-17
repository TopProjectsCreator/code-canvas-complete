const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Minimal Arduino core stubs so simple sketches compile with avr-gcc
const ARDUINO_CORE_STUBS = `
#include <avr/io.h>
#include <avr/interrupt.h>
#include <util/delay.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2
#define LED_BUILTIN 13
#define A0 14
#define A1 15
#define A2 16
#define A3 17
#define A4 18
#define A5 19

#define DEC 10
#define HEX 16
#define OCT 8
#define BIN 2

typedef uint8_t byte;
typedef bool boolean;

// Timekeeping
volatile unsigned long _millis_count = 0;
ISR(TIMER0_OVF_vect) { _millis_count++; }

unsigned long millis() { return _millis_count; }
unsigned long micros() { return _millis_count * 1000UL; }

void delay(unsigned long ms) {
  unsigned long start = millis();
  while (millis() - start < ms) {}
}

void delayMicroseconds(unsigned int us) {
  while (us--) { __asm__ __volatile__("nop"); }
}

// Digital I/O
void pinMode(uint8_t pin, uint8_t mode) {
  volatile uint8_t *ddr;
  uint8_t bit;
  if (pin <= 7) { ddr = &DDRD; bit = pin; }
  else if (pin <= 13) { ddr = &DDRB; bit = pin - 8; }
  else { ddr = &DDRC; bit = pin - 14; }

  if (mode == OUTPUT) *ddr |= (1 << bit);
  else *ddr &= ~(1 << bit);

  if (mode == INPUT_PULLUP) {
    volatile uint8_t *port;
    if (pin <= 7) port = &PORTD;
    else if (pin <= 13) port = &PORTB;
    else port = &PORTC;
    *port |= (1 << bit);
  }
}

void digitalWrite(uint8_t pin, uint8_t val) {
  volatile uint8_t *port;
  uint8_t bit;
  if (pin <= 7) { port = &PORTD; bit = pin; }
  else if (pin <= 13) { port = &PORTB; bit = pin - 8; }
  else { port = &PORTC; bit = pin - 14; }

  if (val) *port |= (1 << bit);
  else *port &= ~(1 << bit);
}

int digitalRead(uint8_t pin) {
  volatile uint8_t *pinr;
  uint8_t bit;
  if (pin <= 7) { pinr = &PIND; bit = pin; }
  else if (pin <= 13) { pinr = &PINB; bit = pin - 8; }
  else { pinr = &PINC; bit = pin - 14; }
  return (*pinr & (1 << bit)) ? HIGH : LOW;
}

// Analog
int analogRead(uint8_t pin) {
  uint8_t ch = (pin >= 14) ? pin - 14 : pin;
  ADMUX = (1 << REFS0) | (ch & 0x07);
  ADCSRA = (1 << ADEN) | (1 << ADSC) | (1 << ADPS2) | (1 << ADPS1) | (1 << ADPS0);
  while (ADCSRA & (1 << ADSC)) {}
  return ADC;
}

void analogWrite(uint8_t pin, int val) {
  pinMode(pin, OUTPUT);
  if (val <= 0) { digitalWrite(pin, LOW); return; }
  if (val >= 255) { digitalWrite(pin, HIGH); return; }
  // Simplified PWM for pins 3,5,6,9,10,11
  switch(pin) {
    case 3: TCCR2A |= (1<<COM2B1); OCR2B = val; break;
    case 5: TCCR0A |= (1<<COM0B1); OCR0B = val; break;
    case 6: TCCR0A |= (1<<COM0A1); OCR0A = val; break;
    case 9: TCCR1A |= (1<<COM1A1); OCR1A = val; break;
    case 10: TCCR1A |= (1<<COM1B1); OCR1B = val; break;
    case 11: TCCR2A |= (1<<COM2A1); OCR2A = val; break;
  }
}

// Serial class
class HardwareSerial {
public:
  void begin(unsigned long baud) {
    uint16_t ubrr = (F_CPU / 16 / baud) - 1;
    UBRR0H = (uint8_t)(ubrr >> 8);
    UBRR0L = (uint8_t)ubrr;
    UCSR0B = (1 << RXEN0) | (1 << TXEN0);
    UCSR0C = (1 << UCSZ01) | (1 << UCSZ00);
  }

  void end() { UCSR0B = 0; }

  int available() { return (UCSR0A & (1 << RXC0)) ? 1 : 0; }

  int read() {
    while (!(UCSR0A & (1 << RXC0))) {}
    return UDR0;
  }

  size_t write(uint8_t c) {
    while (!(UCSR0A & (1 << UDRE0))) {}
    UDR0 = c;
    return 1;
  }

  size_t write(const uint8_t *buf, size_t size) {
    for (size_t i = 0; i < size; i++) write(buf[i]);
    return size;
  }

  size_t print(const char *s) {
    size_t n = 0;
    while (*s) { write(*s++); n++; }
    return n;
  }

  size_t print(int val, int base = DEC) {
    char buf[17];
    itoa(val, buf, base);
    return print(buf);
  }

  size_t print(unsigned int val, int base = DEC) {
    char buf[17];
    utoa(val, buf, base);
    return print(buf);
  }

  size_t print(long val, int base = DEC) {
    char buf[17];
    ltoa(val, buf, base);
    return print(buf);
  }

  size_t print(double val, int digits = 2) {
    char buf[32];
    dtostrf(val, 0, digits, buf);
    return print(buf);
  }

  size_t println() { return write('\\r') + write('\\n'); }

  size_t println(const char *s) { return print(s) + println(); }

  size_t println(int val, int base = DEC) { return print(val, base) + println(); }

  size_t println(unsigned int val, int base = DEC) { return print(val, base) + println(); }

  size_t println(long val, int base = DEC) { return print(val, base) + println(); }

  size_t println(double val, int digits = 2) { return print(val, digits) + println(); }
};

HardwareSerial Serial;

// Map / constrain
long map(long x, long in_min, long in_max, long out_min, long out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

long constrain(long x, long a, long b) {
  if (x < a) return a;
  if (x > b) return b;
  return x;
}

#define min(a,b) ((a)<(b)?(a):(b))
#define max(a,b) ((a)>(b)?(a):(b))

// tone / noTone stubs
void tone(uint8_t pin, unsigned int frequency, unsigned long duration = 0) {
  (void)pin; (void)frequency; (void)duration;
}
void noTone(uint8_t pin) { (void)pin; }

// Forward declarations for user sketch
void setup();
void loop();

// Timer0 init for millis
void _init_timer0() {
  TCCR0A = (1 << WGM01) | (1 << WGM00);
  TCCR0B = (1 << CS01) | (1 << CS00); // prescaler 64
  TIMSK0 = (1 << TOIE0);
}

int main() {
  _init_timer0();
  sei();
  setup();
  while (1) loop();
  return 0;
}
`;

// Minimal ARM core stubs for Renesas RA4M1 (Arduino Uno R4 WiFi)
const ARM_CORE_STUBS = `
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2
#define LED_BUILTIN 13
#define A0 14
#define A1 15
#define A2 16
#define A3 17
#define A4 18
#define A5 19

#define DEC 10
#define HEX 16
#define OCT 8
#define BIN 2

typedef uint8_t byte;
typedef bool boolean;

// RA4M1 register base addresses (simplified)
#define IOPORT_BASE 0x40040000UL
#define SCI0_BASE   0x40070000UL

// Simplified volatile register access
#define REG32(addr) (*(volatile uint32_t*)(addr))
#define REG8(addr)  (*(volatile uint8_t*)(addr))

// SysTick for millis
volatile unsigned long _millis_count = 0;

extern "C" void SysTick_Handler(void) {
  _millis_count++;
}

unsigned long millis() { return _millis_count; }
unsigned long micros() { return _millis_count * 1000UL; }

void delay(unsigned long ms) {
  unsigned long start = millis();
  while (millis() - start < ms) {}
}

void delayMicroseconds(unsigned int us) {
  volatile unsigned int count = us * (48 / 4); // ~48MHz, 4 cycles per loop
  while (count--) { __asm__ __volatile__("nop"); }
}

// Simplified GPIO — maps Arduino pins to port/bit pairs
// R4 WiFi pin mapping (simplified for common pins)
struct PinMap { uint8_t port; uint8_t bit; };
static const PinMap pinMap[] = {
  {1,1}, {1,0}, {1,2}, {1,4}, {1,5}, {1,6}, {1,7}, {1,8}, // D0-D7
  {3,4}, {3,3}, {3,2}, {3,1}, {3,0}, {1,11},               // D8-D13
  {0,0}, {0,1}, {0,2}, {0,3}, {0,4}, {0,5},                 // A0-A5
};
static const int NUM_PINS = sizeof(pinMap) / sizeof(pinMap[0]);

void pinMode(uint8_t pin, uint8_t mode) {
  if (pin >= NUM_PINS) return;
  // Stub: on real hardware this would configure IOPORT PDR/PMR registers
  (void)mode;
}

void digitalWrite(uint8_t pin, uint8_t val) {
  if (pin >= NUM_PINS) return;
  // Stub: on real hardware this would set IOPORT PODR register
  (void)val;
}

int digitalRead(uint8_t pin) {
  if (pin >= NUM_PINS) return LOW;
  // Stub: on real hardware this would read IOPORT PIDR register
  return LOW;
}

int analogRead(uint8_t pin) {
  (void)pin;
  return 0;
}

void analogWrite(uint8_t pin, int val) {
  (void)pin; (void)val;
}

// Serial class (stub for ARM)
class HardwareSerial {
public:
  void begin(unsigned long baud) { (void)baud; }
  void end() {}
  int available() { return 0; }
  int read() { return -1; }

  size_t write(uint8_t c) { (void)c; return 1; }
  size_t write(const uint8_t *buf, size_t size) {
    (void)buf; return size;
  }

  size_t print(const char *s) {
    size_t n = 0;
    while (s[n]) n++;
    return n;
  }
  size_t print(int val, int base = DEC) { (void)val; (void)base; return 1; }
  size_t print(unsigned int val, int base = DEC) { (void)val; (void)base; return 1; }
  size_t print(long val, int base = DEC) { (void)val; (void)base; return 1; }
  size_t print(double val, int digits = 2) { (void)val; (void)digits; return 1; }

  size_t println() { return 2; }
  size_t println(const char *s) { return print(s) + println(); }
  size_t println(int val, int base = DEC) { return print(val, base) + println(); }
  size_t println(unsigned int val, int base = DEC) { return print(val, base) + println(); }
  size_t println(long val, int base = DEC) { return print(val, base) + println(); }
  size_t println(double val, int digits = 2) { return print(val, digits) + println(); }
};

HardwareSerial Serial;

long map(long x, long in_min, long in_max, long out_min, long out_max) {
  return (x - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

long constrain(long x, long a, long b) {
  if (x < a) return a;
  if (x > b) return b;
  return x;
}

#define min(a,b) ((a)<(b)?(a):(b))
#define max(a,b) ((a)>(b)?(a):(b))

void tone(uint8_t pin, unsigned int frequency, unsigned long duration = 0) {
  (void)pin; (void)frequency; (void)duration;
}
void noTone(uint8_t pin) { (void)pin; }

void setup();
void loop();

// Minimal startup for ARM
void _init_systick() {
  // SysTick reload value for 1ms at 48MHz
  volatile uint32_t* SYST_RVR = (volatile uint32_t*)0xE000E014;
  volatile uint32_t* SYST_CSR = (volatile uint32_t*)0xE000E010;
  *SYST_RVR = 48000 - 1;
  *SYST_CSR = 0x07; // Enable, interrupt, processor clock
}

int main() {
  _init_systick();
  setup();
  while (1) loop();
  return 0;
}
`;

// Board configuration for compilation
const BOARD_CONFIGS: Record<string, { compiler: string; stubs: string; args: string; isArm: boolean }> = {
  uno: {
    compiler: 'avrg1320',
    stubs: ARDUINO_CORE_STUBS,
    args: '-mmcu=atmega328p -DF_CPU=16000000UL -Os -std=gnu++11',
    isArm: false,
  },
  nano: {
    compiler: 'avrg1320',
    stubs: ARDUINO_CORE_STUBS,
    args: '-mmcu=atmega328p -DF_CPU=16000000UL -Os -std=gnu++11',
    isArm: false,
  },
  mega: {
    compiler: 'avrg1320',
    stubs: ARDUINO_CORE_STUBS,
    args: '-mmcu=atmega2560 -DF_CPU=16000000UL -Os -std=gnu++11',
    isArm: false,
  },
  leonardo: {
    compiler: 'avrg1320',
    stubs: ARDUINO_CORE_STUBS,
    args: '-mmcu=atmega32u4 -DF_CPU=16000000UL -Os -std=gnu++11',
    isArm: false,
  },
  micro: {
    compiler: 'avrg1320',
    stubs: ARDUINO_CORE_STUBS,
    args: '-mmcu=atmega32u4 -DF_CPU=16000000UL -Os -std=gnu++11',
    isArm: false,
  },
  uno_r4_wifi: {
    compiler: 'armg1320',
    stubs: ARM_CORE_STUBS,
    args: '-mcpu=cortex-m4 -mthumb -Os -DF_CPU=48000000UL -std=gnu++11 -fno-exceptions -fno-rtti -nostdlib',
    isArm: true,
  },
};

const SUPPORTED_BOARD_IDS = Object.keys(BOARD_CONFIGS);

// ELF to Intel HEX conversion
function elfToHex(elfBase64: string): string {
  const elfBytes = Uint8Array.from(atob(elfBase64), c => c.charCodeAt(0));
  
  const is32 = elfBytes[4] === 1;
  if (!is32) throw new Error('Only 32-bit ELF supported');
  
  const littleEndian = elfBytes[5] === 1;
  const view = new DataView(elfBytes.buffer);
  
  const readU16 = (off: number) => view.getUint16(off, littleEndian);
  const readU32 = (off: number) => view.getUint32(off, littleEndian);
  
  const phoff = readU32(28);
  const phentsize = readU16(42);
  const phnum = readU16(44);
  
  const segments: { paddr: number; data: Uint8Array }[] = [];
  for (let i = 0; i < phnum; i++) {
    const off = phoff + i * phentsize;
    const pType = readU32(off);
    if (pType !== 1) continue;
    
    const fileOff = readU32(off + 4);
    const paddr = readU32(off + 12);
    const filesz = readU32(off + 16);
    
    if (filesz > 0) {
      segments.push({
        paddr,
        data: elfBytes.slice(fileOff, fileOff + filesz),
      });
    }
  }
  
  if (segments.length === 0) throw new Error('No loadable segments in ELF');
  
  let hex = '';
  for (const seg of segments) {
    const baseAddr = seg.paddr;
    const data = seg.data;
    
    for (let i = 0; i < data.length; i += 16) {
      const chunkLen = Math.min(16, data.length - i);
      const addr = (baseAddr + i) & 0xFFFF;
      
      let line = `:${toHex8(chunkLen)}${toHex16(addr)}00`;
      let checksum = chunkLen + (addr >> 8) + (addr & 0xFF) + 0x00;
      
      for (let j = 0; j < chunkLen; j++) {
        const b = data[i + j];
        line += toHex8(b);
        checksum += b;
      }
      
      line += toHex8((-checksum) & 0xFF);
      hex += line + '\n';
    }
  }
  
  hex += ':00000001FF\n';
  return hex;
}

function toHex8(n: number): string {
  return n.toString(16).toUpperCase().padStart(2, '0');
}

function toHex16(n: number): string {
  return n.toString(16).toUpperCase().padStart(4, '0');
}

// Convert raw bytes to flat binary base64
function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = req.headers.get('apikey');
    const authHeader = req.headers.get('authorization');
    if (!apiKey && !authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authentication headers' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { sketch, board = 'uno' } = await req.json();
    
    if (!sketch || typeof sketch !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing sketch code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const boardConfig = BOARD_CONFIGS[board];
    if (!boardConfig) {
      return new Response(
        JSON.stringify({
          error: `Unsupported board for web compiler: ${board}`,
          supportedBoards: SUPPORTED_BOARD_IDS,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Combine stubs + user sketch
    const fullSource = boardConfig.stubs + '\n// === USER SKETCH ===\n' + sketch;

    // Compile via Compiler Explorer (Godbolt) API
    const compileResponse = await fetch(`https://godbolt.org/api/compiler/${boardConfig.compiler}/compile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        source: fullSource,
        options: {
          userArguments: boardConfig.args,
          compilerOptions: {},
          filters: {
            binary: true,
            execute: false,
            demangle: false,
            labels: false,
            directives: false,
            commentOnly: false,
            trim: false,
            intel: true,
          },
          tools: [],
          libraries: [],
        },
      }),
    });

    if (!compileResponse.ok) {
      const text = await compileResponse.text();
      return new Response(
        JSON.stringify({ error: `Compiler Explorer API error: ${compileResponse.status}`, details: text }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await compileResponse.json();

    // Check for compilation errors
    const stubs = boardConfig.stubs;
    const stderr = (result.stderr || []).map((s: { text: string }) => s.text).join('\n');
    const hasErrors = (result.code !== 0);

    if (hasErrors) {
      const stubLines = stubs.split('\n').length;
      const userErrors = stderr.replace(/<source>:(\d+)/g, (_: string, lineStr: string) => {
        const line = parseInt(lineStr) - stubLines;
        return line > 0 ? `sketch:${line}` : `core:${lineStr}`;
      });

      return new Response(
        JSON.stringify({
          error: 'Compilation failed',
          errors: userErrors,
          raw: stderr,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse binary output from Godbolt
    const asmEntries = result.asm || [];
    const hexBytes: number[] = [];
    let maxAddr = 0;

    const sampleWithAddr = asmEntries.find((a: Record<string, unknown>) => a.address !== undefined);
    const debugInfo = {
      totalAsmEntries: asmEntries.length,
      sampleKeys: sampleWithAddr ? Object.keys(sampleWithAddr) : [],
      sampleEntry: sampleWithAddr || null,
      firstFew: asmEntries.slice(0, 3),
    };

    for (const entry of asmEntries) {
      if (entry.address !== undefined && entry.opcodes) {
        const addr = entry.address;
        const opcodes: number[] = Array.isArray(entry.opcodes) 
          ? entry.opcodes 
          : (typeof entry.opcodes === 'string' 
            ? entry.opcodes.trim().split(/\s+/).map((b: string) => parseInt(b, 16))
            : []);
        
        for (let i = 0; i < opcodes.length; i++) {
          const pos = addr + i;
          while (hexBytes.length <= pos) hexBytes.push(0xFF);
          hexBytes[pos] = opcodes[i];
          if (pos + 1 > maxAddr) maxAddr = pos + 1;
        }
      }
    }

    // Fallback: try parsing hex bytes from text lines
    if (maxAddr === 0) {
      for (const entry of asmEntries) {
        const line = entry.text || '';
        const match = line.match(/^\s*([0-9a-fA-F]+):\s+((?:[0-9a-fA-F]{2}\s)+)/);
        if (match) {
          const addr = parseInt(match[1], 16);
          const bytes = match[2].trim().split(/\s+/).map((b: string) => parseInt(b, 16));
          for (let i = 0; i < bytes.length; i++) {
            const pos = addr + i;
            while (hexBytes.length <= pos) hexBytes.push(0xFF);
            hexBytes[pos] = bytes[i];
            if (pos + 1 > maxAddr) maxAddr = pos + 1;
          }
        }
      }
    }

    if (maxAddr === 0) {
      return new Response(
        JSON.stringify({
          compiled: true,
          debug: debugInfo,
          warnings: stderr || null,
          note: 'Binary output could not be extracted from compiler output.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const binaryData = new Uint8Array(hexBytes.slice(0, maxAddr));

    // For ARM boards, return raw binary (base64-encoded) instead of Intel HEX
    if (boardConfig.isArm) {
      return new Response(
        JSON.stringify({
          binary: bytesToBase64(binaryData),
          format: 'bin',
          size: maxAddr,
          warnings: stderr || null,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For AVR boards, return Intel HEX
    let hexOutput = '';
    for (let i = 0; i < binaryData.length; i += 16) {
      const chunkLen = Math.min(16, binaryData.length - i);
      const addr = i & 0xFFFF;

      let line = `:${toHex8(chunkLen)}${toHex16(addr)}00`;
      let checksum = chunkLen + (addr >> 8) + (addr & 0xFF) + 0x00;

      for (let j = 0; j < chunkLen; j++) {
        const b = binaryData[i + j];
        line += toHex8(b);
        checksum += b;
      }

      line += toHex8((-checksum) & 0xFF);
      hexOutput += line + '\n';
    }

    hexOutput += ':00000001FF\n';

    return new Response(
      JSON.stringify({
        hex: hexOutput,
        size: maxAddr,
        warnings: stderr || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
