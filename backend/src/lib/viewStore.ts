import { ViewSummary } from '../types.js';

const storyViewMap = new Map<string, Set<string>>();
const storyPlayCounters = new Map<string, number>();

export function recordView(storyId: string, viewerId: string) {
  if (!storyViewMap.has(storyId)) {
    storyViewMap.set(storyId, new Set());
  }

  const exactSet = storyViewMap.get(storyId)!;

  exactSet.add(viewerId);
  storyPlayCounters.set(storyId, (storyPlayCounters.get(storyId) ?? 0) + 1);

  return {
    totalPlays: storyPlayCounters.get(storyId) ?? 0,
    uniqueViewers: exactSet.size,
    exactViewerCount: exactSet.size,
    idempotent: true
  };
}

export function getViewSummary(storyId: string): ViewSummary {
  const exactSet = storyViewMap.get(storyId) ?? new Set();

  return {
    totalPlays: storyPlayCounters.get(storyId) ?? 0,
    uniqueViewers: exactSet.size,
    exactViewers: exactSet.size
  };
}

export function getViewerList(storyId: string, cursor = '0', limit = 10) {
  const ids = Array.from(storyViewMap.get(storyId) ?? new Set());
  const start = Number(cursor || 0);
  const page = ids.slice(start, start + limit);
  return {
    items: page,
    nextCursor: start + page.length < ids.length ? String(start + page.length) : null,
    total: ids.length
  };
}

export function clearStoryViews(storyId: string) {
  storyViewMap.delete(storyId);
  storyPlayCounters.delete(storyId);
}
