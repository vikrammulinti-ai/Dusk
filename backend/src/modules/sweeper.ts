import { archiveExpiredStories, getMetrics, getStoryStoreState } from '../lib/storyStore.js';
import { clearStoryViews } from '../lib/viewStore.js';
import { config } from '../config.js';

export function runSweeper() {
  setInterval(() => {
    const now = Date.now();
    archiveExpiredStories(now);
    // Viewer lists are kept for VIEWER_LIST_RETENTION after expiry, then dropped.
    for (const s of getStoryStoreState().stories) {
      if (s.status !== 'ACTIVE' && now > s.expiresAt + config.VIEWER_LIST_RETENTION * 1000) clearStoryViews(s.id);
    }
    void getMetrics();
  }, 1500);
}
