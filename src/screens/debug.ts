import { store } from '../state';
import { formatTime } from '../scoring';

export function mountDebugPanel(container: HTMLElement): void {
  const tick = () => {
    const s = store.state;
    const elapsed = s.startTime ? Date.now() - s.startTime : 0;
    container.innerHTML = `
      <div><b>[DEBUG]</b> screen=${s.screen}</div>
      <div>weather=${s.weather} equipment=${s.equipment ?? '-'}</div>
      <div>materials=${s.collectedMaterials.map((m) => m.materialId).join(',') || '-'}</div>
      <div>heat=${s.heat.toFixed(1)} fire=${s.fire.toFixed(1)} oxygen=${s.oxygen.toFixed(1)} sparked=${s.sparked}</div>
      <div>elapsed=${formatTime(elapsed)}</div>
      <div>friction: startedAt=${s.frictionMetrics.startedAt} finishedAt=${s.frictionMetrics.finishedAt ?? '-'}</div>
      <div>breath: totalTicks=${s.breathMetrics.totalTicks.toFixed(1)} safeZoneTicks=${s.breathMetrics.safeZoneTicks.toFixed(
        1,
      )} extinguishCount=${s.breathMetrics.extinguishCount}</div>
      <div>overblowWarning=${s.overblowWarning}</div>
    `;
    requestAnimationFrame(tick);
  };
  tick();
}
