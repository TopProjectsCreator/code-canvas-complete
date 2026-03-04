import { ComponentTemplate } from './types';

const drawLED = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>, simulating: boolean) => {
  const color = props.color || '#FF0000';
  const isOn = simulating && props.on;
  
  // LED body (dome shape)
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.45, w * 0.38, h * 0.38, 0, 0, Math.PI * 2);
  
  if (isOn) {
    const glow = ctx.createRadialGradient(x + w / 2, y + h * 0.45, 0, x + w / 2, y + h * 0.45, w * 0.6);
    glow.addColorStop(0, color);
    glow.addColorStop(0.5, color + 'AA');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.45, w * 0.38, h * 0.38, 0, 0, Math.PI * 2);
  }
  
  const grad = ctx.createRadialGradient(x + w * 0.4, y + h * 0.35, 2, x + w / 2, y + h * 0.45, w * 0.35);
  grad.addColorStop(0, isOn ? '#FFFFFF' : lighten(color, 60));
  grad.addColorStop(0.6, color);
  grad.addColorStop(1, darken(color, 40));
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = darken(color, 30);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Flat bottom
  ctx.fillStyle = '#DDD';
  ctx.fillRect(x + w * 0.25, y + h * 0.72, w * 0.5, h * 0.08);
  
  // Legs
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y + h * 0.8);
  ctx.lineTo(x + w * 0.35, y + h);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.65, y + h * 0.8);
  ctx.lineTo(x + w * 0.65, y + h);
  ctx.stroke();
  
  // Anode marker (longer leg)
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.65, y + h * 0.8);
  ctx.lineTo(x + w * 0.65, y + h + 4);
  ctx.stroke();
};

const drawResistor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _props: Record<string, any>) => {
  const bodyX = x + w * 0.2;
  const bodyW = w * 0.6;
  const bodyH = h * 0.7;
  const bodyY = y + h * 0.15;
  
  // Leads
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y + h / 2);
  ctx.lineTo(bodyX, y + h / 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w, y + h / 2);
  ctx.lineTo(bodyX + bodyW, y + h / 2);
  ctx.stroke();
  
  // Body (tan rectangle)
  ctx.fillStyle = '#E8D5B7';
  ctx.beginPath();
  ctx.roundRect(bodyX, bodyY, bodyW, bodyH, 3);
  ctx.fill();
  ctx.strokeStyle = '#A08060';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Color bands
  const bands = ['#8B4513', '#000', '#FF0000', '#FFD700'];
  const bandW = bodyW * 0.08;
  bands.forEach((color, i) => {
    const bx = bodyX + bodyW * (0.15 + i * 0.2);
    ctx.fillStyle = color;
    ctx.fillRect(bx, bodyY + 1, bandW, bodyH - 2);
  });
};

const drawButton = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>, simulating: boolean) => {
  const pressed = simulating && props.pressed;
  
  // Base plate
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 4);
  ctx.fill();
  
  // Button cap
  const capInset = w * 0.2;
  const capY = pressed ? y + capInset + 2 : y + capInset;
  ctx.fillStyle = pressed ? '#666' : '#999';
  const capGrad = ctx.createLinearGradient(x + capInset, capY, x + capInset, capY + h - capInset * 2 - (pressed ? 2 : 0));
  capGrad.addColorStop(0, pressed ? '#888' : '#BBB');
  capGrad.addColorStop(1, pressed ? '#555' : '#777');
  ctx.fillStyle = capGrad;
  ctx.beginPath();
  ctx.roundRect(x + capInset, capY, w - capInset * 2, h - capInset * 2 - (pressed ? 2 : 0), 3);
  ctx.fill();
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Pins (4 legs)
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  [[0.2, 0], [0.8, 0], [0.2, 1], [0.8, 1]].forEach(([px, py]) => {
    ctx.beginPath();
    if (py === 0) { ctx.moveTo(x + w * px, y); ctx.lineTo(x + w * px, y - 6); }
    else { ctx.moveTo(x + w * px, y + h); ctx.lineTo(x + w * px, y + h + 6); }
    ctx.stroke();
  });
};

const drawServo = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>, simulating: boolean) => {
  // Body
  const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
  bodyGrad.addColorStop(0, '#4A7DBA');
  bodyGrad.addColorStop(1, '#2C5F8A');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 8, w - 4, h - 12, 4);
  ctx.fill();
  ctx.strokeStyle = '#1A3D5C';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Label
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('SERVO', x + w / 2, y + h / 2 + 3);
  
  // Output shaft
  const angle = simulating ? (props.angle || 0) : 0;
  const shaftX = x + w * 0.7;
  const shaftY = y + 8;
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(shaftX, shaftY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Arm
  ctx.save();
  ctx.translate(shaftX, shaftY);
  ctx.rotate((angle * Math.PI) / 180);
  ctx.fillStyle = '#FFF';
  ctx.fillRect(-2, -12, 4, 12);
  ctx.restore();
  
  // Wires
  const wireColors = ['#F00', '#A52A2A', '#F90'];
  wireColors.forEach((c, i) => {
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w * (0.25 + i * 0.2), y + h);
    ctx.lineTo(x + w * (0.25 + i * 0.2), y + h + 8);
    ctx.stroke();
  });
};

const drawTempSensor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>, simulating: boolean) => {
  // TO-92 package shape
  ctx.fillStyle = '#1A1A1A';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.15, y + h * 0.7);
  ctx.lineTo(x + w * 0.15, y + h * 0.2);
  ctx.quadraticCurveTo(x + w / 2, y - h * 0.1, x + w * 0.85, y + h * 0.2);
  ctx.lineTo(x + w * 0.85, y + h * 0.7);
  ctx.closePath();
  ctx.fill();
  
  // Flat side marker
  ctx.fillStyle = '#333';
  ctx.fillRect(x + w * 0.15, y + h * 0.5, w * 0.7, h * 0.2);
  
  // Label
  ctx.fillStyle = '#CCC';
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TMP', x + w / 2, y + h * 0.45);
  
  if (simulating) {
    ctx.fillStyle = '#0FF';
    ctx.font = 'bold 8px monospace';
    ctx.fillText(`${props.temp || 25}°`, x + w / 2, y - 4);
  }
  
  // 3 pins
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  [0.3, 0.5, 0.7].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(x + w * p, y + h * 0.7);
    ctx.lineTo(x + w * p, y + h + 4);
    ctx.stroke();
  });
};

const drawLightSensor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>, simulating: boolean) => {
  // LDR disc
  const cx = x + w / 2;
  const cy = y + h * 0.4;
  const r = Math.min(w, h) * 0.35;
  
  ctx.fillStyle = '#8B0000';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Zigzag pattern
  ctx.strokeStyle = '#CD853F';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const nextAngle = ((i + 1) / 5) * Math.PI * 2;
    ctx.moveTo(cx + Math.cos(angle) * r * 0.3, cy + Math.sin(angle) * r * 0.3);
    ctx.lineTo(cx + Math.cos(angle) * r * 0.7, cy + Math.sin(angle) * r * 0.7);
    ctx.lineTo(cx + Math.cos(nextAngle) * r * 0.3, cy + Math.sin(nextAngle) * r * 0.3);
  }
  ctx.stroke();
  
  if (simulating) {
    ctx.fillStyle = '#FF0';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${props.light || 512}`, cx, y - 4);
  }
  
  // 2 pins
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  [0.35, 0.65].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(x + w * p, y + h * 0.8);
    ctx.lineTo(x + w * p, y + h + 4);
    ctx.stroke();
  });
};

const drawCapacitor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  // Electrolytic capacitor (cylinder)
  const bodyGrad = ctx.createLinearGradient(x, y, x + w, y);
  bodyGrad.addColorStop(0, '#1A3A5C');
  bodyGrad.addColorStop(0.5, '#2A5A8C');
  bodyGrad.addColorStop(1, '#1A3A5C');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(x + w * 0.15, y + h * 0.1, w * 0.7, h * 0.65, 4);
  ctx.fill();
  ctx.strokeStyle = '#0A2040';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Top marking
  ctx.fillStyle = '#AAA';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.1, w * 0.3, h * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  
  // Stripe (polarity)
  ctx.fillStyle = '#CCC';
  ctx.fillRect(x + w * 0.15, y + h * 0.15, w * 0.12, h * 0.55);
  
  // Label
  ctx.fillStyle = '#FFF';
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('100μF', x + w / 2, y + h * 0.5);
  
  // Legs
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  [0.35, 0.65].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(x + w * p, y + h * 0.75);
    ctx.lineTo(x + w * p, y + h + 4);
    ctx.stroke();
  });
};

const drawBuzzer = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>, simulating: boolean) => {
  const isOn = simulating && props.on;
  
  // Body (disc)
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.45, w * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Sound hole
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.45, w * 0.15, 0, Math.PI * 2);
  ctx.fill();
  
  // + marker
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('+', x + w * 0.25, y + h * 0.25);
  
  // Sound waves when active
  if (isOn) {
    ctx.strokeStyle = '#0F0';
    ctx.lineWidth = 1;
    [0.22, 0.3, 0.38].forEach(r => {
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h * 0.45, w * r, -0.5, 0.5);
      ctx.stroke();
    });
  }
  
  // Pins
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  [0.35, 0.65].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(x + w * p, y + h * 0.87);
    ctx.lineTo(x + w * p, y + h + 4);
    ctx.stroke();
  });
};

const drawPotentiometer = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>, simulating: boolean) => {
  const value = props.value || 0.5;
  
  // Body
  ctx.fillStyle = '#2A5299';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.45, w * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#1A3279';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  
  // Shaft
  ctx.fillStyle = '#DDD';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.45, w * 0.12, 0, Math.PI * 2);
  ctx.fill();
  
  // Indicator line
  ctx.save();
  ctx.translate(x + w / 2, y + h * 0.45);
  ctx.rotate(value * Math.PI * 1.5 - Math.PI * 0.75);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -w * 0.35);
  ctx.stroke();
  ctx.restore();
  
  // 3 pins
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  [0.2, 0.5, 0.8].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(x + w * p, y + h * 0.87);
    ctx.lineTo(x + w * p, y + h + 4);
    ctx.stroke();
  });
};

const drawMotor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>, simulating: boolean) => {
  const isOn = simulating && props.on;
  
  // Motor body (cylinder side view)
  const bodyGrad = ctx.createLinearGradient(x, y, x, y + h);
  bodyGrad.addColorStop(0, '#888');
  bodyGrad.addColorStop(0.5, '#CCC');
  bodyGrad.addColorStop(1, '#888');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath();
  ctx.roundRect(x + 4, y + h * 0.15, w - 8, h * 0.6, 4);
  ctx.fill();
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  // Shaft
  ctx.fillStyle = '#AAA';
  ctx.fillRect(x + w / 2 - 2, y, 4, h * 0.15);
  
  // M label
  ctx.fillStyle = '#333';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('M', x + w / 2, y + h * 0.55);
  
  // Spin indicator
  if (isOn) {
    ctx.strokeStyle = '#0F0';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 4, 4, 0, Math.PI * 1.5);
    ctx.stroke();
    // Arrow
    ctx.beginPath();
    ctx.moveTo(x + w / 2 + 4, y + 4);
    ctx.lineTo(x + w / 2 + 1, y + 1);
    ctx.lineTo(x + w / 2 + 1, y + 7);
    ctx.closePath();
    ctx.fillStyle = '#0F0';
    ctx.fill();
  }
  
  // 2 pins
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  [0.35, 0.65].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(x + w * p, y + h * 0.75);
    ctx.lineTo(x + w * p, y + h + 4);
    ctx.stroke();
  });
};

// Helpers
function lighten(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + percent);
  const g = Math.min(255, ((num >> 8) & 0xff) + percent);
  const b = Math.min(255, (num & 0xff) + percent);
  return `rgb(${r},${g},${b})`;
}

function darken(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (num >> 16) - percent);
  const g = Math.max(0, ((num >> 8) & 0xff) - percent);
  const b = Math.max(0, (num & 0xff) - percent);
  return `rgb(${r},${g},${b})`;
}

// additional helper drawings
const drawDiode = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  // simple triangle arrow
  ctx.fillStyle = '#AAA';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y + h * 0.5);
  ctx.lineTo(x + w * 0.5, y + h * 0.2);
  ctx.lineTo(x + w * 0.5, y + h * 0.8);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // line at cathode
  ctx.beginPath();
  ctx.moveTo(x + w * 0.6, y + h * 0.2);
  ctx.lineTo(x + w * 0.6, y + h * 0.8);
  ctx.stroke();
};

const drawTransistor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  // simple TO-92 shape
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.7);
  ctx.lineTo(x, y + h * 0.3);
  ctx.quadraticCurveTo(x + w/2, y, x + w, y + h * 0.3);
  ctx.lineTo(x + w, y + h * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
};

const drawRGBLed = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  // three colored circles
  const colors = ['#FF0000', '#00FF00', '#0000FF'];
  colors.forEach((c,i) => {
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(x + w/2, y + h * (0.3 + i * 0.2), w*0.2, 0, Math.PI*2);
    ctx.fill();
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
};

const drawIC = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  ctx.fillStyle = '#000';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
  // pins
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.125 + i * w * 0.2, y);
    ctx.lineTo(x + w * 0.125 + i * w * 0.2, y - 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + w * 0.125 + i * w * 0.2, y + h);
    ctx.lineTo(x + w * 0.125 + i * w * 0.2, y + h + 6);
    ctx.stroke();
  }
};

export const COMPONENT_TEMPLATES: Record<string, ComponentTemplate> = {
  led: {
    width: 28, height: 40,
    pins: [
      { name: 'anode', x: 0.35, y: 1, side: 'bottom' },
      { name: 'cathode', x: 0.65, y: 1, side: 'bottom' },
    ],
    draw: drawLED,
  },
  resistor: {
    width: 70, height: 20,
    pins: [
      { name: 'left', x: 0, y: 0.5, side: 'left' },
      { name: 'right', x: 1, y: 0.5, side: 'right' },
    ],
    draw: drawResistor,
  },
  button: {
    width: 38, height: 38,
    pins: [
      { name: '1a', x: 0.2, y: 0, side: 'top' },
      { name: '1b', x: 0.8, y: 0, side: 'top' },
      { name: '2a', x: 0.2, y: 1, side: 'bottom' },
      { name: '2b', x: 0.8, y: 1, side: 'bottom' },
    ],
    draw: drawButton,
  },
  servo: {
    width: 55, height: 45,
    pins: [
      { name: 'signal', x: 0.25, y: 1, side: 'bottom' },
      { name: 'vcc', x: 0.5, y: 1, side: 'bottom' },
      { name: 'gnd', x: 0.75, y: 1, side: 'bottom' },
    ],
    draw: drawServo,
  },
  sensor_temp: {
    width: 30, height: 35,
    pins: [
      { name: 'vcc', x: 0.3, y: 1, side: 'bottom' },
      { name: 'out', x: 0.5, y: 1, side: 'bottom' },
      { name: 'gnd', x: 0.7, y: 1, side: 'bottom' },
    ],
    draw: drawTempSensor,
  },
  sensor_light: {
    width: 30, height: 32,
    pins: [
      { name: 'left', x: 0.35, y: 1, side: 'bottom' },
      { name: 'right', x: 0.65, y: 1, side: 'bottom' },
    ],
    draw: drawLightSensor,
  },
  capacitor: {
    width: 24, height: 36,
    pins: [
      { name: 'positive', x: 0.35, y: 1, side: 'bottom' },
      { name: 'negative', x: 0.65, y: 1, side: 'bottom' },
    ],
    draw: drawCapacitor,
  },
  buzzer: {
    width: 32, height: 36,
    pins: [
      { name: 'positive', x: 0.35, y: 1, side: 'bottom' },
      { name: 'negative', x: 0.65, y: 1, side: 'bottom' },
    ],
    draw: drawBuzzer,
  },
  potentiometer: {
    width: 38, height: 38,
    pins: [
      { name: 'left', x: 0.2, y: 1, side: 'bottom' },
      { name: 'wiper', x: 0.5, y: 1, side: 'bottom' },
      { name: 'right', x: 0.8, y: 1, side: 'bottom' },
    ],
    draw: drawPotentiometer,
  },
  motor: {
    width: 40, height: 40,
    pins: [
      { name: 'positive', x: 0.35, y: 1, side: 'bottom' },
      { name: 'negative', x: 0.65, y: 1, side: 'bottom' },
    ],
    draw: drawMotor,
  },
  diode: {
    width: 40, height: 20,
    pins: [
      { name: 'anode', x: 0.1, y: 0.5, side: 'left' },
      { name: 'cathode', x: 0.9, y: 0.5, side: 'right' },
    ],
    draw: drawDiode,
  },
  transistor_npn: {
    width: 30, height: 40,
    pins: [
      { name: 'base', x: 0.25, y: 1, side: 'bottom' },
      { name: 'collector', x: 0.5, y: 1, side: 'bottom' },
      { name: 'emitter', x: 0.75, y: 1, side: 'bottom' },
    ],
    draw: drawTransistor,
  },
  rgb_led: {
    width: 28, height: 40,
    pins: [
      { name: 'red', x: 0.25, y: 1, side: 'bottom' },
      { name: 'green', x: 0.5, y: 1, side: 'bottom' },
      { name: 'blue', x: 0.75, y: 1, side: 'bottom' },
      { name: 'common', x: 0.5, y: 0, side: 'top' },
    ],
    draw: drawRGBLed,
  },
  ic: {
    width: 60, height: 30,
    pins: Array.from({length:8}).map((_,i) => ({ name: `pin${i+1}`, x: 0.125 + i*0.125, y: 0, side: 'top' }))
      .concat(Array.from({length:8}).map((_,i) => ({ name: `pin${i+9}`, x: 0.125 + i*0.125, y: 1, side: 'bottom' }))),
    draw: drawIC,
  },
};

export const WIRE_COLORS = [
  '#FF0000', '#00AA00', '#0066FF', '#FF8800', '#FFDD00',
  '#AA00FF', '#00CCCC', '#FF00AA', '#FFFFFF', '#333333',
];

export const COMPONENT_LABELS: Record<string, string> = {
  led: 'LED',
  resistor: 'Resistor',
  button: 'Push Button',
  servo: 'Servo Motor',
  sensor_temp: 'Temp Sensor',
  sensor_light: 'Light Sensor',
  capacitor: 'Capacitor',
  buzzer: 'Buzzer',
  potentiometer: 'Potentiometer',
  motor: 'DC Motor',
  diode: 'Diode',
  transistor_npn: 'NPN Transistor',
  rgb_led: 'RGB LED',
  ic: 'Integrated Circuit (IC)',
};
