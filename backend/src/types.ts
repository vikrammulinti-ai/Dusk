export type StoryStatus = 'ACTIVE' | 'ARCHIVED' | 'PURGED' | 'DELETED';
export type Audience = 'PUBLIC' | 'FOLLOWERS' | 'CLOSE_FRIENDS';

export interface Story {
  id: string;
  ownerId: string;
  mediaKeys: string[];
  audience: Audience;
  status: StoryStatus;
  createdAt: number;
  expiresAt: number;
  archiveEnabled: boolean;
  deletedAt?: number;
  title?: string;
  scene?: number;
}

export interface ViewSummary {
  totalPlays: number;
  uniqueViewers: number;
  exactViewers: number;
  finalizedAt?: number;
}

export interface ArchiveItem {
  storyId: string;
  ownerId: string;
  coldKey: string;
  thumbKey: string;
  archivedAt: number;
}

export interface Highlight {
  id: string;
  ownerId: string;
  title: string;
  coverKey: string;
  stories: string[];
}
