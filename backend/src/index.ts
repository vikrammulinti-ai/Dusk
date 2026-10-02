import Fastify from 'fastify';

import { config } from './config.js';
import { getMetrics, getStoryStoreState, triggerChaos } from './lib/storyStore.js';
import { getViewerList } from './lib/viewStore.js';
import {
  adminChaos,
  addToHighlight,
  createHighlight,
  createStoryEntry,
  deleteFromArchive,
  findStoryById,
  getArchive,
  getHighlights,
  getMetricsPayload,
  getTray,
  patchSettings,
  removeStory,
  seedDemoData
} from './modules/story-service.js';
import { recordStoryView, getStoryStats } from './modules/view-service.js';
import { runReconciler } from './modules/reconciler.js';
import { runSweeper } from './modules/sweeper.js';

const server = Fastify({ logger: false });

// Real HTTP codes: the service layer returns { status } and we mirror it on the response.
server.addHook('preSerialization', async (_req, reply, payload: any) => {
  if (payload && typeof payload.status === 'number' && payload.status >= 200 && payload.status < 600) reply.code(payload.status);
  return payload;
});
server.addHook('onRequest', async (req, reply) => {
  reply.header('access-control-allow-origin', '*').header('access-control-allow-methods', 'GET,POST,PATCH,DELETE,OPTIONS').header('access-control-allow-headers', 'content-type');
  if (req.method === 'OPTIONS') return reply.code(204).send();
});

if (config.APP_MODE === 'demo') {
  seedDemoData();
}

server.get('/health', async () => ({ ok: true, role: config.ROLE, ttlSeconds: config.DUSK_TTL_SECONDS }));

server.post('/stories', async (request, reply) => {
  const body = (request.body ?? {}) as {
    ownerId?: string;
    audience?: 'PUBLIC' | 'FOLLOWERS' | 'CLOSE_FRIENDS';
    title?: string;
    scene?: number;
    archiveEnabled?: boolean;
  };

  const ownerId = body.ownerId;
  if (!ownerId) {
    reply.code(400);
    return { message: 'ownerId is required' };
  }

  return createStoryEntry({
    ownerId,
    audience: body.audience,
    title: body.title,
    scene: body.scene,
    archiveEnabled: body.archiveEnabled
  });
});

server.get('/stories/tray', async (request) => {
  const query = (request.query as { ownerId?: string }) || {};
  return getTray(query.ownerId || 'owner-1');
});

server.get('/stories/:id', async (request) => {
  const params = request.params as { id: string };
  const query = (request.query as { viewerId?: string; ownerId?: string; isOwner?: string }) || {};
  const viewerId = query.viewerId ?? query.ownerId ?? 'viewer-1';
  const isOwner = query.isOwner === 'true' || viewerId === query.ownerId;
  return findStoryById(params.id, viewerId, isOwner);
});

server.delete('/stories/:id', async (request) => {
  const params = request.params as { id: string };
  const query = (request.query as { ownerId?: string }) || {};
  return removeStory(params.id, query.ownerId || 'owner-1');
});

server.post('/stories/:id/view', async (request) => {
  const params = request.params as { id: string };
  const body = (request.body as { viewerId?: string }) || {};
  return recordStoryView(params.id, body.viewerId || 'viewer-1');
});

server.get('/stories/:id/viewers', async (request) => {
  const params = request.params as { id: string };
  const query = (request.query as { cursor?: string; limit?: string }) || {};
  return getViewerList(params.id, query.cursor ?? '0', Number(query.limit ?? 10));
});

server.get('/stories/:id/stats', async (request, reply) => {
  const params = request.params as { id: string };
  const stats = getStoryStats(params.id);
  if ('status' in stats && stats.status === 404) {
    reply.code(404);
  }
  return stats;
});

server.get('/archive', async (request) => {
  const query = (request.query as { ownerId?: string }) || {};
  return getArchive(query.ownerId || 'owner-1');
});

server.get('/archive/:storyId', async (request) => {
  const params = request.params as { storyId: string };
  const story = getStoryStoreState().stories.find((item) => item.id === params.storyId);
  return story ? { status: 200, story } : { status: 404, message: 'Not found' };
});

server.delete('/archive/:storyId', async (request) => {
  const params = request.params as { storyId: string };
  const query = (request.query as { ownerId?: string }) || {};
  return deleteFromArchive(params.storyId, query.ownerId);
});

server.post('/highlights', async (request) => {
  const body = (request.body ?? {}) as { ownerId?: string; title?: string };
  return createHighlight(body.ownerId || 'owner-1', body.title || 'Travel');
});

server.post('/highlights/:id/items', async (request) => {
  const params = request.params as { id: string };
  const body = (request.body ?? {}) as { storyId?: string };
  return addToHighlight(params.id, body.storyId || '');
});

server.get('/highlights/:userId', async (request) => {
  const params = request.params as { userId: string };
  return getHighlights(params.userId);
});

server.patch('/me/settings', async (request) => {
  const body = (request.body ?? {}) as { ownerId?: string; archiveEnabled?: boolean };
  return patchSettings(body.ownerId || 'owner-1', body.archiveEnabled ?? true);
});

server.get('/metrics', async () => {
  return getMetricsPayload();
});

server.post('/admin/chaos/:action', async (request) => {
  const params = request.params as { action: string };
  return adminChaos(params.action);
});

// Workers run inside the API process so they share the same store.
runSweeper();
runReconciler();

server.listen({ host: '0.0.0.0', port: config.PORT }).then(() => {
  console.log(`Dusk API listening on port ${config.PORT}`);
}).catch((error) => {
  console.error('Failed to start server', error);
  process.exit(1);
});
