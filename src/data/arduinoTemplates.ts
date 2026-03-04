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
};

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
