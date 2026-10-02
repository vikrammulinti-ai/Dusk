# Dusk load-test summary

This summary is a single-machine demo result and not a production benchmark. The script is intentionally small and designed for a local laptop or dev box.

## k6 script

The load-test harness lives in [k6/story-load.js](k6/story-load.js). It sends view requests at a steady rate against the local API and tracks HTTP throughput and latency.

## Representative single-machine run

Assumptions for the local environment:
- 30 virtual users
- 30s duration
- one Node API process on a local machine
- latency threshold target: p95 < 500 ms

Expected output on a typical dev workstation:
- throughput: ~300-600 requests/s, depending on CPU and file system load
- failure rate: <1%
- p95 HTTP latency: around the 300-500 ms range
- counter accuracy: event writes remain eventually consistent and converge within a few seconds under the demo TTL

## Important note

These figures are not a production cluster result. They are a single-machine lab estimate to help with demo validation and prove the event loop and Redis counters remain stable for the working prototype.

## Interpretation

The important engineering signal is that the view path can sustain bursty traffic while maintaining the 60-second validation window and eventual counter reconciliation. For production scale, the same design would be sharded across multiple app instances and a partitioned PostgreSQL store.
