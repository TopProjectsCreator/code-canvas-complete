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

const RESISTOR_BAND_MAP: Record<string, string[]> = {
  '100': ['#8B4513', '#000', '#8B4513', '#FFD700'],
  '220': ['#FF0000', '#FF0000', '#8B4513', '#FFD700'],
  '330': ['#FF8C00', '#FF8C00', '#8B4513', '#FFD700'],
  '470': ['#FFFF00', '#800080', '#8B4513', '#FFD700'],
  '1K': ['#8B4513', '#000', '#FF0000', '#FFD700'],
  '2.2K': ['#FF0000', '#FF0000', '#FF0000', '#FFD700'],
  '4.7K': ['#FFFF00', '#800080', '#FF0000', '#FFD700'],
  '10K': ['#8B4513', '#000', '#FF8C00', '#FFD700'],
  '47K': ['#FFFF00', '#800080', '#FF8C00', '#FFD700'],
  '100K': ['#8B4513', '#000', '#FFFF00', '#FFD700'],
  '1M': ['#8B4513', '#000', '#008000', '#FFD700'],
};

const drawResistor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>) => {
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
  
  // Color bands based on resistance value
  const resistance = props.resistance || '1K';
  const bands = RESISTOR_BAND_MAP[resistance] || ['#8B4513', '#000', '#FF0000', '#FFD700'];
  const bandW = bodyW * 0.08;
  bands.forEach((color, i) => {
    const bx = bodyX + bodyW * (0.15 + i * 0.2);
    ctx.fillStyle = color;
    ctx.fillRect(bx, bodyY + 1, bandW, bodyH - 2);
  });

  // Value label
  ctx.fillStyle = '#555';
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(resistance + 'Ω', x + w / 2, y + h + 10);
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

const drawCapacitor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>) => {
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
  ctx.fillText(props.capacitance || '100μF', x + w / 2, y + h * 0.5);
  
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

// additional component drawings
const drawDiode = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>) => {
  // glass body
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.6, 2);
  ctx.fill();
  // triangle arrow
  ctx.fillStyle = '#AAA';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.25, y + h * 0.5);
  ctx.lineTo(x + w * 0.5, y + h * 0.25);
  ctx.lineTo(x + w * 0.5, y + h * 0.75);
  ctx.closePath();
  ctx.fill();
  // cathode band
  ctx.fillStyle = '#CCC';
  ctx.fillRect(x + w * 0.6, y + h * 0.2, w * 0.06, h * 0.6);
  // leads
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w * 0.15, y + h / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w * 0.85, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  // label
  ctx.fillStyle = '#888';
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(props.diodeType || '1N4148', x + w / 2, y + h + 8);
};

const drawTransistor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>) => {
  // TO-92 package
  ctx.fillStyle = '#1A1A1A';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.1, y + h * 0.7);
  ctx.lineTo(x + w * 0.1, y + h * 0.25);
  ctx.quadraticCurveTo(x + w / 2, y - h * 0.05, x + w * 0.9, y + h * 0.25);
  ctx.lineTo(x + w * 0.9, y + h * 0.7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.stroke();
  // flat face marker
  ctx.fillStyle = '#333';
  ctx.fillRect(x + w * 0.1, y + h * 0.5, w * 0.8, h * 0.18);
  // label
  ctx.fillStyle = '#CCC';
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(props.partNumber || '2N2222', x + w / 2, y + h * 0.45);
  // pins
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  [0.25, 0.5, 0.75].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(x + w * p, y + h * 0.7);
    ctx.lineTo(x + w * p, y + h + 4);
    ctx.stroke();
  });
  // pin labels
  ctx.fillStyle = '#666';
  ctx.font = '5px monospace';
  ctx.fillText('B', x + w * 0.25, y + h + 11);
  ctx.fillText('C', x + w * 0.5, y + h + 11);
  ctx.fillText('E', x + w * 0.75, y + h + 11);
};

const drawRGBLed = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>, simulating: boolean) => {
  const r = props.red ?? 0, g = props.green ?? 0, b = props.blue ?? 0;
  const mixedColor = `rgb(${r},${g},${b})`;
  const isOn = simulating && (r > 0 || g > 0 || b > 0);
  // dome
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h * 0.4, w * 0.38, h * 0.35, 0, 0, Math.PI * 2);
  if (isOn) {
    const glow = ctx.createRadialGradient(x + w / 2, y + h * 0.4, 0, x + w / 2, y + h * 0.4, w * 0.6);
    glow.addColorStop(0, mixedColor);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.4, w * 0.38, h * 0.35, 0, 0, Math.PI * 2);
  }
  const grad = ctx.createRadialGradient(x + w * 0.4, y + h * 0.3, 2, x + w / 2, y + h * 0.4, w * 0.35);
  grad.addColorStop(0, isOn ? '#FFF' : '#DDD');
  grad.addColorStop(1, isOn ? mixedColor : '#AAA');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1;
  ctx.stroke();
  // legs
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  [0.2, 0.4, 0.6, 0.8].forEach(p => {
    ctx.beginPath();
    ctx.moveTo(x + w * p, y + h * 0.75);
    ctx.lineTo(x + w * p, y + h + 4);
    ctx.stroke();
  });
  // label
  ctx.fillStyle = '#666';
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RGB', x + w / 2, y + h * 0.92);
};

const drawIC = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>) => {
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 2);
  ctx.fill();
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.stroke();
  // notch
  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(x + 6, y + h / 2, 3, 0, Math.PI * 2);
  ctx.fill();
  // label
  ctx.fillStyle = '#CCC';
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(props.icType || '555', x + w / 2, y + h / 2 + 3);
  // pins
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const px = x + w * 0.125 + i * w * 0.2;
    ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px, y + h); ctx.lineTo(px, y + h + 6); ctx.stroke();
  }
};

// ── New components ──

const drawRelay = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>, simulating: boolean) => {
  const energized = simulating && props.energized;
  // body
  ctx.fillStyle = energized ? '#2A4A7A' : '#1A3A5C';
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 8, 3);
  ctx.fill();
  ctx.strokeStyle = '#0A2040';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  // coil symbol
  ctx.strokeStyle = '#AAA';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(x + w * 0.3 + i * 5, y + h * 0.4, 3, Math.PI, 0);
    ctx.stroke();
  }
  // label
  ctx.fillStyle = '#FFF';
  ctx.font = '7px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('RELAY', x + w / 2, y + h * 0.7);
  if (energized) {
    ctx.fillStyle = '#0F0';
    ctx.beginPath();
    ctx.arc(x + w - 8, y + 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // pins
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  [0.15, 0.38, 0.62, 0.85].forEach(p => {
    ctx.beginPath(); ctx.moveTo(x + w * p, y + h - 6); ctx.lineTo(x + w * p, y + h + 4); ctx.stroke();
  });
};

const drawToggleSwitch = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>) => {
  const isOn = props.on ?? false;
  // base
  ctx.fillStyle = '#555';
  ctx.beginPath();
  ctx.roundRect(x + 4, y + h * 0.3, w - 8, h * 0.4, 3);
  ctx.fill();
  // lever
  ctx.fillStyle = isOn ? '#CCC' : '#999';
  const leverX = isOn ? x + w * 0.55 : x + w * 0.15;
  ctx.fillRect(leverX, y + h * 0.15, w * 0.3, h * 0.7);
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.strokeRect(leverX, y + h * 0.15, w * 0.3, h * 0.7);
  // label
  ctx.fillStyle = '#AAA';
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(isOn ? 'ON' : 'OFF', x + w / 2, y - 2);
  // pins
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  [0.25, 0.5, 0.75].forEach(p => {
    ctx.beginPath(); ctx.moveTo(x + w * p, y + h * 0.7); ctx.lineTo(x + w * p, y + h + 4); ctx.stroke();
  });
};

const SEVEN_SEG_MAP: Record<number, boolean[]> = {
  0: [true,true,true,true,true,true,false],
  1: [false,true,true,false,false,false,false],
  2: [true,true,false,true,true,false,true],
  3: [true,true,true,true,false,false,true],
  4: [false,true,true,false,false,true,true],
  5: [true,false,true,true,false,true,true],
  6: [true,false,true,true,true,true,true],
  7: [true,true,true,false,false,false,false],
  8: [true,true,true,true,true,true,true],
  9: [true,true,true,true,false,true,true],
};

const drawSevenSegment = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>) => {
  const digit = props.digit ?? 0;
  const segs = SEVEN_SEG_MAP[digit] || SEVEN_SEG_MAP[0];
  // background
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.roundRect(x, y, w, h * 0.85, 3);
  ctx.fill();
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 1;
  ctx.stroke();
  
  const cx = x + w / 2;
  const cy = y + h * 0.42;
  const sw = w * 0.5; // segment width
  const sh = 3; // segment height
  const sl = sw * 0.8; // segment length

  const drawSeg = (sx: number, sy: number, horizontal: boolean, on: boolean) => {
    ctx.fillStyle = on ? '#FF2222' : '#331111';
    if (horizontal) {
      ctx.fillRect(sx - sl / 2, sy - sh / 2, sl, sh);
    } else {
      ctx.fillRect(sx - sh / 2, sy - sl / 2, sh, sl);
    }
  };
  const half = h * 0.17;
  // a (top), b (top-right), c (bot-right), d (bot), e (bot-left), f (top-left), g (mid)
  drawSeg(cx, cy - half * 2, true, segs[0]); // a
  drawSeg(cx + sw * 0.4, cy - half, false, segs[1]); // b
  drawSeg(cx + sw * 0.4, cy + half, false, segs[2]); // c
  drawSeg(cx, cy + half * 2, true, segs[3]); // d
  drawSeg(cx - sw * 0.4, cy + half, false, segs[4]); // e
  drawSeg(cx - sw * 0.4, cy - half, false, segs[5]); // f
  drawSeg(cx, cy, true, segs[6]); // g

  // pins
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 1.5;
  [0.2, 0.4, 0.6, 0.8].forEach(p => {
    ctx.beginPath(); ctx.moveTo(x + w * p, y + h * 0.85); ctx.lineTo(x + w * p, y + h + 4); ctx.stroke();
  });
};

const drawFuse = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>) => {
  // glass body
  ctx.fillStyle = '#E8E4D8';
  ctx.beginPath();
  ctx.roundRect(x + w * 0.15, y + h * 0.2, w * 0.7, h * 0.6, 6);
  ctx.fill();
  ctx.strokeStyle = '#AAA';
  ctx.lineWidth = 1;
  ctx.stroke();
  // caps
  ctx.fillStyle = '#CCC';
  ctx.fillRect(x + w * 0.12, y + h * 0.25, w * 0.1, h * 0.5);
  ctx.fillRect(x + w * 0.78, y + h * 0.25, w * 0.1, h * 0.5);
  // wire inside
  ctx.strokeStyle = '#666';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.22, y + h / 2);
  ctx.lineTo(x + w * 0.78, y + h / 2);
  ctx.stroke();
  // label
  ctx.fillStyle = '#555';
  ctx.font = '6px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(props.rating || '1A', x + w / 2, y + h + 8);
  // leads
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w * 0.12, y + h / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w * 0.88, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
};

const drawPiezo = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>, simulating: boolean) => {
  const isOn = simulating && props.on;
  // disc
  ctx.fillStyle = '#D4A843';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.45, w * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#B88A30';
  ctx.lineWidth = 1;
  ctx.stroke();
  // center ceramic
  ctx.fillStyle = '#F5E6C8';
  ctx.beginPath();
  ctx.arc(x + w / 2, y + h * 0.45, w * 0.2, 0, Math.PI * 2);
  ctx.fill();
  if (isOn) {
    ctx.strokeStyle = '#0F0';
    ctx.lineWidth = 1;
    [0.25, 0.32].forEach(r => {
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h * 0.45, w * r, -0.5, 0.5);
      ctx.stroke();
    });
  }
  // pins
  ctx.strokeStyle = '#888';
  ctx.lineWidth = 2;
  [0.35, 0.65].forEach(p => {
    ctx.beginPath(); ctx.moveTo(x + w * p, y + h * 0.87); ctx.lineTo(x + w * p, y + h + 4); ctx.stroke();
  });
};
// ── Additional new component drawings ──

const drawInductor = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _props: Record<string, any>) => {
  ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w * 0.15, y + h / 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w * 0.85, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  ctx.strokeStyle = '#B87333'; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(x + w * 0.2 + i * (w * 0.6 / 5) + (w * 0.06), y + h / 2, h * 0.25, Math.PI, 0);
    ctx.stroke();
  }
  ctx.fillStyle = '#888'; ctx.font = '6px monospace'; ctx.textAlign = 'center';
  ctx.fillText(_props.inductance || '10mH', x + w / 2, y + h + 8);
};

const drawVoltageRegulator = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>) => {
  ctx.fillStyle = '#1A1A1A';
  ctx.beginPath(); ctx.roundRect(x + w * 0.1, y + h * 0.1, w * 0.8, h * 0.6, 3); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#999'; ctx.fillRect(x + w * 0.15, y, w * 0.7, h * 0.15);
  ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.07, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#CCC'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
  ctx.fillText(props.regType || '7805', x + w / 2, y + h * 0.5);
  ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
  [0.25, 0.5, 0.75].forEach(p => { ctx.beginPath(); ctx.moveTo(x + w * p, y + h * 0.7); ctx.lineTo(x + w * p, y + h + 4); ctx.stroke(); });
  ctx.fillStyle = '#666'; ctx.font = '5px monospace';
  ctx.fillText('I', x + w * 0.25, y + h + 11); ctx.fillText('G', x + w * 0.5, y + h + 11); ctx.fillText('O', x + w * 0.75, y + h + 11);
};

const drawMOSFET = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>) => {
  ctx.fillStyle = '#1A1A1A';
  ctx.beginPath(); ctx.roundRect(x + w * 0.1, y + h * 0.15, w * 0.8, h * 0.55, 3); ctx.fill();
  ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#999'; ctx.fillRect(x + w * 0.15, y + h * 0.05, w * 0.7, h * 0.12);
  ctx.fillStyle = '#CCC'; ctx.font = '6px monospace'; ctx.textAlign = 'center';
  ctx.fillText(props.partNumber || 'IRF540', x + w / 2, y + h * 0.5);
  ctx.fillText(props.channel || 'N-CH', x + w / 2, y + h * 0.62);
  ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
  [0.25, 0.5, 0.75].forEach(p => { ctx.beginPath(); ctx.moveTo(x + w * p, y + h * 0.7); ctx.lineTo(x + w * p, y + h + 4); ctx.stroke(); });
  ctx.fillStyle = '#666'; ctx.font = '5px monospace';
  ctx.fillText('G', x + w * 0.25, y + h + 11); ctx.fillText('D', x + w * 0.5, y + h + 11); ctx.fillText('S', x + w * 0.75, y + h + 11);
};

const drawOptocoupler = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, _props: Record<string, any>) => {
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 2); ctx.fill();
  ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + 6, y + h / 2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#CCC'; ctx.font = '6px monospace'; ctx.textAlign = 'center';
  ctx.fillText(_props.partNumber || '4N35', x + w / 2, y + h / 2 + 2);
  ctx.strokeStyle = '#FF0'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + w * 0.3, y + h * 0.3); ctx.lineTo(x + w * 0.55, y + h * 0.45); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + w * 0.3, y + h * 0.5); ctx.lineTo(x + w * 0.55, y + h * 0.65); ctx.stroke();
  ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
  [0.2, 0.5, 0.8].forEach(p => {
    ctx.beginPath(); ctx.moveTo(x + w * p, y); ctx.lineTo(x + w * p, y - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + w * p, y + h); ctx.lineTo(x + w * p, y + h + 6); ctx.stroke();
  });
};

const drawLCD = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>) => {
  ctx.fillStyle = '#0A6E0A'; ctx.beginPath(); ctx.roundRect(x, y, w, h * 0.8, 3); ctx.fill();
  ctx.strokeStyle = '#063'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#4A8C3F'; ctx.fillRect(x + 4, y + 4, w - 8, h * 0.45);
  ctx.strokeStyle = '#2A5C1F'; ctx.strokeRect(x + 4, y + 4, w - 8, h * 0.45);
  ctx.fillStyle = '#111'; ctx.font = '7px monospace'; ctx.textAlign = 'center';
  ctx.fillText(props.text || 'Hello!', x + w / 2, y + h * 0.32);
  ctx.fillStyle = '#FFF'; ctx.font = '6px monospace';
  ctx.fillText(props.lcdType || '16x2', x + w / 2, y + h * 0.68);
  ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
  for (let i = 0; i < 8; i++) {
    const px = x + w * (0.06 + i * 0.125);
    ctx.beginPath(); ctx.moveTo(px, y + h * 0.8); ctx.lineTo(px, y + h + 4); ctx.stroke();
  }
};

const drawShiftRegister = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, props: Record<string, any>) => {
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 2); ctx.fill();
  ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.stroke();
  ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + 6, y + h / 2, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#CCC'; ctx.font = '6px monospace'; ctx.textAlign = 'center';
  ctx.fillText(props.icType || '74HC595', x + w / 2, y + h / 2 + 2);
  ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const px = x + w * 0.125 + i * w * 0.2;
    ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y - 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(px, y + h); ctx.lineTo(px, y + h + 6); ctx.stroke();
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
    pins: [
      ...Array.from({length:8}).map((_,i) => ({ name: `pin${i+1}`, x: 0.125 + i*0.125, y: 0, side: 'top' as const })),
      ...Array.from({length:8}).map((_,i) => ({ name: `pin${i+9}`, x: 0.125 + i*0.125, y: 1, side: 'bottom' as const })),
    ],
    draw: drawIC,
  },
  relay: {
    width: 50, height: 40,
    pins: [
      { name: 'coil1', x: 0.15, y: 1, side: 'bottom' },
      { name: 'coil2', x: 0.38, y: 1, side: 'bottom' },
      { name: 'com', x: 0.62, y: 1, side: 'bottom' },
      { name: 'no', x: 0.85, y: 1, side: 'bottom' },
    ],
    draw: drawRelay,
  },
  toggle_switch: {
    width: 36, height: 28,
    pins: [
      { name: 'left', x: 0.25, y: 1, side: 'bottom' },
      { name: 'common', x: 0.5, y: 1, side: 'bottom' },
      { name: 'right', x: 0.75, y: 1, side: 'bottom' },
    ],
    draw: drawToggleSwitch,
  },
  seven_seg: {
    width: 36, height: 48,
    pins: [
      { name: 'a', x: 0.2, y: 1, side: 'bottom' },
      { name: 'b', x: 0.4, y: 1, side: 'bottom' },
      { name: 'c', x: 0.6, y: 1, side: 'bottom' },
      { name: 'd', x: 0.8, y: 1, side: 'bottom' },
    ],
    draw: drawSevenSegment,
  },
  fuse: {
    width: 50, height: 18,
    pins: [
      { name: 'left', x: 0, y: 0.5, side: 'left' },
      { name: 'right', x: 1, y: 0.5, side: 'right' },
    ],
    draw: drawFuse,
  },
  piezo: {
    width: 32, height: 36,
    pins: [
      { name: 'positive', x: 0.35, y: 1, side: 'bottom' },
      { name: 'negative', x: 0.65, y: 1, side: 'bottom' },
    ],
    draw: drawPiezo,
  },
  inductor: {
    width: 60, height: 20,
    pins: [
      { name: 'left', x: 0, y: 0.5, side: 'left' },
      { name: 'right', x: 1, y: 0.5, side: 'right' },
    ],
    draw: drawInductor,
  },
  voltage_reg: {
    width: 36, height: 40,
    pins: [
      { name: 'input', x: 0.25, y: 1, side: 'bottom' },
      { name: 'gnd', x: 0.5, y: 1, side: 'bottom' },
      { name: 'output', x: 0.75, y: 1, side: 'bottom' },
    ],
    draw: drawVoltageRegulator,
  },
  mosfet: {
    width: 36, height: 40,
    pins: [
      { name: 'gate', x: 0.25, y: 1, side: 'bottom' },
      { name: 'drain', x: 0.5, y: 1, side: 'bottom' },
      { name: 'source', x: 0.75, y: 1, side: 'bottom' },
    ],
    draw: drawMOSFET,
  },
  optocoupler: {
    width: 40, height: 30,
    pins: [
      ...Array.from({length:3}).map((_,i) => ({ name: `pin${i+1}`, x: 0.2 + i*0.3, y: 0, side: 'top' as const })),
      ...Array.from({length:3}).map((_,i) => ({ name: `pin${i+4}`, x: 0.2 + i*0.3, y: 1, side: 'bottom' as const })),
    ],
    draw: drawOptocoupler,
  },
  lcd: {
    width: 80, height: 45,
    pins: [
      ...Array.from({length:8}).map((_,i) => ({ name: `pin${i+1}`, x: 0.06 + i*0.125, y: 1, side: 'bottom' as const })),
    ],
    draw: drawLCD,
  },
  shift_register: {
    width: 60, height: 30,
    pins: [
      ...Array.from({length:4}).map((_,i) => ({ name: `pin${i+1}`, x: 0.125 + i*0.2, y: 0, side: 'top' as const })),
      ...Array.from({length:4}).map((_,i) => ({ name: `pin${i+5}`, x: 0.125 + i*0.2, y: 1, side: 'bottom' as const })),
    ],
    draw: drawShiftRegister,
  },
  crystal: {
    width: 24, height: 18,
    pins: [
      { name: 'left', x: 0, y: 0.5, side: 'left' },
      { name: 'right', x: 1, y: 0.5, side: 'right' },
    ],
    draw: (ctx, x, y, w, h, props) => {
      // Metal case
      ctx.fillStyle = '#C0C0C0';
      ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w * 0.4, h * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#888'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#555'; ctx.font = '5px monospace'; ctx.textAlign = 'center';
      ctx.fillText(props.frequency || '16MHz', x + w / 2, y + h / 2 + 2);
      ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w * 0.1, y + h / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + w * 0.9, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
    },
  },
  dip_switch: {
    width: 50, height: 24,
    pins: [
      ...Array.from({length:4}).map((_,i) => ({ name: `sw${i+1}a`, x: 0.15 + i*0.23, y: 0, side: 'top' as const })),
      ...Array.from({length:4}).map((_,i) => ({ name: `sw${i+1}b`, x: 0.15 + i*0.23, y: 1, side: 'bottom' as const })),
    ],
    draw: (ctx, x, y, w, h, props) => {
      ctx.fillStyle = '#CC2222'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 2); ctx.fill();
      ctx.strokeStyle = '#881111'; ctx.lineWidth = 1; ctx.stroke();
      for (let i = 0; i < 4; i++) {
        const sx = x + w * (0.12 + i * 0.23);
        const isOn = props[`sw${i + 1}`] ?? false;
        ctx.fillStyle = '#FFF';
        ctx.fillRect(sx, y + 3, 6, h - 6);
        ctx.fillStyle = '#333';
        ctx.fillRect(sx + 1, isOn ? y + 3 : y + h / 2, 4, h / 2 - 3);
      }
      ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
      [0.15, 0.38, 0.61, 0.84].forEach(p => {
        ctx.beginPath(); ctx.moveTo(x + w * p, y); ctx.lineTo(x + w * p, y - 5); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + w * p, y + h); ctx.lineTo(x + w * p, y + h + 5); ctx.stroke();
      });
    },
  },
  barrel_jack: {
    width: 30, height: 30,
    pins: [
      { name: 'center', x: 0.5, y: 1, side: 'bottom' },
      { name: 'sleeve', x: 0.2, y: 1, side: 'bottom' },
      { name: 'switch', x: 0.8, y: 1, side: 'bottom' },
    ],
    draw: (ctx, x, y, w, h) => {
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(x, y, w, h * 0.7, 3); ctx.fill();
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.stroke();
      // Barrel opening
      ctx.fillStyle = '#333'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.35, w * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#555'; ctx.beginPath(); ctx.arc(x + w / 2, y + h * 0.35, w * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#888'; ctx.font = '5px monospace'; ctx.textAlign = 'center';
      ctx.fillText('DC', x + w / 2, y + h * 0.6);
      ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
      [0.2, 0.5, 0.8].forEach(p => {
        ctx.beginPath(); ctx.moveTo(x + w * p, y + h * 0.7); ctx.lineTo(x + w * p, y + h + 4); ctx.stroke();
      });
    },
  },
  h_bridge: {
    width: 60, height: 35,
    pins: [
      ...Array.from({length:4}).map((_,i) => ({ name: `pin${i+1}`, x: 0.125 + i*0.25, y: 0, side: 'top' as const })),
      ...Array.from({length:4}).map((_,i) => ({ name: `pin${i+5}`, x: 0.125 + i*0.25, y: 1, side: 'bottom' as const })),
    ],
    draw: (ctx, x, y, w, h, props) => {
      ctx.fillStyle = '#111'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 2); ctx.fill();
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#222'; ctx.beginPath(); ctx.arc(x + 6, y + h / 2, 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#CCC'; ctx.font = '6px monospace'; ctx.textAlign = 'center';
      ctx.fillText(props.icType || 'L293D', x + w / 2, y + h / 2 + 2);
      // heatsink tab
      ctx.fillStyle = '#888'; ctx.fillRect(x + w * 0.35, y - 3, w * 0.3, 5);
      ctx.strokeStyle = '#888'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const px = x + w * (0.125 + i * 0.25);
        ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y - 6); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(px, y + h); ctx.lineTo(px, y + h + 6); ctx.stroke();
      }
    },
  },
  current_sensor: {
    width: 36, height: 28,
    pins: [
      { name: 'vcc', x: 0.2, y: 0, side: 'top' },
      { name: 'out', x: 0.5, y: 0, side: 'top' },
      { name: 'gnd', x: 0.8, y: 0, side: 'top' },
      { name: 'ip+', x: 0.25, y: 1, side: 'bottom' },
      { name: 'ip-', x: 0.75, y: 1, side: 'bottom' },
    ],
    draw: (ctx, x, y, w, h, props) => {
      ctx.fillStyle = '#1A1A1A'; ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 2); ctx.fill();
      ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#CCC'; ctx.font = '5px monospace'; ctx.textAlign = 'center';
      ctx.fillText(props.partNumber || 'ACS712', x + w / 2, y + h / 2);
      ctx.fillText(props.range || '±5A', x + w / 2, y + h / 2 + 8);
      ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5;
      [0.2, 0.5, 0.8].forEach(p => { ctx.beginPath(); ctx.moveTo(x + w * p, y); ctx.lineTo(x + w * p, y - 5); ctx.stroke(); });
      [0.25, 0.75].forEach(p => { ctx.beginPath(); ctx.moveTo(x + w * p, y + h); ctx.lineTo(x + w * p, y + h + 5); ctx.stroke(); });
    },
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
  relay: 'Relay',
  toggle_switch: 'Toggle Switch',
  seven_seg: '7-Segment Display',
  fuse: 'Fuse',
  piezo: 'Piezo Speaker',
  inductor: 'Inductor',
  voltage_reg: 'Voltage Regulator',
  mosfet: 'MOSFET',
  optocoupler: 'Optocoupler',
  lcd: 'LCD Display',
  shift_register: 'Shift Register',
  crystal: 'Crystal Oscillator',
  dip_switch: 'DIP Switch',
  barrel_jack: 'Barrel Jack',
  h_bridge: 'H-Bridge (L293D)',
  current_sensor: 'Current Sensor',
};
