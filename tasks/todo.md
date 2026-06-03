# 2026 World Cup Bracket Pool — Multiplayer Expansion

## New goal
Turn the solo predictor into a shareable pool game:
- Point system: positive points for correct picks that advance, 0 for wrong (ESPN-style).
- Submit → lock picks. Privacy: nobody sees others' picks until the first game kicks off.
- Live leaderboard once the tournament begins; updates as official results are entered.
- Bright-green connector lines for each correct selection.
- Invite link to share a pool among friends.
- End of tournament: elaborate animation for the overall points winner + a cheeky,
  performance-based message for every user, shown to all.
- Research ESPN March Madness logic via an agent (DONE: launched).

## Architecture decision
Multi-user + invites + privacy + shared leaderboard require shared server state →
build a small full-stack app (no native deps, runs with `npm start`):
- `server.js` (Express 5) + `db.js` (atomic JSON file store in `data/`).
- `public/shared/{data,engine}.js` — tournament data + pure logic (scoring, resolution,
  cheeky messages) shared by BOTH Node (authoritative) and browser (display).
- `public/{index.html,styles.css,api.js,app.js}` — pool UI on top of the bracket UI.

## Model
- Pool: id, name, inviteCode, adminToken, lockAt (first-game kickoff = reveal time),
  official bracket (admin-entered real results), members{}.
- Member: id, name, secret token, submitted flag, picks {groups, thirds, results}.
- Privacy: server returns others' picks/leaderboard only when now >= lockAt.
- Lock: submit locks a member early; lockAt locks everyone.
- Scoring: server-authoritative via shared engine. Correct = picked winner advances.
- Green lines: outgoing connector of each match where pick === official winner.

## Tasks
- [x] Launch ESPN research agent (background) — returned sourced spec
- [x] Install express
- [x] Restructure into public/ + shared/, add UMD export to data.js
- [x] shared/engine.js — POINTS, resolveBracket, scoreBracket, correctness, cheeky msgs
- [x] db.js — atomic JSON persistence (WC_DATA_DIR env override for tests)
- [x] server.js — REST API: create/join pool, save/submit picks, official, state+leaderboard
- [x] Frontend: landing (create/join), identity, bracket EDIT/VIEW/OFFICIAL modes
- [x] Submit + lock flow; privacy gating
- [x] Leaderboard (live after reveal); green correct lines
- [x] End-of-tournament winner animation + cheeky messages for all
- [x] Incorporate ESPN agent findings into POINTS + tiebreaker
- [x] Tests: engine unit tests, API integration tests, puppeteer multi-user e2e
- [x] Verify; update review

## Review
Turned the solo predictor into a full pool game (Node/Express + JSON store).

ESPN research (agent): per-round 10/20/40/80/160/320, each round = 320 total, max 1920,
advancement scoring, no upset bonus, tiebreaker = predicted championship total points.
Adapted: group advancers 10×24 + thirds 10×8 (=320), knockout 20/40/80/160/320,
champion bonus +160, **max 2080**, tiebreaker = predicted total goals in the Final.

All requirements met & verified:
- Point system (server-authoritative, advancement/set-intersection) ✓
- Submit → lock; global lock at kickoff ✓
- Privacy: server never sends others' picks before kickoff (not just UI hiding) ✓
- Live leaderboard after reveal, updates as official results entered ✓
- Bright-green connector lines for correct picks throughout ✓
- Invite-link sharing + join ✓
- Elaborate winner celebration (confetti finale) + cheeky roast for every player ✓

Verification: 152 unit/integration checks (`npm test`) + 11-assertion real-Chrome
multi-user e2e (`npm run e2e`), 0 JS errors. Screenshots in tasks/shots/.

Bugs found & fixed during verification:
1. `renderEdit()` reset the working picks from the stale server copy on every step
   change → navigating Groups→Thirds wiped picks. Now `working` inits once per load.
2. Continue button / stepper `disabled` states weren't refreshed on change → could get
   stuck. `updateEditChrome` now updates them live.
3. libuv teardown crash in the HTTP test on Windows → close connections + exit via
   exitCode instead of forcing process.exit mid-close.
