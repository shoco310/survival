import { store } from '../state';
import { GAME_CONFIG } from '../config';
import { computeScore, formatTime } from '../scoring';
import { WEATHER_META } from '../weather';
import { shareResult, twitterShareUrl } from '../share';
import type { EquipmentId } from '../types';
import type { ScreenContext, Unmount } from './context';

const EQUIPMENT_LABEL: Record<EquipmentId, string> = {
  fire: '🔥 FIRE KIT',
  food: '🍖 FOOD',
  shelter: '🏕️ SHELTER',
};

const FLAVOR_BY_RANK: Record<string, string> = {
  都会に帰ろう: '無人島はあなたに向いていないかもしれない。\n次はマッチを持ってこよう。',
  キャンプ初心者: 'なんとか火はついた。\nでも夜はまだ長い。',
  サバイバー: 'あなたは無人島で一晩を生き延びられそうだ。',
  ワイルドサバイバー: 'あなたは悪条件の中でも火を起こした。\n今夜は生き延びられそうだ。',
  サバイバルマスター: '見事な火おこし。\n島の動物たちもあなたを一目置いている。',
  人類代表: 'プロメテウスもきっと驚く手際。\n人類の火の歴史に、あなたの名が刻まれた。',
};

export function mountResult(root: HTMLElement, ctx: ScreenContext): Unmount {
  const state = store.state;
  const score = computeScore(state);
  const elapsedMs = state.startTime != null && state.finishTime != null ? state.finishTime - state.startTime : 0;

  ctx.setFireVisual({ phase: 'burning', fire: 100 });
  ctx.setAmbient(100);

  const best = Number(localStorage.getItem(GAME_CONFIG.storageKey) ?? Infinity);
  const isNewRecord = elapsedMs < best;
  if (isNewRecord) localStorage.setItem(GAME_CONFIG.storageKey, String(elapsedMs));
  const bestMs = isNewRecord ? elapsedMs : best;

  root.innerHTML = `
    <div class="screen" style="position:relative;">
      <div id="success-flash" class="success-flash">
        <div class="fire-emoji">🔥</div>
        <h2>FIRE!</h2>
        <p>人類は火を手に入れた。</p>
        <p>今夜、あなたは生き延びられる。</p>
      </div>
      <div id="result-body" style="opacity:0;transition:opacity .5s ease;">
        <div class="result-title">
          <div class="badge">SURVIVAL RESULT</div>
          <div class="time">${formatTime(elapsedMs)}</div>
          ${isNewRecord ? '<div class="new-record">NEW RECORD!</div>' : ''}
          <div class="best-line">BEST ${Number.isFinite(bestMs) ? formatTime(bestMs) : '--:--.--'}</div>
        </div>

        <div class="score-panel">
          <div class="score-total">
            <div class="num">${score.total} / 100</div>
            <div class="rank">${score.rank}</div>
          </div>
          ${scoreRow('判断力', score.judgement, 30)}
          ${scoreRow('火おこし技術', score.technique, 25)}
          ${scoreRow('火の管理', score.management, 25)}
          ${scoreRow('スピード', score.speed, 20)}
        </div>

        <div class="flavor-text">${(FLAVOR_BY_RANK[score.rank] ?? '').replace(/\n/g, '<br/>')}</div>

        <div class="result-meta">
          <div class="meta-item"><div class="k">🎒 装備</div>${EQUIPMENT_LABEL[state.equipment ?? 'food']}</div>
          <div class="meta-item"><div class="k">🌦️ 天候</div>${WEATHER_META[state.weather].emoji} ${WEATHER_META[state.weather].label}</div>
          <div class="meta-item" style="grid-column:1/-1;"><div class="k">🌿 集めた素材</div>${state.collectedMaterials
            .map((m) => m.emoji)
            .join(' ')}</div>
        </div>

        <div class="result-actions">
          <button class="btn btn-primary" id="share-btn">結果をシェア</button>
          <button class="btn btn-twitter" id="twitter-btn">Xでシェア</button>
          <button class="btn btn-secondary" id="retry-btn">もう一度挑戦</button>
        </div>
      </div>
    </div>
  `;

  const successFlash = root.querySelector<HTMLElement>('#success-flash')!;
  const resultBody = root.querySelector<HTMLElement>('#result-body')!;
  const revealTimeout = setTimeout(() => {
    successFlash.style.transition = 'opacity .5s ease';
    successFlash.style.opacity = '0';
    resultBody.style.opacity = '1';
    setTimeout(() => successFlash.remove(), 500);
  }, 1900);

  const shareBtn = root.querySelector<HTMLButtonElement>('#share-btn')!;
  const twitterBtn = root.querySelector<HTMLButtonElement>('#twitter-btn')!;
  const retryBtn = root.querySelector<HTMLButtonElement>('#retry-btn')!;

  const onShare = async () => {
    const result = await shareResult(elapsedMs, score, state.weather);
    if (result === 'copied') {
      shareBtn.textContent = 'コピーしました！';
      setTimeout(() => (shareBtn.textContent = '結果をシェア'), 1600);
    }
  };
  const onTwitter = () => window.open(twitterShareUrl(elapsedMs, score, state.weather), '_blank', 'noopener');
  const onRetry = () => store.reset();

  shareBtn.addEventListener('click', onShare);
  twitterBtn.addEventListener('click', onTwitter);
  retryBtn.addEventListener('click', onRetry);

  return () => {
    clearTimeout(revealTimeout);
    shareBtn.removeEventListener('click', onShare);
    twitterBtn.removeEventListener('click', onTwitter);
    retryBtn.removeEventListener('click', onRetry);
  };
}

function scoreRow(name: string, value: number, max: number): string {
  const pct = (value / max) * 100;
  return `
    <div class="score-row">
      <span class="name">${name}</span>
      <span class="bar-track"><span class="bar-fill" style="width:${pct}%"></span></span>
      <span>${value} / ${max}</span>
    </div>
  `;
}
