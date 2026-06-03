/* Scoring engine verification. Run: node tasks/engine-check.js */
const path = require("path");
const D = require(path.join(__dirname, "..", "public", "shared", "data.js"));
const E = require(path.join(__dirname, "..", "public", "shared", "engine.js"));
const { GROUPS, GROUP_LETTERS, BRACKET } = D;

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗ FAIL:", m); } };
const sec = m => console.log("\n" + m);

/* build a complete official bracket: groups in draw order, first 8 groups' thirds
   advance, top slot wins every knockout match. */
function fullBracket(pickThirdsGroups = GROUP_LETTERS.slice(0, 8), winSide = "a") {
  const st = { groups: {}, thirds: [], results: {} };
  GROUP_LETTERS.forEach(L => st.groups[L] = GROUPS[L].slice(0, 3));
  st.thirds = pickThirdsGroups.map(L => GROUPS[L][2]);
  const assign = E.thirdAssignment(st.thirds);
  ["R32", "R16", "QF", "SF", "F"].forEach(r => BRACKET.filter(m => m.round === r).forEach(m => {
    const a = E.resolveRef(m.a, st, assign), b = E.resolveRef(m.b, st, assign);
    st.results[m.m] = (winSide === "a" ? a : b) || a || b;
  }));
  return st;
}

sec("Perfect bracket");
const official = fullBracket();
const perfect = JSON.parse(JSON.stringify(official));
const ps = E.scoreBracket(perfect, official);
ok(ps.total === E.POINTS.max, `perfect = max (${E.POINTS.max}), got ${ps.total}`);
ok(ps.total === 2080, "max is 2080");
ok(ps.breakdown.group === 240, "group 240, got " + ps.breakdown.group);
ok(ps.breakdown.thirds === 80, "thirds 80, got " + ps.breakdown.thirds);
ok(ps.breakdown.R32 === 320 && ps.breakdown.R16 === 320 && ps.breakdown.QF === 320 && ps.breakdown.SF === 320 && ps.breakdown.F === 320, "each knockout round 320");
ok(ps.breakdown.champ === 160, "champion bonus 160");
ok(ps.championRight === true, "championRight true");

sec("Empty / partial official (live scoring)");
ok(E.scoreBracket(perfect, {}).total === 0, "no official decided → 0");
const groupsOnly = { groups: official.groups, thirds: official.thirds, results: {} };
const gs = E.scoreBracket(perfect, groupsOnly);
ok(gs.total === 320 && gs.breakdown.group === 240 && gs.breakdown.thirds === 80, "group stage only = 320");
ok(gs.breakdown.R32 === 0, "no knockout points before knockout official");

sec("Live accumulation is monotonic up to max");
let prev = 0, mono = true;
const rounds = ["groups", "R32", "R16", "QF", "SF", "F"];
rounds.forEach(stage => {
  const off = { groups: official.groups, thirds: official.thirds, results: {} };
  const upto = ["R32", "R16", "QF", "SF", "F"];
  const idx = upto.indexOf(stage);
  if (idx >= 0) upto.slice(0, idx + 1).forEach(r => BRACKET.filter(m => m.round === r).forEach(m => off.results[m.m] = official.results[m.m]));
  const t = E.scoreBracket(perfect, off).total;
  if (t < prev) mono = false; prev = t;
});
ok(mono && prev === 2080, "score rises monotonically to 2080 as rounds resolve");

sec("Wrong champion");
const wrongChamp = JSON.parse(JSON.stringify(official));
// flip the final winner to the other finalist
const finalM = E.BY_NUM[104];
const assign = E.thirdAssignment(wrongChamp.thirds);
const fa = E.resolveRef(finalM.a, wrongChamp, assign), fb = E.resolveRef(finalM.b, wrongChamp, assign);
wrongChamp.results[104] = (official.results[104] === fa) ? fb : fa;
const ws = E.scoreBracket(wrongChamp, official);
ok(ws.breakdown.F === 0 && ws.breakdown.champ === 0, "wrong champion → 0 final + 0 bonus");
ok(ws.breakdown.SF === 320, "but still got both finalists right (SF round 320)");
ok(ws.total === 2080 - 320 - 160, "loses exactly 480 (final 320 + bonus 160)");

sec("Advancement model — set intersection, path-independent");
// official: groups in draw order. picks: SAME groups but a different knockout champion path
// that still has the same team reaching the SF. Use a bracket that wins side "b" sometimes.
const altPicks = fullBracket(GROUP_LETTERS.slice(0, 8), "a");
// corrupt one early knockout pick: change R32 match 74 winner to the OTHER team
const m74 = E.BY_NUM[74]; const a74 = E.resolveRef(m74.a, altPicks, E.thirdAssignment(altPicks.thirds)), b74 = E.resolveRef(m74.b, altPicks, E.thirdAssignment(altPicks.thirds));
altPicks.results[74] = (altPicks.results[74] === a74) ? b74 : a74;
E.prune(altPicks); // cascade downstream
const as = E.scoreBracket(altPicks, official);
ok(as.total < 2080, "a busted R32 pick lowers the score");
ok(as.breakdown.group === 240 && as.breakdown.thirds === 80, "group stage unaffected by a knockout miss");

sec("Green-line correctness map");
const corr = E.matchCorrectness(perfect, official);
ok(BRACKET.every(m => corr[m.m] === true), "perfect bracket → every match line correct");
const corrWrong = E.matchCorrectness(wrongChamp, official);
ok(corrWrong[104] === false, "wrong champion → final line not green");
ok(corrWrong[101] === true, "correct semi-final line stays green");
ok(Object.values(E.matchCorrectness(perfect, {})).every(v => v === false), "no official → no green lines");

sec("Cheeky messages");
const field = { members: 6 };
const ranks = [1, 2, 3, 4, 5, 6];
let allStrings = true, distinct = new Set();
ranks.forEach(r => {
  const msg = E.cheekyMessage({ name: "Player" + r, rank: r, total: 2080 - r * 100, max: 2080, championRight: r === 1, accuracyPct: 90 - r * 5 }, field);
  if (typeof msg !== "string" || msg.length < 10) allStrings = false;
  distinct.add(msg);
});
ok(allStrings, "every rank yields a non-trivial message");
ok(distinct.size === 6, "messages differ across ranks (" + distinct.size + "/6)");
ok(/Player1/.test(E.cheekyMessage({ name: "Player1", rank: 1, total: 2000, max: 2080, championRight: true, accuracyPct: 96 }, field)), "winner message names the player");

console.log("\n" + "=".repeat(48));
console.log(`  ${pass} passed, ${fail} failed`);
console.log("=".repeat(48));
process.exit(fail ? 1 : 0);
