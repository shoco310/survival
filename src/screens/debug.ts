import { store } from '../state';
import { formatTime } from '../scoring';

export function mountDebugPanel(container: HTMLElement): void {
  const tick = () => {
    const s = store.state;
    const elapsed = s.startTime ? Date.now() - s.startTime : 0;
    container.innerHTML = `
      <div><b>[DEBUG]</b> screen=${s.screen} firePhase=${s.firePhase}</div>
      <div>weather=${s.weather} (next event ${s.weatherEventIndex}/${s.weatherTimeline.length}) equipment=${s.equipment ?? '-'}</div>
      <div>wetness=${s.wetness.toFixed(1)}</div>
      <div>materials=${s.collectedMaterials.map((m) => `${m.id}(${m.role})`).join(',') || '-'}</div>
      <div>heat=${s.heat.toFixed(1)} emberPower=${s.emberPower.toFixed(1)} fire=${s.fire.toFixed(1)} oxygen=${s.oxygen.toFixed(1)} sparked=${s.sparked}</div>
      <div>elapsed=${formatTime(elapsed)}</div>
      <div>rotate: startedAt=${s.rotateMetrics.startedAt} finishedAt=${s.rotateMetrics.finishedAt ?? '-'} resetCount=${s.rotateResetCount}</div>
      <div>breath: totalTicks=${s.breathMetrics.totalTicks.toFixed(1)} safeZoneTicks=${s.breathMetrics.safeZoneTicks.toFixed(
        1,
      )} extinguishCount=${s.breathMetrics.extinguishCount}</div>
      <div>fuelLog=${s.fuelLog.map((f) => `${f.id}${f.goodTiming ? '✓' : '✗'}`).join(',') || '-'} fuelMistakes=${s.fuelMistakes}</div>
      <div>overblowWarning=${s.overblowWarning}</div>
    `;
    requestAnimationFrame(tick);
  };
  tick();
}
