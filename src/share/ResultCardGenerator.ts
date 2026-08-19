import { formatTime } from '../scoring';
import { WEATHER_META } from '../weather';
import { EQUIPMENT_META } from '../equipment';
import { GAME_CONFIG } from '../config';
import type { EquipmentId, WeatherId } from '../types';

export interface ResultCardScoreRow {
  icon: string;
  label: string;
  value: number;
  max: number;
}

export interface ResultCardParams {
  fireTimeMs: number;
  score: number;
  rank: string;
  characterImage: string;
  weather: WeatherId;
  equipment: EquipmentId;
  comment: string;
  fireLevel: 0 | 1 | 2 | 3 | 4 | 5;
  scoreRows: ResultCardScoreRow[];
}

const W = 1200;
const H = 630;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load image: ${src}`));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob returned null'));
    }, 'image/png');
  });
}

function drawTree(ctx: CanvasRenderingContext2D, x: number, baseY: number, w: number, h: number): void {
  ctx.beginPath();
  ctx.moveTo(x, baseY);
  ctx.lineTo(x + w * 0.5, baseY - h * 0.16);
  ctx.lineTo(x + w * 0.42, baseY - h * 0.16);
  ctx.lineTo(x + w * 0.62, baseY - h * 0.38);
  ctx.lineTo(x + w * 0.5, baseY - h * 0.38);
  ctx.lineTo(x + w * 0.72, baseY - h * 0.62);
  ctx.lineTo(x + w * 0.58, baseY - h * 0.6);
  ctx.lineTo(x + w, baseY - h);
  ctx.lineTo(x + w, baseY);
  ctx.closePath();
  ctx.fill();
}

function drawBackground(ctx: CanvasRenderingContext2D, fireLevel: number): void {
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0a0d1c');
  bg.addColorStop(0.4, '#0c0f1a');
  bg.addColorStop(0.78, fireLevel === 0 ? '#0a0a0c' : '#100a06');
  bg.addColorStop(1, fireLevel === 0 ? '#08090c' : '#170e07');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  if (fireLevel > 0) {
    const glowR = 260 + fireLevel * 60;
    const glow = ctx.createRadialGradient(W * 0.72, H * 1.05, 0, W * 0.72, H * 1.05, glowR);
    glow.addColorStop(0, `rgba(255,140,50,${0.15 + fireLevel * 0.05})`);
    glow.addColorStop(1, 'rgba(255,90,20,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
  }

  // stars
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  const starSeed = [
    [70, 40], [180, 70], [300, 35], [420, 80], [520, 45], [90, 110], [250, 100],
  ];
  for (const [sx, sy] of starSeed) {
    ctx.globalAlpha = 0.4 + ((sx * sy) % 10) / 20;
    ctx.beginPath();
    ctx.arc(sx, sy, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.fillStyle = 'rgba(4,5,9,0.98)';
  drawTree(ctx, -30, H, 170, 300);
  drawTree(ctx, 60, H, 110, 200);
  ctx.fillStyle = 'rgba(4,5,9,0.9)';
  drawTree(ctx, W - 150, H, 190, 340);
}

function drawGroundGlowAndEmbers(ctx: CanvasRenderingContext2D, fireLevel: number, characterX: number): void {
  if (fireLevel === 0) {
    // just a faint wisp of smoke, no fire
    ctx.fillStyle = 'rgba(180,180,190,0.18)';
    ctx.beginPath();
    ctx.ellipse(characterX, H - 90, 40, 55, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  const baseY = H - 40;
  const glowSize = 70 + fireLevel * 34;
  const grad = ctx.createRadialGradient(characterX, baseY, 0, characterX, baseY, glowSize);
  grad.addColorStop(0, `rgba(255,150,60,${0.5 + fireLevel * 0.06})`);
  grad.addColorStop(1, 'rgba(255,90,20,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(characterX, baseY, glowSize, 0, Math.PI * 2);
  ctx.fill();

  const emberCount = fireLevel * 5;
  for (let i = 0; i < emberCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 20 + Math.random() * (60 + fireLevel * 30);
    const ex = characterX + Math.cos(angle) * dist;
    const ey = baseY - Math.abs(Math.sin(angle) * dist) - Math.random() * 80;
    ctx.fillStyle = `rgba(255,${170 + Math.round(Math.random() * 60)},90,${0.5 + Math.random() * 0.4})`;
    ctx.beginPath();
    ctx.arc(ex, ey, 1.5 + Math.random() * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  if (fireLevel >= 4) {
    // dramatic rim burst for the top ranks
    const burst = ctx.createRadialGradient(characterX, baseY - 160, 0, characterX, baseY - 160, 380);
    burst.addColorStop(0, 'rgba(255,220,150,0.18)');
    burst.addColorStop(1, 'rgba(255,220,150,0)');
    ctx.fillStyle = burst;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawMultilineText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  lineHeight: number,
): number {
  const lines = text.split('\n');
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * lineHeight));
  return y + lines.length * lineHeight;
}

export async function generateResultCard(params: ResultCardParams): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable');

  drawBackground(ctx, params.fireLevel);

  const characterAreaX = W * 0.76;
  drawGroundGlowAndEmbers(ctx, params.fireLevel, characterAreaX);

  try {
    const charImg = await loadImage(params.characterImage);
    const targetH = H * 0.92;
    const targetW = targetH * (charImg.width / charImg.height);
    const dx = characterAreaX - targetW / 2;
    const dy = H - targetH - 6;
    ctx.drawImage(charImg, dx, dy, targetW, targetH);
  } catch {
    // キャラクター画像が読み込めなくてもカード自体は生成できるようにする
  }

  // vignette to keep text legible
  const vignette = ctx.createLinearGradient(0, 0, W * 0.85, 0);
  vignette.addColorStop(0, 'rgba(3,4,8,0.55)');
  vignette.addColorStop(0.65, 'rgba(3,4,8,0.15)');
  vignette.addColorStop(1, 'rgba(3,4,8,0)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  const fontFamily = "'Hiragino Sans','Noto Sans JP','Yu Gothic',system-ui,sans-serif";
  const left = 64;

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffb347';
  ctx.font = `700 20px ${fontFamily}`;
  ctx.fillText('S U R V I V E   T H E   N I G H T', left, 46);

  ctx.fillStyle = '#fff6e9';
  ctx.font = `800 92px ${fontFamily}`;
  ctx.fillText(String(params.score), left, 130);
  const scoreWidth = ctx.measureText(String(params.score)).width;
  ctx.font = `700 30px ${fontFamily}`;
  ctx.fillStyle = '#cfc7d8';
  ctx.fillText('/ 100', left + scoreWidth + 12, 130);

  ctx.fillStyle = '#ffb347';
  ctx.font = `800 30px ${fontFamily}`;
  ctx.fillText(`🔥 ${params.rank}`, left, 168);

  ctx.fillStyle = '#a89fb8';
  ctx.font = `700 15px ${fontFamily}`;
  ctx.fillText('着火タイム', left, 200);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 15px ${fontFamily}`;
  const timeLabelWidth = ctx.measureText('着火タイム').width;
  ctx.font = `800 26px ${fontFamily}`;
  ctx.fillText(formatTime(params.fireTimeMs), left + timeLabelWidth + 14, 200);

  // スコア内訳：2列×3行のコンパクトなバーで、火起こし/素材選び/息/火の育て方/サバイバル力/時間を見せる
  drawScoreBreakdown(ctx, params.scoreRows, left, 226, fontFamily);

  const weatherMeta = WEATHER_META[params.weather];
  const equipmentMeta = EQUIPMENT_META[params.equipment];
  ctx.fillStyle = '#b9b3c9';
  ctx.font = `600 17px ${fontFamily}`;
  ctx.fillText(`${weatherMeta.emoji} 天候：${weatherMeta.label}　${equipmentMeta.emoji} 装備：${equipmentMeta.label}`, left, 410);

  ctx.fillStyle = '#e7e1ee';
  ctx.font = `500 18px ${fontFamily}`;
  drawMultilineText(ctx, params.comment, left, 442, 25);

  ctx.fillStyle = '#8f89a0';
  ctx.font = `600 17px ${fontFamily}`;
  ctx.fillText('あなたは火を起こせるか？', left, 566);
  ctx.fillStyle = '#ffb347';
  ctx.font = `700 19px ${fontFamily}`;
  ctx.fillText(GAME_CONFIG.share.url.replace(/^https?:\/\//, '').replace(/\/$/, ''), left, 596);

  return canvasToBlob(canvas);
}

function drawScoreBreakdown(
  ctx: CanvasRenderingContext2D,
  rows: ResultCardScoreRow[],
  left: number,
  top: number,
  fontFamily: string,
): void {
  const colW = 340;
  const rowH = 40;
  const barW = 150;

  rows.forEach((row, i) => {
    const col = Math.floor(i / 3);
    const line = i % 3;
    const x = left + col * colW;
    const y = top + line * rowH;

    ctx.font = `600 15px ${fontFamily}`;
    ctx.fillStyle = '#cfc7d8';
    ctx.fillText(`${row.icon} ${row.label}`, x, y + 13);

    const trackY = y + 22;
    const pct = row.max > 0 ? Math.min(1, row.value / row.max) : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath();
    ctx.roundRect(x, trackY, barW, 7, 3.5);
    ctx.fill();
    ctx.fillStyle = '#ffb347';
    ctx.beginPath();
    ctx.roundRect(x, trackY, barW * pct, 7, 3.5);
    ctx.fill();

    ctx.font = `700 13px ${fontFamily}`;
    ctx.fillStyle = '#9c94ac';
    ctx.fillText(`${row.value}/${row.max}`, x + barW + 10, trackY + 7);
  });
}
