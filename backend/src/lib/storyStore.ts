import { randomUUID } from 'node:crypto';

import { config } from '../config.js';
import { ArchiveItem, Highlight, Story, StoryStatus } from '../types.js';

const stories = new Map<string, Story>();
const archiveItems = new Map<string, ArchiveItem>();
const highlights = new Map<string, Highlight>();
const follows = new Map<string, Set<string>>([['viewer-1', new Set(['owner-1'])], ['follower-1', new Set(['owner-1'])]]);
const closeFriends = new Map<string, Set<string>>([['owner-1', new Set(['follower-1'])]]);
const metrics = {
  activeStories: 0,
  archivedStories: 0,
  purgedStories: 0,
  invalidAccess: 0,
  queueDepth: 0,
  sweeperTransitions: 0,
  reconcilerRuns: 0,
  startedAt: Date.now()
};

export function canView(story: Story, viewerId: string) {
  if (story.ownerId === viewerId || story.audience === 'PUBLIC') return true;
  if (story.audience === 'FOLLOWERS') return follows.get(viewerId)?.has(story.ownerId) ?? false;
  return closeFriends.get(story.ownerId)?.has(viewerId) ?? false;
}

// Single place where an ACTIVE story that has passed expiry is archived or purged.
function finalizeExpiry(story: Story, now: number) {
  if (story.status !== 'ACTIVE' || now < story.expiresAt) return false;
  metrics.activeStories = Math.max(0, metrics.activeStories - 1);
  metrics.queueDepth = Math.max(0, metrics.queueDepth - 1);
  metrics.sweeperTransitions += 1;
  if (story.archiveEnabled) {
    story.status = 'ARCHIVED';
    archiveItems.set(story.id, {
      storyId: story.id,
      ownerId: story.ownerId,
      coldKey: `archive/${story.ownerId}/${story.id}/final.mp4`,
      thumbKey: `archive/${story.ownerId}/${story.id}/thumb.jpg`,
      archivedAt: now
    });
    metrics.archivedStories += 1;
  } else {
    story.status = 'PURGED';
    metrics.purgedStories += 1;
  }
  return true;
}

export function getStoryStoreState() {
  return {
    stories: Array.from(stories.values()),
    archiveItems: Array.from(archiveItems.values()),
    highlights: Array.from(highlights.values()),
    metrics
  };
}

export function setStoryState(snapshot: { stories?: Story[]; archiveItems?: ArchiveItem[]; highlights?: Highlight[] }) {
  if (snapshot.stories) {
    stories.clear();
    for (const story of snapshot.stories) {
      stories.set(story.id, story);
    }
  }
  if (snapshot.archiveItems) {
    archiveItems.clear();
    for (const item of snapshot.archiveItems) {
      archiveItems.set(item.storyId, item);
    }
  }
  if (snapshot.highlights) {
    highlights.clear();
    for (const highlight of snapshot.highlights) {
      highlights.set(highlight.id, highlight);
    }
  }
}

export function createStory(input: {
  ownerId: string;
  audience?: Story['audience'];
  title?: string;
  scene?: number;
  archiveEnabled?: boolean;
  ttlSeconds?: number;
}) {
  const now = Date.now();
  const ttlMs = (input.ttlSeconds ?? config.DUSK_TTL_SECONDS) * 1000;
  const story: Story = {
    id: randomUUID(),
    ownerId: input.ownerId,
    mediaKeys: [`stories/${Math.floor(now / 3600000)}/${randomUUID()}/video.mp4`],
    audience: input.audience ?? 'PUBLIC',
    status: 'ACTIVE',
    createdAt: now,
    expiresAt: now + ttlMs,
    archiveEnabled: input.archiveEnabled ?? true,
    title: input.title ?? 'New story',
    scene: input.scene
  };

  stories.set(story.id, story);
  metrics.activeStories += 1;
  metrics.queueDepth += 1;

  return story;
}

export function listStoriesForTray(viewerId: string) {
  const now = Date.now();
  return Array.from(stories.values()).filter((story) => {
    finalizeExpiry(story, now);
    if (story.ownerId === viewerId) return story.status === 'ACTIVE' || story.status === 'ARCHIVED';
    return story.status === 'ACTIVE' && canView(story, viewerId);
  });
}

export function getStoryById(storyId: string) {
  return stories.get(storyId);
}

export function getArchiveItems(ownerId?: string) {
  const items = Array.from(archiveItems.values());
  return ownerId ? items.filter((item) => item.ownerId === ownerId) : items;
}

export function getHighlightByUser(userId: string) {
  return Array.from(highlights.values()).filter((highlight) => highlight.ownerId === userId);
}

export function setHighlight(input: { ownerId: string; title: string; coverKey?: string }) {
  const highlight: Highlight = {
    id: randomUUID(),
    ownerId: input.ownerId,
    title: input.title,
    coverKey: input.coverKey ?? 'highlights/cover.jpg',
    stories: []
  };
  highlights.set(highlight.id, highlight);
  return highlight;
}

export function addStoryToHighlight(highlightId: string, storyId: string) {
  const highlight = highlights.get(highlightId);
  if (!highlight) return null;
  if (!highlight.stories.includes(storyId)) {
    highlight.stories.push(storyId);
  }
  return highlight;
}

export function updateArchiveSetting(ownerId: string, enabled: boolean) {
  for (const story of stories.values()) {
    if (story.ownerId === ownerId && story.status === 'ACTIVE') {
      story.archiveEnabled = enabled;
    }
  }
  return true;
}

export function deleteStory(storyId: string, ownerId?: string) {
  const story = stories.get(storyId);
  if (!story || (ownerId && story.ownerId !== ownerId)) return false;
  if (story.status === 'ACTIVE') metrics.activeStories = Math.max(0, metrics.activeStories - 1);
  story.status = 'DELETED';
  story.deletedAt = Date.now();
  return true;
}

export function canAccessStory(story: Story, viewerId: string, isOwner?: boolean) {
  finalizeExpiry(story, Date.now());
  const owner = !!isOwner || story.ownerId === viewerId;
  if (story.status === 'PURGED') return { allowed: false, code: owner ? 404 : 410 };
  if (story.status === 'DELETED') return { allowed: false, code: 410 };
  if (story.status === 'ARCHIVED') return owner ? { allowed: true, code: 200 } : { allowed: false, code: 410 };
  if (owner || canView(story, viewerId)) return { allowed: true, code: 200 };
  return { allowed: false, code: 403 };
}

export function archiveExpiredStories(now = Date.now()) {
  let processed = 0;
  for (const story of stories.values()) if (finalizeExpiry(story, now)) processed += 1;
  return processed;
}

export function reconcileStories(now = Date.now()) {
  metrics.reconcilerRuns += 1;
  let repaired = 0;
  for (const story of stories.values()) if (finalizeExpiry(story, now)) repaired += 1;
  return repaired;
}

export function getMetrics() {
  return {
    ...metrics,
    totalStories: stories.size,
    archiveCount: archiveItems.size,
    highlightCount: highlights.size
  };
}

export function purgeByOwner(storyId: string, ownerId?: string) {
  const story = stories.get(storyId);
  if (!story || (ownerId && story.ownerId !== ownerId)) return false;
  story.status = 'PURGED';
  archiveItems.delete(storyId);
  metrics.purgedStories += 1;
  return true;
}

export function triggerChaos(action: string) {
  if (action === 'expire-now') {
    for (const story of stories.values()) {
      if (story.status === 'ACTIVE') {
        story.expiresAt = Date.now() - 1;
      }
    }
    return { ok: true, action };
  }

  if (action === 'flush-redis') {
    metrics.queueDepth = 0;
    return { ok: true, action };
  }

  if (action === 'delay-queue') {
    return { ok: true, action };
  }

  return { ok: false, action, message: 'Unsupported chaos action' };
}

export function getStoryCountByStatus() {
  const bucket: Record<StoryStatus, number> = { ACTIVE: 0, ARCHIVED: 0, PURGED: 0, DELETED: 0 };
  for (const story of stories.values()) {
    bucket[story.status] += 1;
  }
  return bucket;
}

export function getStorySummary(storyId: string) {
  const story = stories.get(storyId);
  if (!story) return null;
  return {
    id: story.id,
    ownerId: story.ownerId,
    audience: story.audience,
    status: story.status,
    expiresAt: story.expiresAt,
    remainingMs: Math.max(0, story.expiresAt - Date.now())
  };
}
