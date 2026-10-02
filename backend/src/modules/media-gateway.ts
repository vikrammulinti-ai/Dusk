import { getStoryById } from '../lib/storyStore.js';

export function generateSignedUrl(storyId: string, viewerId?: string, ownerOverride = false) {
  const story = getStoryById(storyId);
  if (!story) {
    return null;
  }

  const expiresAt = Math.min(story.expiresAt, Date.now() + 15 * 60 * 1000);
  const isOwner = ownerOverride || viewerId === story.ownerId;
  const key = isOwner ? `archive/${story.ownerId}/${story.id}/final.mp4` : story.mediaKeys[0];

  return {
    url: `https://cdn.dusk.demo/${key}?token=${Buffer.from(`${story.id}:${expiresAt}`).toString('base64url')}`,
    expiresAt,
    isOwner
  };
}
