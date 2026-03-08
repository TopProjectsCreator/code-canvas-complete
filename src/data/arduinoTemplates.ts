import { FileNode, ArduinoBoard } from '@/types/ide';

export const arduinoBoards: Record<string, ArduinoBoard> = {
  uno: {
    id: 'uno',
    name: 'Arduino Uno',
    cpu: 'ATmega328P',
    flash: 32,
    ram: 2,
    pins: 14,
    voltage: 5,
    serial: true,
    wifi: false,
    bluetooth: false,
  },
  nano: {
    id: 'nano',
    name: 'Arduino Nano',
    cpu: 'ATmega328P',
    flash: 32,
    ram: 2,
    pins: 22,
    voltage: 5,
    serial: true,
    wifi: false,
    bluetooth: false,
  },
  mega: {
    id: 'mega',
    name: 'Arduino Mega 2560',
    cpu: 'ATmega2560',
    flash: 256,
    ram: 8,
    pins: 54,
    voltage: 5,
    serial: true,
    wifi: false,
    bluetooth: false,
  },
  esp32: {
    id: 'esp32',
    name: 'ESP32',
    cpu: 'ESP-WROOM-32',
    flash: 4096,
    ram: 520,
    pins: 36,
    voltage: 3.3,
    serial: true,
    wifi: true,
    bluetooth: true,
  },
  uno_r4_wifi: {
    id: 'uno_r4_wifi',
    name: 'Arduino Uno R4 WiFi',
    cpu: 'Renesas RA4M1 (ARM Cortex-M4)',
    flash: 256,
    ram: 32,
    pins: 14,
    voltage: 3.3,
    serial: true,
    wifi: true,
    bluetooth: true,
  },
  leonardo: {
    id: 'leonardo',
    name: 'Arduino Leonardo',
    cpu: 'ATmega32u4',
    flash: 32,
    ram: 2.5,
    pins: 20,
    voltage: 5,
    serial: true,
    wifi: false,
    bluetooth: false,
  },
  micro: {
    id: 'micro',
    name: 'Arduino Micro',
    cpu: 'ATmega32u4',
    flash: 32,
    ram: 2.5,
    pins: 20,
    voltage: 5,
    serial: true,
    wifi: false,
    bluetooth: false,
  },
  due: {
    id: 'due',
    name: 'Arduino Due',
    cpu: 'AT91SAM3X8E',
    flash: 512,
    ram: 96,
    pins: 54,
    voltage: 3.3,
    serial: true,
    wifi: false,
    bluetooth: false,
  },
  zero: {
    id: 'zero',
    name: 'Arduino Zero',
    cpu: 'ATSAMD21G18',
    flash: 256,
    ram: 32,
    pins: 20,
    voltage: 3.3,
    serial: true,
    wifi: false,
    bluetooth: false,
  },
  mkr_wifi_1010: {
    id: 'mkr_wifi_1010',
    name: 'Arduino MKR WiFi 1010',
    cpu: 'SAMD21 Cortex-M0+',
    flash: 256,
    ram: 32,
    pins: 22,
    voltage: 3.3,
    serial: true,
    wifi: true,
    bluetooth: true,
  },
  nano_33_iot: {
    id: 'nano_33_iot',
    name: 'Arduino Nano 33 IoT',
    cpu: 'SAMD21 Cortex-M0+',
    flash: 256,
    ram: 32,
    pins: 22,
    voltage: 3.3,
    serial: true,
    wifi: true,
    bluetooth: true,
  },
  nano_33_ble: {
    id: 'nano_33_ble',
    name: 'Arduino Nano 33 BLE',
    cpu: 'nRF52840',
    flash: 1024,
    ram: 256,
    pins: 22,
    voltage: 3.3,
    serial: true,
    wifi: false,
    bluetooth: true,
  },
  portenta_h7: {
    id: 'portenta_h7',
    name: 'Arduino Portenta H7',
    cpu: 'STM32H747XI',
    flash: 2048,
    ram: 1024,
    pins: 80,
    voltage: 3.3,
    serial: true,
    wifi: true,
    bluetooth: true,
  },
  giga_r1: {
    id: 'giga_r1',
    name: 'Arduino GIGA R1 WiFi',
    cpu: 'STM32H747XI',
    flash: 2048,
    ram: 1024,
    pins: 76,
    voltage: 3.3,
    serial: true,
    wifi: true,
    bluetooth: true,
  },
  esp8266: {
    id: 'esp8266',
    name: 'ESP8266 NodeMCU',
    cpu: 'ESP8266EX',
    flash: 4096,
    ram: 96,
    pins: 17,
    voltage: 3.3,
    serial: true,
    wifi: true,
    bluetooth: false,
  },
  rp2040_connect: {
    id: 'rp2040_connect',
    name: 'Arduino Nano RP2040 Connect',
    cpu: 'RP2040 dual-core M0+',
    flash: 16384,
    ram: 264,
    pins: 22,
    voltage: 3.3,
    serial: true,
    wifi: true,
    bluetooth: true,
  },
};



/**
 * Boards with validated compile+flash support in this web app.
 * - STK500v1: uno, nano, mega
 * - AVR109/Caterina: leonardo, micro
 * - SAM-BA: uno_r4_wifi, due, zero, mkr_wifi_1010, nano_33_iot
 * - esptool SLIP: esp32, esp8266
 * - STM32 UART: portenta_h7, giga_r1
 * - NOT supported (UF2 mass storage): nano_33_ble, rp2040_connect
 */
export const VERIFIED_WEB_FLASH_BOARDS = [
  'uno', 'nano', 'mega',
  'leonardo', 'micro',
  'uno_r4_wifi', 'due', 'zero', 'mkr_wifi_1010', 'nano_33_iot',
  'esp32', 'esp8266',
  'portenta_h7', 'giga_r1',
] as const;

export const isVerifiedWebFlashBoard = (boardId: string): boolean =>
  VERIFIED_WEB_FLASH_BOARDS.includes(boardId as typeof VERIFIED_WEB_FLASH_BOARDS[number]);

export const arduinoLibraries: Record<string, { name: string; include: string; description: string }> = {
  servo: {
    name: 'Servo',
    include: '#include <Servo.h>',
    description: 'Control servo motors',
  },
  wire: {
    name: 'Wire (I2C)',
    include: '#include <Wire.h>',
    description: 'I2C/TWI communication',
  },
  spi: {
    name: 'SPI',
    include: '#include <SPI.h>',
    description: 'SPI communication',
  },
  softserial: {
    name: 'SoftwareSerial',
    include: '#include <SoftwareSerial.h>',
    description: 'Serial communication on any pins',
  },
  lcd: {
    name: 'LiquidCrystal',
    include: '#include <LiquidCrystal.h>',
    description: 'Control LCD displays',
  },
};

export const getArduinoTemplateFiles = (board: string = 'uno'): FileNode[] => {
  const boardName = arduinoBoards[board]?.name || 'Arduino Uno';

  return [
    {
      id: 'arduino-root',
      name: 'arduino-project',
      type: 'folder',
      children: [
        {
          id: 'arduino-sketch',
          name: 'sketch.ino',
          type: 'file',
          language: 'cpp',
          content: `// ${boardName} Sketch
// This is your main sketch file

void setup() {
  // Initialize serial communication
  Serial.begin(9600);
  
  // Set pin modes
  pinMode(LED_BUILTIN, OUTPUT);
  
  Serial.println("Setup complete!");
}

void loop() {
  // Main program logic
  digitalWrite(LED_BUILTIN, HIGH);   // Turn on LED
  delay(1000);                        // Wait 1 second
  digitalWrite(LED_BUILTIN, LOW);    // Turn off LED
  delay(1000);                        // Wait 1 second
}
`,
        },
        {
          id: 'arduino-circuit',
          name: 'circuit.json',
          type: 'file',
          language: 'json',
          content: JSON.stringify(
            {
              boardId: board,
              components: [],
              connections: [],
              wires: [],
            },
            null,
            2
          ),
        },
        {
          id: 'arduino-readme',
          name: 'README.md',
          type: 'file',
          language: 'markdown',
          content: `# Arduino Project

Board: ${boardName}

## Getting Started

1. Connect your ${boardName} via USB
2. Select the correct board and port in the upload settings
3. Write your code in \`sketch.ino\`
4. Use the breadboard visualizer to design your circuit
5. Click "Upload to Board" when ready

## Useful Resources

- [Arduino Documentation](https://www.arduino.cc/reference/)
- [Arduino Libraries](https://www.arduino.cc/en/reference/libraries/)
- [Pin Reference for ${boardName}](https://www.arduino.cc/en/Guide/ArduinoUno)
`,
        },
        {
          id: 'arduino-tutorial',
          name: '.tutorial',
          type: 'folder',
          children: [
            {
              id: 'arduino-start-here',
              name: 'START_HERE.md',
              type: 'file',
              language: 'markdown',
              content: `# Arduino ${boardName} Starter Guide

## Project Structure

- \`sketch.ino\` - Your main Arduino sketch
- \`circuit.json\` - Visual circuit design (use breadboard editor)
- \`README.md\` - Project documentation

## Step 1: Write Your First Sketch

Modify \`sketch.ino\` to control the built-in LED:

\`\`\`cpp
void setup() {
  pinMode(13, OUTPUT); // LED pin
}

void loop() {
  digitalWrite(13, HIGH);
  delay(500);
  digitalWrite(13, LOW);
  delay(500);
}
\`\`\`

## Step 2: Design Your Circuit

1. Open the Breadboard Visualizer
2. Drag components from the library
3. Connect pins with virtual wires
4. Add labels for clarity

## Step 3: Upload to Board

1. Connect your board via USB
2. Click "Upload Settings" to select port & board
3. Click "Upload to Board"
4. Watch the Serial Monitor for output

## Common Issues

- **Port not found:** Install CH340 drivers (Nano/Mega)
- **Upload timeout:** Try different baud rate
- **No connection:** Check USB cable

## Next Steps

- Add sensors and actuators
- Use Serial communication for debugging
- Implement interrupt handlers
- Learn about PWM and analog reads
`,
            },
          ],
        },
      ],
    },
  ];
};
