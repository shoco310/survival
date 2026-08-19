import { store } from '../state';
import { formatTime } from '../scoring';

export function mountDebugPanel(container: HTMLElement): void {
  const tick = () => {
    const s = store.state;
    const elapsed = s.startTime ? Date.now() - s.startTime : 0;
    const sunsetRemaining = s.sunsetAt ? Math.max(0, (s.sunsetAt - Date.now()) / 1000) : 0;
    container.innerHTML = `
      <div><b>[DEBUG]</b> screen=${s.screen} fieldPhase=${s.fieldPhase}</div>
      <div>weather=${s.weather} (next event ${s.weatherEventIndex}/${s.weatherTimeline.length}) equipment=${s.equipment ?? '-'}</div>
      <div>wetness=${s.wetness.toFixed(1)} stamina=${s.stamina.toFixed(1)}</div>
      <div>materials=${s.collectedMaterials.map((m) => `${m.id}(${m.role})`).join(',') || '-'}</div>
      <div>heat=${s.heat.toFixed(1)} fire=${s.fire.toFixed(1)} oxygen=${s.oxygen.toFixed(1)} sparked=${s.sparked}</div>
      <div>elapsed=${formatTime(elapsed)} sunsetIn=${sunsetRemaining.toFixed(1)}s gameOverReason=${s.gameOverReason ?? '-'}</div>
      <div>rotate: startedAt=${s.rotateMetrics.startedAt} finishedAt=${s.rotateMetrics.finishedAt ?? '-'} resetCount=${s.rotateResetCount}</div>
      <div>breath: totalTicks=${s.breathMetrics.totalTicks.toFixed(1)} safeZoneTicks(efficiency-weighted)=${s.breathMetrics.safeZoneTicks.toFixed(
        1,
      )}</div>
      <div>kindlingLog=${s.kindlingLog.map((k) => `${k.id}${k.goodTiming ? '✓' : '✗'}`).join(',') || '-'}</div>
    `;
    requestAnimationFrame(tick);
  };
  tick();
}
