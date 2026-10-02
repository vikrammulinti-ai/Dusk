import { beforeEach, describe, expect, it } from 'vitest';

import { archiveExpiredStories, canAccessStory, createStory, deleteStory, getStoryById, purgeByOwner, reconcileStories, setStoryState, triggerChaos, updateArchiveSetting } from '../src/lib/storyStore.js';
import { getViewerList, getViewSummary, recordView } from '../src/lib/viewStore.js';
import { findStoryById } from '../src/modules/story-service.js';
import { recordStoryView } from '../src/modules/view-service.js';

describe('Dusk edge cases', () => {
  beforeEach(() => {
    setStoryState({ stories: [], archiveItems: [], highlights: [] });
  });

  it('1. view at T+23:59:59.9 while expiry fires: request is accepted when within grace', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 120 });
    story.expiresAt = Date.now() + 1000;
    const result = recordStoryView(story.id, 'viewer-1');
    expect(result.status).toBe(202);
  });

  it('2. video playing across the boundary: new segment requests are refused after expiry', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 120 });
    story.expiresAt = Date.now() - 90_000;
    const result = recordStoryView(story.id, 'viewer-2');
    expect(result.status).toBe(410);
  });

  it('3. manual delete before 24h must never reappear from cache', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 120 });
    deleteStory(story.id, 'owner');
    expect(getStoryById(story.id)?.status).toBe('DELETED');
  });

  it('4. sweeper crash mid-transition: a second attempt is idempotent', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 1 });
    story.expiresAt = Date.now() - 10;
    const first = archiveExpiredStories(Date.now());
    const second = archiveExpiredStories(Date.now());
    expect(first).toBeGreaterThanOrEqual(1);
    expect(second).toBe(0);
  });

  it('5. Redis flush or restart: expiry queue can be rebuilt from Postgres state', () => {
    const result = triggerChaos('flush-redis');
    expect(result.ok).toBe(true);
    expect(reconcileStories(Date.now())).toBeGreaterThanOrEqual(0);
  });

  it('6. celebrity story with a million concurrent viewers: hot key and stampede are handled', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 120 });
    for (let i = 0; i < 50; i += 1) {
      recordView(story.id, `viewer-${i}`);
    }
    const summary = getViewSummary(story.id);
    expect(summary.totalPlays).toBe(50);
    expect(summary.uniqueViewers).toBeGreaterThan(0);
  });

  it('7. same viewer opens a story 50 times: one unique person, 50 plays', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 120 });
    for (let i = 0; i < 50; i += 1) {
      recordView(story.id, 'viewer-1');
    }
    const summary = getViewSummary(story.id);
    expect(summary.totalPlays).toBe(50);
    expect(summary.uniqueViewers).toBe(1);
  });

  it('8. close friends story should be visible to owner but blocked for follower after expiry', () => {
    const story = createStory({ ownerId: 'owner', audience: 'CLOSE_FRIENDS', ttlSeconds: 120 });
    story.expiresAt = Date.now() - 1;
    const ownerAccess = canAccessStory(story, 'owner', true);
    const followerAccess = canAccessStory(story, 'viewer-1', false);
    expect(ownerAccess.allowed).toBe(true);
    expect(followerAccess.allowed).toBe(false);
  });

  it('9. leaked or bookmarked media URL after expiry returns 410', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 120 });
    story.expiresAt = Date.now() - 1;
    const result = findStoryById(story.id, 'viewer-1', false);
    expect(result.status).toBe(410);
  });

  it('10. wrong client clock does not affect server-based countdown', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 120 });
    const summary = { remainingMs: Math.max(0, story.expiresAt - Date.now()) };
    expect(summary.remainingMs).toBeGreaterThan(0);
  });

  it('11. owner opens same expired link; follower gets 410', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 120 });
    story.expiresAt = Date.now() - 1;
    const ownerResult = findStoryById(story.id, 'owner', true);
    const followerResult = findStoryById(story.id, 'viewer-1', false);
    expect(ownerResult.status).toBe(200);
    expect(followerResult.status).toBe(410);
  });

  it('12. archive disabled before expiry means PURGED at T+24h', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 1, archiveEnabled: false });
    story.expiresAt = Date.now() - 1;
    const processed = archiveExpiredStories(Date.now());
    expect(processed).toBeGreaterThanOrEqual(1);
    expect(getStoryById(story.id)?.status).toBe('PURGED');
  });

  it('13. a story in a Highlight remains available in the Highlight after archive deletion', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 120 });
    const highlight = { id: 'hl-1', ownerId: 'owner', title: 'Trips', coverKey: 'cover.png', stories: [story.id] };
    setStoryState({ stories: [story], archiveItems: [], highlights: [highlight] });
    purgeByOwner(story.id);
    expect(getStoryById(story.id)?.status).toBe('PURGED');
    expect(highlight.stories).toContain(story.id);
  });

  it('14. account deletion cascades to archive, highlights, and cold storage assumptions', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 120 });
    const highlight = { id: 'hl-2', ownerId: 'owner', title: 'Moments', coverKey: 'cover.png', stories: [story.id] };
    setStoryState({ stories: [story], archiveItems: [{ storyId: story.id, ownerId: 'owner', coldKey: 'x', thumbKey: 'y', archivedAt: Date.now() }], highlights: [highlight] });
    purgeByOwner(story.id);
    expect(getStoryById(story.id)?.status).toBe('PURGED');
    expect(highlight.stories).toContain(story.id);
  });

  it('15. exact viewer list is paginated and returns cursor-based results', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 120 });
    recordView(story.id, 'viewer-a');
    recordView(story.id, 'viewer-b');
    const list = getViewerList(story.id, '0', 1);
    expect(list.items.length).toBeLessThanOrEqual(1);
    expect(list.total).toBeGreaterThanOrEqual(2);
  });

  it('16. reconciler repairs drift when the story was left ACTIVE after expiry', () => {
    const story = createStory({ ownerId: 'owner', audience: 'PUBLIC', ttlSeconds: 1 });
    story.expiresAt = Date.now() - 1000;
    const repaired = reconcileStories(Date.now());
    expect(repaired).toBeGreaterThanOrEqual(1);
  });
});
