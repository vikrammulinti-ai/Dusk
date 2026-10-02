# Dusk pitch outline

## Slide 1: Problem
A story must vanish at exactly 24h, and everyone except the owner loses access after expiry.

## Slide 2: Principle
Logical expiry is separate from physical storage handling. The read path blocks access while the sweeper and archive move media.

## Slide 3: Architecture
The hybrid uses PostgreSQL, Redis, MinIO, a sweeper, a reconciler, and a CDN path with signed URLs.

## Slide 4: Demo
Show the 120s TTL lifecycle: active story, load generator, follower 410, owner archive access, highlight copy.

## Slide 5: Trade-offs
Compare immediate deletion, lazy expiry, storage TTL, and the Dusk hybrid.

## Slide 6: Scale and impact
Show the cost model, correctness under concurrency, and privacy-preserving archive semantics.
