import { randomUUID } from 'node:crypto';

import {
  canAccessStory,
  createStory,
  deleteStory,
  getArchiveItems,
  getHighlightByUser,
  getStoryById,
  getStoryCountByStatus,
  getStorySummary,
  getStoryStoreState,
  setStoryState,
  listStoriesForTray,
  purgeByOwner,
  addStoryToHighlight,
  setHighlight,
  triggerChaos,
  updateArchiveSetting
} from '../lib/storyStore.js';
import { clearStoryViews } from '../lib/viewStore.js';
import { generateSignedUrl } from './media-gateway.js';

export function createStoryEntry(input: {
  ownerId: string;
  audience?: 'PUBLIC' | 'FOLLOWERS' | 'CLOSE_FRIENDS';
  title?: string;
  scene?: number;
  archiveEnabled?: boolean;
}) {
  const story = createStory({
    ownerId: input.ownerId,
    audience: input.audience ?? 'PUBLIC',
    title: input.title ?? 'Story',
    scene: input.scene,
    archiveEnabled: input.archiveEnabled ?? true
  });

  return {
    status: 201,
    story,
    signedUrl: generateSignedUrl(story.id, input.ownerId, true)
  };
}

export function findStoryById(storyId: string, viewerId?: string, isOwner = false) {
  const story = getStoryById(storyId);
  if (!story) {
    return { status: 404, message: 'Story not found' };
  }

  const access = canAccessStory(story, viewerId ?? story.ownerId, isOwner);
  if (!access.allowed) {
    return {
      status: access.code,
      message: access.code === 410 ? 'Story has faded.' : 'Access denied',
      story: getStorySummary(storyId)
    };
  }

  const signedMedia = generateSignedUrl(storyId, viewerId, isOwner);
  return {
    status: 200,
    story,
    media: signedMedia,
    expiresInMs: Math.max(0, story.expiresAt - Date.now()),
    serverTime: Date.now(),
    access
  };
}

export function getTray(ownerId: string) {
  return {
    status: 200,
    stories: listStoriesForTray(ownerId),
    total: listStoriesForTray(ownerId).length
  };
}

export function removeStory(storyId: string, ownerId: string) {
  const deleted = deleteStory(storyId, ownerId);
  if (!deleted) {
    return { status: 403, message: 'Delete forbidden' };
  }
  return { status: 202, message: 'Deleted' };
}

export function getArchive(ownerId: string) {
  return { status: 200, items: getArchiveItems(ownerId) };
}

export function getHighlights(userId: string) {
  return { status: 200, items: getHighlightByUser(userId) };
}

export function createHighlight(ownerId: string, title: string) {
  const item = setHighlight({ ownerId, title });
  return { status: 201, item };
}

export function addToHighlight(highlightId: string, storyId: string) {
  const item = addStoryToHighlight(highlightId, storyId);
  return item ? { status: 200, item } : { status: 404, message: 'Highlight not found' };
}

export function patchSettings(ownerId: string, enabled: boolean) {
  updateArchiveSetting(ownerId, enabled);
  return { status: 200, archiveEnabled: enabled, ownerId };
}

export function getMetricsPayload() {
  return {
    status: 200,
    summary: getStoryCountByStatus()
  };
}

export function adminChaos(action: string) {
  if (action === 'reset') {
    // Wipe everything and re-seed so the demo can be restarted without restarting Docker.
    for (const story of getStoryStoreState().stories) clearStoryViews(story.id);
    setStoryState({ stories: [], archiveItems: [], highlights: [] });
    seedDemoData();
    return { status: 200, result: { ok: true, action } };
  }
  return { status: 200, result: triggerChaos(action) };
}

export function deleteFromArchive(storyId: string, ownerId?: string) {
  const ok = purgeByOwner(storyId, ownerId);
  return { status: ok ? 200 : 404, message: ok ? 'Story purged from archive' : 'Story not found' };
}

export function seedDemoData() {
  const ownerId = 'owner-1';
  const friendId = 'follower-1';

  const story1 = createStory({ ownerId, title: 'Sunset', scene: 0, audience: 'PUBLIC', archiveEnabled: true, ttlSeconds: 600 });
  const story2 = createStory({ ownerId, title: 'Gym setup', scene: 1, audience: 'FOLLOWERS', archiveEnabled: true, ttlSeconds: 600 });
  const story3 = createStory({ ownerId, title: 'Close friends', scene: 3, audience: 'CLOSE_FRIENDS', archiveEnabled: false, ttlSeconds: 600 });

  return { ownerId, friendId, story1, story2, story3 };
}

export function demoState() {
  return {
    code: 200,
    stories: Array.from(getStoryCountByStatus().ACTIVE ? [1] : [])
  };
}
