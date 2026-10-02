import { getStoryById, getStorySummary } from '../lib/storyStore.js';
import { getViewSummary, recordView } from '../lib/viewStore.js';

export function recordStoryView(storyId: string, viewerId: string) {
  const story = getStoryById(storyId);
  if (!story) {
    return { status: 404, message: 'Story not found' };
  }

  const now = Date.now();
  if (story.status !== 'ACTIVE' || now > story.expiresAt + 60_000) {
    return { status: 410, message: 'Story expired or unavailable' };
  }

  const result = recordView(storyId, viewerId);
  return {
    status: 202,
    accepted: true,
    storyId,
    viewerId,
    summary: result,
    story: getStorySummary(storyId)
  };
}

export function getStoryStats(storyId: string) {
  const story = getStoryById(storyId);
  if (!story) {
    return { status: 404, message: 'Story not found' };
  }

  return {
    status: 200,
    storyId,
    summary: getViewSummary(storyId),
    final: story.status === 'ARCHIVED' || story.status === 'PURGED'
  };
}
