/* ============================================================================
   Pure tournament logic — shared by the server (authoritative scoring) and the
   browser (display). No DOM, no I/O. Loadable in Node and the browser.

   Scoring follows ESPN Tournament Challenge's "equal total per round" design,
   adapted to the 48-team World Cup (advancement model, set-intersection):
     group advancers 10 ea (x24=320 with best-thirds) · best-third 10 ea (x8)
     R32 20 · R16 40 · QF 80 · SF 160 · Final 320 (each round totals 320)
     champion bonus +160 · max 2080 · tiebreaker = predicted total goals in Final
   ============================================================================ */
(function (root) {
"use strict";
const D = (typeof module !== "undefined" && module.exports) ? require("./data.js") : root;
const { GROUPS, GROUP_LETTERS, BRACKET, THIRD_SLOTS, THIRD_COMBO_HDR, THIRD_COMBINATIONS } = D;

const TEAM_GROUP = {};
GROUP_LETTERS.forEach(L => GROUPS[L].forEach(id => TEAM_GROUP[id] = L));
const BY_NUM = {}; BRACKET.forEach(m => BY_NUM[m.m] = m);
const matchesOf = r => BRACKET.filter(m => m.round === r).map(m => m.m);

const POINTS = {
  groupAdvancer: 10,   // per correct top-2 advancer (unordered set per group)
  bestThird: 10,       // per correct best-third qualifier
  knockout: { R32: 20, R16: 40, QF: 80, SF: 160, F: 320 },
  championBonus: 160,
  max: 2080,
};

/* ---- third-place slot assignment -----------------------------------------
   When all 8 best-third groups are known, follow the OFFICIAL FIFA Annex C
   table (data.js) that fixes which group winner faces which third-place team.
   While the user is still picking (<8 thirds), fall back to a stable bipartite
   preview so the bracket stays legible mid-edit. */
function thirdAssignment(thirdsIds) {
  const groups = thirdsIds.map(id => TEAM_GROUP[id]);
  const distinct = [...new Set(groups)];
  if (distinct.length === 8 && THIRD_COMBINATIONS) {
    const key = distinct.slice().sort().join("");
    const combo = THIRD_COMBINATIONS[key];
    if (combo) {
      const map = {};
      THIRD_SLOTS.forEach(s => {
        const thirdGroup = combo[THIRD_COMBO_HDR.indexOf(s.group)];
        const id = thirdsIds.find(t => TEAM_GROUP[t] === thirdGroup);
        if (id) map[s.slot] = id;
      });
      return map;
    }
  }
  return partialThirdAssignment(thirdsIds);
}

/* fallback for an incomplete set of thirds (Kuhn's bipartite matching, with the
   real-world constraint that a third can't face the winner of its own group) */
function partialThirdAssignment(thirdsIds) {
  const thirds = thirdsIds.map(id => ({ id, g: TEAM_GROUP[id] }));
  const slots = THIRD_SLOTS, n = slots.length;
  const slotToThird = new Array(n).fill(-1);
  function go(ti, seen) {
    for (let s = 0; s < n; s++) {
      if (thirds[ti].g === slots[s].group || seen[s]) continue;
      seen[s] = true;
      if (slotToThird[s] === -1 || go(slotToThird[s], seen)) { slotToThird[s] = ti; return true; }
    }
    return false;
  }
  for (let ti = 0; ti < thirds.length; ti++) go(ti, new Array(n).fill(false));
  const map = {};
  slots.forEach((s, i) => { if (slotToThird[i] >= 0) map[s.slot] = thirds[slotToThird[i]].id; });
  return map;
}

/* ---- resolve a bracket slot reference to a concrete team id --------------- */
function resolveRef(ref, state, assign) {
  const g = state.groups || {}, res = state.results || {};
  switch (ref.t) {
    case "W": return (g[ref.g] && g[ref.g][0]) || null;
    case "R": return (g[ref.g] && g[ref.g][1]) || null;
    case "T": return assign[ref.slot] || null;
    case "M": return res[ref.m] || null;
  }
  return null;
}

/* remove knockout winners that are no longer one of a match's participants
   (cascade when an earlier pick changes). mutates state.results. */
function prune(state) {
  const assign = thirdAssignment(state.thirds || []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const m of BRACKET) {
      const w = state.results && state.results[m.m];
      if (w == null) continue;
      const a = resolveRef(m.a, state, assign), b = resolveRef(m.b, state, assign);
      if (w !== a && w !== b) { delete state.results[m.m]; changed = true; }
    }
  }
  return state;
}

/* ---- sets of teams that REACH each stage in a bracket state --------------- */
function winnersOf(round, res) {
  const s = new Set();
  matchesOf(round).forEach(m => { if (res[m]) s.add(res[m]); });
  return s;
}
function reachSets(state) {
  const res = state.results || {};
  return {
    reachedR16: winnersOf("R32", res),  // won an R32 match
    reachedQF:  winnersOf("R16", res),
    reachedSF:  winnersOf("QF", res),
    reachedF:   winnersOf("SF", res),   // reached the Final
    champ:      res[104] || null,
  };
}
const top2 = (state, L) => (state.groups && state.groups[L] ? [state.groups[L][0], state.groups[L][1]] : []).filter(Boolean);
const interCount = (a, b) => { let n = 0; a.forEach(x => { if (b.has(x)) n++; }); return n; };

/* ---- score a bracket vs the official results (live-safe: only counts what
   official has decided so far) ---------------------------------------------- */
function scoreBracket(picks, official) {
  const bd = { group: 0, thirds: 0, R32: 0, R16: 0, QF: 0, SF: 0, F: 0, champ: 0 };
  GROUP_LETTERS.forEach(L => {
    bd.group += interCount(new Set(top2(picks, L)), new Set(top2(official, L))) * POINTS.groupAdvancer;
  });
  bd.thirds = interCount(new Set(picks.thirds || []), new Set(official.thirds || [])) * POINTS.bestThird;
  const u = reachSets(picks), o = reachSets(official);
  bd.R32 = interCount(u.reachedR16, o.reachedR16) * POINTS.knockout.R32;
  bd.R16 = interCount(u.reachedQF,  o.reachedQF)  * POINTS.knockout.R16;
  bd.QF  = interCount(u.reachedSF,  o.reachedSF)  * POINTS.knockout.QF;
  bd.SF  = interCount(u.reachedF,   o.reachedF)   * POINTS.knockout.SF;
  const champRight = u.champ && o.champ && u.champ === o.champ;
  bd.F = champRight ? POINTS.knockout.F : 0;
  bd.champ = champRight ? POINTS.championBonus : 0;
  const total = bd.group + bd.thirds + bd.R32 + bd.R16 + bd.QF + bd.SF + bd.F + bd.champ;
  return { total, breakdown: bd, championRight: !!champRight };
}

/* ---- per-match correctness for the bright-green connector lines ----------- */
function matchCorrectness(picks, official) {
  const o = reachSets(official), res = picks.results || {};
  const nextSet = { R32: o.reachedR16, R16: o.reachedQF, QF: o.reachedSF, SF: o.reachedF };
  const map = {};
  BRACKET.forEach(m => {
    const w = res[m.m];
    if (!w) { map[m.m] = false; return; }
    map[m.m] = m.round === "F"
      ? !!(official.results && official.results[104] === w)
      : !!(nextSet[m.round] && nextSet[m.round].has(w));
  });
  return map;
}

/* is the whole tournament officially finished? */
const isComplete = official => !!(official && official.results && official.results[104]);

/* count how many of the 31 knockout matches a bracket has decided */
function knockoutDecided(state) {
  return BRACKET.filter(m => state.results && state.results[m.m]).length;
}

/* ---- cheeky end-of-tournament one-liners (deterministic per name) --------- */
function hashStr(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function cheekyMessage(stat, field) {
  // stat: { name, rank, total, max, championRight, championName, accuracyPct }
  const n = field.members, name = stat.name, pts = stat.total, acc = stat.accuracyPct;
  const pick = arr => arr[hashStr(name + ":" + stat.rank) % arr.length];
  if (stat.rank === 1) {
    return pick([
      `👑 ${name} runs the world — ${pts} pts and ${stat.championRight ? "a champion pick that actually lifted the trophy" : "ice in their veins all tournament"}. Everyone else was playing for second.`,
      `🏆 Bow down: ${name} topped all ${n} brackets with ${pts}. ${stat.championRight ? "Called the champion and everything." : "Didn't even need the right champion to win."}`,
      `🐐 ${name} just turned ${n - 1} friends into spectators. ${pts} points of pure smugness incoming.`,
    ]);
  }
  if (stat.rank === 2) return pick([
    `🥈 So close, ${name}. ${pts} pts — the eternal "I had the right final, wrong winner" energy.`,
    `🥈 ${name} brought a knife to the final boss fight and finished 2nd. Respectable. Painful.`,
  ]);
  if (stat.rank === 3) return pick([
    `🥉 ${name} sneaks onto the podium with ${pts}. Bronze tastes like "should've trusted my gut".`,
    `🥉 Third place, ${name}. The participation trophy with a little shine on it.`,
  ]);
  if (stat.rank === n) return pick([
    `🪣 Dead last. ${name} mustered ${pts} pts — a bracket so broken it qualifies as modern art.`,
    `🧯 ${name} finished rock bottom (${pts}). The good news: nowhere to go but up next time.`,
    `💀 ${name} brings up the rear with ${pts}. The group chat will not be kind, and frankly that's fair.`,
  ]);
  if (stat.rank <= Math.ceil(n / 2)) return pick([
    `📈 ${name} lands a solid mid-table finish (${pts} pts, ${acc}% of perfect). Quietly competent, loudly forgotten.`,
    `🙂 ${name}: ${pts} points. Not a champion, not a clown — the bracket equivalent of a 1-1 draw.`,
    `${stat.championRight ? `🎯 ${name} nailed the champion but couldn't climb past ${stat.rank}th — ${pts} pts. The supporting cast let you down.` : `😐 ${name} hovered around the middle with ${pts}. Safe. Beige. Fine.`}`,
  ]);
  return pick([
    `📉 ${name} stumbles to ${stat.rank}th (${pts} pts). The early rounds were not your friend.`,
    `🃏 ${name} finished ${stat.rank}th with ${pts}. Bold picks, bolder consequences.`,
    `🫠 ${name}: ${pts} points and a bracket that peaked in the group stage. We've all been there.`,
  ]);
}

const ENGINE = {
  POINTS, TEAM_GROUP, BY_NUM, matchesOf,
  thirdAssignment, resolveRef, prune, reachSets, scoreBracket,
  matchCorrectness, isComplete, knockoutDecided, cheekyMessage,
};
if (typeof module !== "undefined" && module.exports) module.exports = ENGINE;
else Object.assign(root, ENGINE);
})(typeof window !== "undefined" ? window : this);
