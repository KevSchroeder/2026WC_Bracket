/* ============================================================================
   2026 World Cup Bracket Pool — API server (Express 5)
   - JSON datastore (db.js), shared scoring engine (public/shared/engine.js)
   - Lightweight identity: per-member secret token; pool invite code.
   - Privacy: other members' picks & the leaderboard are withheld until kickoff.
   ============================================================================ */
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { db, save } = require("./db.js");
const DATA = require("./public/shared/data.js");
const ENGINE = require("./public/shared/engine.js");
const { GROUPS, GROUP_LETTERS } = DATA;

const PUBLIC = path.join(__dirname, "public");
const DEFAULT_LOCK = "2026-06-11T16:00:00Z";   // first match of the tournament
const app = express();
app.use(express.json({ limit: "256kb" }));

/* ------------------------------- helpers -------------------------------- */
const rid = (n = 9) => crypto.randomBytes(n).toString("hex");
const code = () => crypto.randomBytes(3).toString("hex").toUpperCase(); // 6-char invite
const nowMs = () => Date.now();
const lockMs = pool => Date.parse(pool.lockAt || DEFAULT_LOCK);
const isRevealed = pool => nowMs() >= lockMs(pool);
const tokenOf = req => req.query.token || req.get("x-token") || (req.body && req.body.token);
const err = (res, c, m) => res.status(c).json({ error: m });

function memberByToken(pool, token) {
  return token && Object.values(pool.members).find(m => m.token === token);
}

function sanitizePicks(p) {
  p = p || {};
  const out = { groups: {}, thirds: [], results: {}, tiebreakerGoals: null };
  GROUP_LETTERS.forEach(L => {
    const arr = Array.isArray(p.groups && p.groups[L])
      ? p.groups[L].filter(id => GROUPS[L].includes(id)) : [];
    out.groups[L] = [...new Set(arr)].slice(0, 3);
  });
  const thirdPool = new Set(GROUP_LETTERS.map(L => out.groups[L][2]).filter(Boolean));
  out.thirds = Array.isArray(p.thirds)
    ? [...new Set(p.thirds.filter(id => thirdPool.has(id)))].slice(0, 8) : [];
  if (p.results && typeof p.results === "object") {
    for (const k of Object.keys(p.results)) {
      const m = +k;
      if (ENGINE.BY_NUM[m] && typeof p.results[k] === "string") out.results[m] = p.results[k];
    }
  }
  if (typeof p.tiebreakerGoals === "number" && isFinite(p.tiebreakerGoals))
    out.tiebreakerGoals = Math.max(0, Math.min(20, Math.round(p.tiebreakerGoals)));
  ENGINE.prune(out);
  return out;
}

function leaderboard(pool) {
  const official = pool.official || {};
  const finalGoals = typeof official.finalGoals === "number" ? official.finalGoals : null;
  const rows = Object.values(pool.members).map(m => {
    const s = ENGINE.scoreBracket(m.picks || {}, official);
    const tg = m.picks && typeof m.picks.tiebreakerGoals === "number" ? m.picks.tiebreakerGoals : null;
    return {
      id: m.id, name: m.name, total: s.total, breakdown: s.breakdown,
      championRight: s.championRight, accuracyPct: Math.round(s.total / ENGINE.POINTS.max * 100),
      tiebreakerGoals: tg, tbDiff: (tg != null && finalGoals != null) ? Math.abs(tg - finalGoals) : null,
      submitted: !!m.submitted, submittedAt: m.submittedAt || null,
    };
  });
  rows.sort((a, b) =>
    b.total - a.total ||
    ((a.tbDiff == null ? 1e9 : a.tbDiff) - (b.tbDiff == null ? 1e9 : b.tbDiff)) ||
    ((a.submittedAt ? Date.parse(a.submittedAt) : 1e15) - (b.submittedAt ? Date.parse(b.submittedAt) : 1e15)) ||
    a.name.localeCompare(b.name));
  rows.forEach((r, i) => r.rank = i + 1);
  return rows;
}

function poolView(pool, me) {
  const revealed = isRevealed(pool);
  const isAdmin = me && me.id === pool.adminMemberId;
  const complete = revealed && ENGINE.isComplete(pool.official);
  const board = revealed ? leaderboard(pool) : null;
  const scoreById = {}; if (board) board.forEach(r => scoreById[r.id] = r);

  const members = Object.values(pool.members).map(m => {
    const base = { id: m.id, name: m.name, submitted: !!m.submitted, isAdmin: m.id === pool.adminMemberId };
    if (revealed) {
      const r = scoreById[m.id] || {};
      return { ...base, picks: m.picks || {}, total: r.total, breakdown: r.breakdown,
               rank: r.rank, championRight: r.championRight, accuracyPct: r.accuracyPct,
               tiebreakerGoals: r.tiebreakerGoals };
    }
    return base; // privacy: no picks before kickoff
  });

  let finale = null;
  if (complete && board.length) {
    const field = { members: board.length };
    finale = {
      winner: board[0],
      finalGoals: pool.official.finalGoals ?? null,
      messages: board.map(r => ({
        id: r.id, name: r.name, rank: r.rank, total: r.total, championRight: r.championRight,
        message: ENGINE.cheekyMessage(
          { name: r.name, rank: r.rank, total: r.total, max: ENGINE.POINTS.max,
            championRight: r.championRight, accuracyPct: r.accuracyPct }, field),
      })),
    };
  }

  return {
    poolId: pool.id, poolName: pool.name, lockAt: pool.lockAt || DEFAULT_LOCK,
    now: new Date().toISOString(), revealed, complete, maxScore: ENGINE.POINTS.max,
    points: ENGINE.POINTS, isAdmin: !!isAdmin,
    invite: { code: pool.inviteCode, path: `/?pool=${pool.id}&code=${pool.inviteCode}` },
    you: me ? { id: me.id, name: me.name, submitted: !!me.submitted, isAdmin: !!isAdmin, picks: me.picks || {} } : null,
    members,
    leaderboard: board,
    official: (isAdmin || revealed) ? (pool.official || {}) : null,
    finale,
  };
}

/* -------------------------------- routes -------------------------------- */
// create a pool (creator becomes admin member)
app.post("/api/pools", (req, res) => {
  const name = (req.body.poolName || "").toString().trim().slice(0, 60) || "World Cup Pool";
  const display = (req.body.displayName || "").toString().trim().slice(0, 40);
  if (!display) return err(res, 400, "Your name is required");
  const id = rid(5), token = rid(16), memberId = rid(5);
  const lockAt = req.body.lockAt && !isNaN(Date.parse(req.body.lockAt)) ? new Date(req.body.lockAt).toISOString() : DEFAULT_LOCK;
  const pool = {
    id, name, inviteCode: code(), createdAt: new Date().toISOString(),
    lockAt, adminMemberId: memberId, official: {}, members: {},
  };
  pool.members[memberId] = { id: memberId, name: display, token, submitted: false, picks: {}, joinedAt: new Date().toISOString() };
  db.pools[id] = pool; save();
  res.json({ poolId: id, inviteCode: pool.inviteCode, lockAt,
    member: { id: memberId, name: display, token, isAdmin: true } });
});

// join via invite code
app.post("/api/pools/:id/join", (req, res) => {
  const pool = db.pools[req.params.id];
  if (!pool) return err(res, 404, "Pool not found");
  const inviteCode = (req.body.inviteCode || "").toString().trim().toUpperCase();
  if (inviteCode !== pool.inviteCode) return err(res, 403, "Wrong invite code");
  if (isRevealed(pool)) return err(res, 403, "This pool has already locked — too late to join");
  const display = (req.body.displayName || "").toString().trim().slice(0, 40);
  if (!display) return err(res, 400, "Your name is required");
  if (Object.values(pool.members).some(m => m.name.toLowerCase() === display.toLowerCase()))
    return err(res, 409, "That name is taken in this pool");
  const token = rid(16), memberId = rid(5);
  pool.members[memberId] = { id: memberId, name: display, token, submitted: false, picks: {}, joinedAt: new Date().toISOString() };
  save();
  res.json({ poolId: pool.id, poolName: pool.name, lockAt: pool.lockAt,
    member: { id: memberId, name: display, token, isAdmin: false } });
});

// fetch the pool state for a member (privacy-gated)
app.get("/api/pools/:id", (req, res) => {
  const pool = db.pools[req.params.id];
  if (!pool) return err(res, 404, "Pool not found");
  const me = memberByToken(pool, tokenOf(req));
  if (!me) return err(res, 401, "Not a member of this pool");
  res.json(poolView(pool, me));
});

// save a draft (before submit & before lock)
app.put("/api/pools/:id/picks", (req, res) => {
  const pool = db.pools[req.params.id];
  if (!pool) return err(res, 404, "Pool not found");
  const me = memberByToken(pool, tokenOf(req));
  if (!me) return err(res, 401, "Not a member");
  if (isRevealed(pool)) return err(res, 423, "Picks are locked — the tournament has started");
  if (me.submitted) return err(res, 423, "You already submitted — picks are locked");
  me.picks = sanitizePicks(req.body.picks);
  save();
  res.json({ ok: true, picks: me.picks });
});

// submit (final lock for this member)
app.post("/api/pools/:id/submit", (req, res) => {
  const pool = db.pools[req.params.id];
  if (!pool) return err(res, 404, "Pool not found");
  const me = memberByToken(pool, tokenOf(req));
  if (!me) return err(res, 401, "Not a member");
  if (isRevealed(pool)) return err(res, 423, "Picks are locked — the tournament has started");
  if (me.submitted) return err(res, 409, "Already submitted");
  if (req.body.picks) me.picks = sanitizePicks(req.body.picks);
  me.submitted = true; me.submittedAt = new Date().toISOString();
  save();
  res.json({ ok: true });
});

// admin: set official results (drives live scoring) and/or final goals
app.post("/api/pools/:id/official", (req, res) => {
  const pool = db.pools[req.params.id];
  if (!pool) return err(res, 404, "Pool not found");
  const me = memberByToken(pool, tokenOf(req));
  if (!me || me.id !== pool.adminMemberId) return err(res, 403, "Admin only");
  const official = sanitizePicks(req.body.official);
  if (typeof req.body.finalGoals === "number" && isFinite(req.body.finalGoals))
    official.finalGoals = Math.max(0, Math.min(30, Math.round(req.body.finalGoals)));
  pool.official = official; save();
  res.json({ ok: true, official: pool.official });
});

// admin: adjust settings (kickoff / lock time)
app.post("/api/pools/:id/settings", (req, res) => {
  const pool = db.pools[req.params.id];
  if (!pool) return err(res, 404, "Pool not found");
  const me = memberByToken(pool, tokenOf(req));
  if (!me || me.id !== pool.adminMemberId) return err(res, 403, "Admin only");
  if (req.body.lockAt !== undefined) {
    if (req.body.lockAt && isNaN(Date.parse(req.body.lockAt))) return err(res, 400, "Bad date");
    pool.lockAt = req.body.lockAt ? new Date(req.body.lockAt).toISOString() : DEFAULT_LOCK;
  }
  save();
  res.json({ ok: true, lockAt: pool.lockAt });
});

/* static SPA */
app.use(express.static(PUBLIC));
app.use((req, res) => res.sendFile(path.join(PUBLIC, "index.html")));

const PORT = process.env.PORT || 3000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`World Cup Bracket Pool running → http://localhost:${PORT}`));
}
module.exports = { app, sanitizePicks, leaderboard, poolView };
