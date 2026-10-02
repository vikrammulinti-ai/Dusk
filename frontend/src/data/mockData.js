export const demoStories = [
  { id: 'story-1', owner: 'Maya', audience: 'Public', expiresIn: '23h 41m', ring: 88, status: 'active' },
  { id: 'story-2', owner: 'Theo', audience: 'Followers', expiresIn: '9h 30m', ring: 61, status: 'active' },
  { id: 'story-3', owner: 'Ari', audience: 'Close Friends', expiresIn: '2h 14m', ring: 18, status: 'active' },
  { id: 'story-4', owner: 'Noah', audience: 'Public', expiresIn: 'Expired', ring: 0, status: 'expired' }
];

export const archiveItems = [
  { id: 'arc-1', title: 'Sunset walk', views: 1923, created: 'Yesterday' },
  { id: 'arc-2', title: 'Weekend trip', views: 3411, created: '3 days ago' },
  { id: 'arc-3', title: 'Late night set', views: 867, created: '1 week ago' }
];

export const highlights = [
  { id: 'hl-1', title: 'Summer 2026', count: 6 },
  { id: 'hl-2', title: 'City labs', count: 3 },
  { id: 'hl-3', title: 'Favorite moments', count: 12 }
];

export const consoleData = {
  activeStories: 214,
  archivedStories: 63,
  purgedStories: 8,
  expiryLagP50: '21 ms',
  expiryLagP99: '44 ms',
  queueDepth: 142,
  streamLag: '1.2s',
  orphanCount: 3,
  counterDrift: '0.08%'
};
