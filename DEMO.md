# Dusk demo script (about 4 minutes)

Start: `docker compose up --build`, open http://localhost:5173. Press **Reset demo** in the Demo tools panel before each run.

1. **Show the problem (20s).** Point at the story tray: each ring drains in real time and turns amber in the last 10%.
2. **Post a story as Owner (30s).** Top right: "Viewing as" = Owner. Click **New story**, pick a scene, choose an audience, leave Save to Archive on, click **Share to story**. It appears at the start of the tray. It fades in 2 minutes in demo mode (24 hours in production).
3. **Audience rules (30s).** Switch to **Follower**. You see Public and Followers stories. The Close Friends story is hidden. That is the access control working.
4. **Open as a follower (20s).** Click a story. Show the "Fades in 1:42" chip and the progress bar. The request returned 200.
5. **Count views accurately (40s).** In Demo tools, Load test: choose the story, keep 200 views, click **Send 200 views**. Read out: 200 plays, 100 unique viewers. Plays and unique viewers are counted separately, and nothing is lost under concurrency.
6. **Show the owner view (20s).** Switch to Owner, open the story, click **Seen by N**. The viewer list updates live.
7. **The expiry moment (40s).** Switch to Follower and open a story, so the viewer is on screen. Click **Expire all active stories now**. Within a second the card "This story is no longer available" appears. The API returns 410.
8. **Owner keeps it (30s).** Switch to Owner, open **Archive**. The story is there, because lazy expiry and the sweeper both archived it. Click **Add to Highlight**, then check the Highlights row.
9. **Chaos (30s).** Click **Flush Redis**, then open a story. Expiry is still exact because the check on every access is the source of truth, not the queue.

Reset for the next judge: **Reset demo (restore stories)**.

Production design (say it if asked): Postgres is the source of truth, Redis holds the expiry index and counters, MinIO/S3 plus a CDN hold media. The prototype keeps data in memory to model the logic.

## Extra things to show
- **Viewed rings:** as Follower, open a story, close it. Its ring turns grey, like "already seen".
- **Close Friends:** switch to Follower and look for the green ring (only close friends see it; the demo has one).
- **Navigate:** inside the viewer, tap the left or right side, or press the arrow keys, to move between stories.
- **Delete:** as Owner, open an active story and press Delete. It disappears for everyone at once.
- **Next expiry:** Demo tools shows a live "Next expiry in" countdown.
