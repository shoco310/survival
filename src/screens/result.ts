import { store } from '../state';
import { GAME_CONFIG } from '../config';
import { computeScore, formatTime } from '../scoring';
import { WEATHER_META } from '../weather';
import { EQUIPMENT_META } from '../equipment';
import { getRankPreset } from '../share/rankPresets';
import { generateResultCard } from '../share/ResultCardGenerator';
import { shareResult, downloadResultCard, twitterShareUrl } from '../share';
import type { ScreenContext, Unmount } from './context';

export function mountResult(root: HTMLElement, ctx: ScreenContext): Unmount {
  const state = store.state;
  const score = computeScore(state);
  const elapsedMs = state.startTime != null && state.finishTime != null ? state.finishTime - state.startTime : 0;
  const preset = getRankPreset(score.rank);

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

        <div class="flavor-text">${preset.comment.replace(/\n/g, '<br/>')}</div>

        <div class="result-meta">
          <div class="meta-item"><div class="k">🎒 装備</div>${EQUIPMENT_META[state.equipment ?? 'food'].emoji} ${EQUIPMENT_META[state.equipment ?? 'food'].label}</div>
          <div class="meta-item"><div class="k">🌦️ 天候</div>${WEATHER_META[state.weather].emoji} ${WEATHER_META[state.weather].label}</div>
          <div class="meta-item" style="grid-column:1/-1;"><div class="k">🌿 集めた素材</div>${state.collectedMaterials
            .map((m) => m.emoji)
            .join(' ')}</div>
        </div>

        <div class="card-preview-block">
          <div class="card-preview-label">シェアするとこんな感じ</div>
          <div class="card-preview-frame" id="card-preview-frame">
            <div class="card-preview-loading">カードを生成中…</div>
          </div>
        </div>

        <div class="result-actions">
          <button class="btn btn-primary" id="share-btn">📤 結果をシェア</button>
          <button class="btn btn-secondary" id="save-btn">🖼️ 結果画像を保存</button>
          <button class="btn btn-twitter" id="twitter-btn">𝕏 Xでシェア</button>
          <button class="btn btn-secondary" id="retry-btn">🔥 もう一度挑戦</button>
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
  const saveBtn = root.querySelector<HTMLButtonElement>('#save-btn')!;
  const twitterBtn = root.querySelector<HTMLButtonElement>('#twitter-btn')!;
  const retryBtn = root.querySelector<HTMLButtonElement>('#retry-btn')!;
  const previewFrame = root.querySelector<HTMLElement>('#card-preview-frame')!;

  let cardBlob: Blob | null = null;
  let cardObjectUrl: string | null = null;

  generateResultCard({
    fireTimeMs: elapsedMs,
    score: score.total,
    rank: score.rank,
    characterImage: preset.characterImage,
    weather: state.weather,
    equipment: state.equipment ?? 'food',
    comment: preset.comment,
    fireLevel: preset.fireLevel,
  })
    .then((blob) => {
      cardBlob = blob;
      cardObjectUrl = URL.createObjectURL(blob);
      previewFrame.innerHTML = `<img src="${cardObjectUrl}" alt="Result Card プレビュー" />`;
    })
    .catch(() => {
      previewFrame.innerHTML = `<div class="card-preview-loading">プレビューを生成できませんでした</div>`;
    });

  const onShare = async () => {
    shareBtn.disabled = true;
    const originalText = shareBtn.textContent;
    const result = await shareResult(cardBlob, elapsedMs, score, state.weather);
    if (result === 'copied') {
      shareBtn.textContent = 'コピーしました！';
      setTimeout(() => (shareBtn.textContent = originalText), 1600);
    } else if (result === 'failed' || result === 'unsupported') {
      shareBtn.textContent = '画像保存かXでシェアしてね';
      setTimeout(() => (shareBtn.textContent = originalText), 2000);
    }
    shareBtn.disabled = false;
  };
  const onSave = () => {
    if (!cardBlob) return;
    downloadResultCard(cardBlob);
  };
  const onTwitter = () => window.open(twitterShareUrl(elapsedMs, score, state.weather), '_blank', 'noopener');
  const onRetry = () => store.reset();

  shareBtn.addEventListener('click', onShare);
  saveBtn.addEventListener('click', onSave);
  twitterBtn.addEventListener('click', onTwitter);
  retryBtn.addEventListener('click', onRetry);

  return () => {
    clearTimeout(revealTimeout);
    if (cardObjectUrl) URL.revokeObjectURL(cardObjectUrl);
    shareBtn.removeEventListener('click', onShare);
    saveBtn.removeEventListener('click', onSave);
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
