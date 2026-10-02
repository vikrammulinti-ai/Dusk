import { getMetrics, reconcileStories } from '../lib/storyStore.js';

export function runReconciler() {
  setInterval(() => {
    const repaired = reconcileStories(Date.now());
    const metrics = getMetrics();
    console.log(`reconciler: repaired=${repaired}, totalStories=${metrics.totalStories}, archived=${metrics.archivedStories}`);
  }, 5000);
}
