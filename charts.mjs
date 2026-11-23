import { pitchPoint } from './engine.mjs';

const colors = { home: '#71efbd', away: '#ff9e92' };
const field = { x: 28, y: 23, w: 704, h: 439 };
const coord = (x, y) => [field.x + field.w * x / 100, field.y + field.h * y / 100];

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function circle(ctx, x, y, radius, filled = false) {
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  if (filled) ctx.fill();
  else ctx.stroke();
}

function drawField(ctx) {
  const { x, y, w, h } = field;
  ctx.fillStyle = '#112720';
  ctx.fillRect(0, 0, 760, 485);
  for (let stripe = 0; stripe < 12; stripe += 1) {
    ctx.fillStyle = stripe % 2 ? '#1e3d32' : '#234437';
    ctx.fillRect(x + stripe * w / 12, y, w / 12, h);
  }
  ctx.strokeStyle = '#76998b';
  ctx.lineWidth = 1.25;
  ctx.strokeRect(x, y, w, h);
  line(ctx, x + w / 2, y, x + w / 2, y + h);
  circle(ctx, ...coord(50, 50), 63);
  ctx.fillStyle = '#76998b';
  circle(ctx, ...coord(50, 50), 2.5, true);

  for (const direction of [1, -1]) {
    const end = direction === 1 ? x : x + w;
    const penaltyDepth = w * 0.12;
    ctx.strokeRect(end, y + h * 0.205, penaltyDepth * direction, h * 0.59);
    ctx.strokeRect(end, y + h * 0.365, 38 * direction, h * 0.27);
    ctx.strokeRect(end, y + h * 0.445, -12 * direction, h * 0.11);
    const spot = 55;
    circle(ctx, end + direction * spot, y + h / 2, 2.6, true);
    ctx.beginPath();
    const angle = Math.acos((penaltyDepth - spot) / 61);
    const center = direction === 1 ? 0 : Math.PI;
    ctx.arc(end + direction * spot, y + h / 2, 61, center - angle, center + angle);
    ctx.stroke();
  }

  ctx.save();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#e8d181a0';
  ctx.fillStyle = '#e8d18113';
  for (const zoneX of [12, 70]) {
    const [left, top] = coord(zoneX, 40);
    ctx.fillRect(left, top, w * 0.18, h * 0.20);
    ctx.strokeRect(left, top, w * 0.18, h * 0.20);
  }
  ctx.restore();
}

function drawDensity(ctx, events) {
  for (const event of events) {
    const [x, y] = coord(...pitchPoint(event));
    const fade = ctx.createRadialGradient(x, y, 0, x, y, 40);
    fade.addColorStop(0, colors[event.side] + '79');
    fade.addColorStop(1, colors[event.side] + '00');
    ctx.fillStyle = fade;
    ctx.fillRect(x - 40, y - 40, 80, 80);
  }
}

function drawAction(ctx, event, selected, alpha = 1) {
  const [x, y] = coord(...pitchPoint(event));
  const [endX, endY] = coord(...pitchPoint(event, true));
  const color = colors[event.side];
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = selected ? 3 : 2;
  if ((event.type === 'pass' || event.type === 'shot') && Math.hypot(endX - x, endY - y) > 10) {
    const angle = Math.atan2(endY - y, endX - x);
    const arrowSize = 9;
    if (event.type === 'pass') ctx.setLineDash([6, 4]);
    line(ctx, x, y, endX, endY);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowSize * Math.cos(angle - 0.5), endY - arrowSize * Math.sin(angle - 0.5));
    ctx.lineTo(endX - arrowSize * Math.cos(angle + 0.5), endY - arrowSize * Math.sin(angle + 0.5));
    ctx.closePath();
    ctx.fill();
  }
  circle(ctx, x, y, selected ? 6 : 4.5, true);
  if (selected || event.goal) circle(ctx, x, y, 12);
  ctx.restore();
}

export function drawPitch(canvas, events, layer, selected) {
  const ctx = canvas.getContext('2d');
  drawField(ctx);
  ctx.save();
  ctx.beginPath();
  ctx.rect(field.x, field.y, field.w, field.h);
  ctx.clip();
  if (layer === 'density') drawDensity(ctx, events);
  else {
    const recent = events.slice(-12);
    recent.forEach((event, index) => {
      if (event.id !== selected?.id) drawAction(ctx, event, false, 0.36 + (index / recent.length) * 0.58);
    });
  }
  if (selected) drawAction(ctx, selected, true);
  ctx.restore();
}

export function drawMomentum(canvas, rhythm, minute) {
  const ctx = canvas.getContext('2d');
  const left = 36;
  const right = 726;
  const mid = 93;
  const step = (right - left) / rhythm.length;
  const max = Math.max(0.2, ...rhythm.flatMap(({ home, away }) => [home, away]));
  ctx.clearRect(0, 0, 760, 205);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#344742';
  for (const y of [32, mid, 154]) line(ctx, left, y, right, y);
  rhythm.forEach(({ home, away }, index) => {
    const start = left + index * step;
    const homeHeight = home / max * 62;
    const awayHeight = away / max * 62;
    ctx.fillStyle = colors.home;
    ctx.fillRect(start + 4, mid - homeHeight, step - 8, homeHeight);
    ctx.fillStyle = colors.away;
    ctx.fillRect(start + 4, mid, step - 8, awayHeight);
  });
  if (minute > 0) {
    const position = left + minute / 90 * (right - left);
    ctx.strokeStyle = '#a6bab6';
    ctx.setLineDash([4, 4]);
    line(ctx, position, 15, position, 157);
    ctx.setLineDash([]);
  }
  ctx.font = '17px ui-monospace, monospace';
  ctx.fillStyle = '#a6bab6';
  ctx.textAlign = 'center';
  for (const mark of [0, 15, 30, 45, 60, 75, 90]) {
    ctx.fillText(`${mark}′`, left + (mark / 90) * (right - left), 184);
  }
}
