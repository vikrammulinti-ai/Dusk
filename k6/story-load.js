import http from 'k6/http';
import { sleep } from 'k6';

export const options = {
  vus: 30,
  duration: '30s',
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500']
  }
};

export default function () {
  const storyId = 'story-demo';
  const payload = JSON.stringify({ viewerId: `viewer-${__VU}-${__ITER}` });
  const res = http.post(`http://localhost:4000/stories/${storyId}/view`, payload, {
    headers: { 'Content-Type': 'application/json' }
  });

  if (res.status === 200 || res.status === 202) {
    sleep(0.05);
  }
}
