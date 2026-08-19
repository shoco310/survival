import type { Material } from './types';

/**
 * 絵文字に頼らない、統一された素材アイコン（インラインSVG）。
 * OS依存のApple絵文字的な質感がゲーム世界から浮いて見えるのを避けるため、
 * 形のアーキタイプ（葉・草・綿毛・樹皮・苔・泥・小枝・松ぼっくり・竹・石・薪）を
 * 少数用意し、素材ごとに配色だけを変えて描き分ける。
 */

function leafCluster(c1: string, c2: string): string {
  return `<path d="M32 10c8 4 12 14 8 24-3 7-9 11-8 20-9-3-15-11-16-20-1-10 6-20 16-24z" fill="${c1}"/>
    <path d="M24 22c5 3 7 9 5 15-2 4-6 6-6 12-6-2-9-7-10-13 0-6 4-12 11-14z" fill="${c2}" opacity="0.85"/>`;
}
function grassTuft(c1: string): string {
  const blades = [
    [22, 54, 18, 20, 26, 12],
    [30, 54, 28, 16, 34, 8],
    [38, 54, 40, 18, 44, 10],
    [44, 54, 48, 24, 54, 16],
  ];
  return blades
    .map(([x1, y1, cx, cy, x2, y2]) => `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" stroke="${c1}" stroke-width="4" fill="none" stroke-linecap="round"/>`)
    .join('');
}
function fluff(c1: string): string {
  const dots = [
    [32, 32, 13],
    [18, 24, 6],
    [46, 24, 6],
    [16, 40, 5],
    [48, 40, 5],
    [32, 14, 6],
  ];
  return dots.map(([cx, cy, r]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c1}" opacity="0.9"/>`).join('');
}
function barkStrip(c1: string, c2: string): string {
  return `<path d="M14 44c2-14 10-26 24-30 4-1 8 2 6 6-10 4-18 14-20 26-1 5-6 6-8 3-2-2-2-4-2-5z" fill="${c1}"/>
    <path d="M20 40c3-10 9-18 18-22" stroke="${c2}" stroke-width="2" fill="none" opacity="0.5"/>`;
}
function mossClump(c1: string, c2: string): string {
  return `<circle cx="24" cy="38" r="12" fill="${c1}"/>
    <circle cx="38" cy="34" r="14" fill="${c1}"/>
    <circle cx="34" cy="46" r="10" fill="${c2}" opacity="0.75"/>
    <circle cx="20" cy="28" r="7" fill="${c2}" opacity="0.7"/>`;
}
function mudBlob(c1: string): string {
  return `<path d="M14 40c-2-8 6-16 16-18 12-2 22 4 22 14 0 9-10 14-20 14-9 0-16-3-18-10z" fill="${c1}"/>`;
}
function twig(c1: string): string {
  return `<path d="M12 50 L28 34 L24 26 L38 30 L34 20 L50 14" stroke="${c1}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
}
function pinecone(c1: string, c2: string): string {
  const scales = [20, 26, 32, 38, 44].map(
    (y) => `<path d="M20 ${y} Q32 ${y - 4} 44 ${y}" stroke="${c2}" stroke-width="2.4" fill="none" opacity="0.6"/>`,
  ).join('');
  return `<ellipse cx="32" cy="34" rx="14" ry="20" fill="${c1}"/>${scales}`;
}
function bamboo(c1: string, c2: string): string {
  return `<rect x="20" y="10" width="14" height="44" rx="6" fill="${c1}"/>
    <rect x="16" y="24" width="22" height="4" rx="2" fill="${c2}" opacity="0.8"/>
    <rect x="16" y="38" width="22" height="4" rx="2" fill="${c2}" opacity="0.8"/>`;
}
function stone(c1: string, c2: string): string {
  return `<path d="M14 40c-1-8 5-14 14-16 10-2 20 2 22 12 2 9-6 16-18 16-9 0-17-4-18-12z" fill="${c1}"/>
    <path d="M20 32c4-4 10-6 16-4" stroke="${c2}" stroke-width="2" fill="none" opacity="0.5"/>`;
}
function branch(c1: string, c2: string): string {
  return `<path d="M10 46 Q26 30 54 18" stroke="${c1}" stroke-width="11" fill="none" stroke-linecap="round"/>
    <path d="M14 44 Q28 30 50 20" stroke="${c2}" stroke-width="2" fill="none" opacity="0.45" stroke-linecap="round"/>
    <ellipse cx="12" cy="45" rx="6" ry="5" fill="${c2}" opacity="0.7"/>`;
}

type IconDef = { body: string };

const ICONS: Record<string, IconDef> = {
  driedLeaves: { body: leafCluster('#b9822f', '#8f5f22') },
  dryGrass: { body: grassTuft('#c9a24a') },
  cottonFluff: { body: fluff('#e9e2d2') },
  thinBark: { body: barkStrip('#8a6a45', '#5c4327') },
  dryMoss: { body: mossClump('#7d8f4a', '#5c6b33') },
  moss: { body: mossClump('#4f7a4a', '#39572f') },
  greenGrass: { body: grassTuft('#5fa356') },
  wetFallenLeaves: { body: leafCluster('#6b5a3a', '#4a3f28') },
  mud: { body: mudBlob('#4a3826') },

  dryTwig: { body: twig('#9a7245') },
  pineCone: { body: pinecone('#8a6034', '#5e4020') },
  bark: { body: barkStrip('#7a5a38', '#4e3a22') },
  bambooSliver: { body: bamboo('#a8c25a', '#7f9a3c') },
  wetBranch: { body: twig('#5c6b4a') },
  stone: { body: stone('#6b6a68', '#4c4b49') },

  thickDryBranch: { body: branch('#8f6a3e', '#5c4327') },
  driftwood: { body: branch('#8a8378', '#5f5a51') },
  rottenWood: { body: branch('#5f5138', '#3c3322') },
  greenWood: { body: branch('#6b8a4a', '#496130') },
  flatStone: { body: stone('#7c7a76', '#57554f') },
};

export function materialIconHtml(material: Pick<Material, 'id'>): string {
  const def = ICONS[material.id];
  const body = def?.body ?? twig('#9a7245');
  return `<svg viewBox="0 0 64 64" class="material-icon-svg" aria-hidden="true">${body}</svg>`;
}
