/* API integration test: boots the real server against a temp datastore and
   drives the full pool lifecycle over HTTP. Run: node tasks/api-check.js */
const path = require("path");
const fs = require("fs");
const os = require("os");

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "wcpool-"));
process.env.WC_DATA_DIR = TMP;

const { app } = require(path.join(__dirname, "..", "server.js"));
const D = require(path.join(__dirname, "..", "public", "shared", "data.js"));
const E = require(path.join(__dirname, "..", "public", "shared", "engine.js"));
const { GROUPS, GROUP_LETTERS, BRACKET } = D;

let pass = 0, fail = 0, base = "";
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗ FAIL:", m); } };
const sec = m => console.log("\n" + m);

async function api(method, p, body, token) {
  const opt = { method, headers: { connection: "close" } };
  if (body) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
  if (token) opt.headers["x-token"] = token;
  const r = await fetch(base + p, opt);
  let data = null; try { data = await r.json(); } catch (e) {}
  return { status: r.status, data };
}

function fullBracket(thirdsGroups = GROUP_LETTERS.slice(0, 8)) {
  const st = { groups: {}, thirds: [], results: {}, tiebreakerGoals: 3 };
  GROUP_LETTERS.forEach(L => st.groups[L] = GROUPS[L].slice(0, 3));
  st.thirds = thirdsGroups.map(L => GROUPS[L][2]);
  const assign = E.thirdAssignment(st.thirds);
  ["R32", "R16", "QF", "SF", "F"].forEach(r => BRACKET.filter(m => m.round === r).forEach(m => {
    st.results[m.m] = E.resolveRef(m.a, st, assign) || E.resolveRef(m.b, st, assign);
  }));
  return st;
}

(async () => {
  const server = app.listen(0);
  await new Promise(r => server.once("listening", r));
  base = "http://127.0.0.1:" + server.address().port;

  sec("lockAt safety + pool creation");
  const pastPool = await api("POST", "/api/pools", { poolName: "Past Pool", displayName: "X", lockAt: "2000-01-01T00:00:00Z" });
  ok(pastPool.status === 200 && pastPool.data.lockAt !== "2000-01-01T00:00:00.000Z", "past lockAt rejected → falls back to default");

  sec("Create + join");
  const create = await api("POST", "/api/pools", { poolName: "Test Pool", displayName: "Alice" });
  ok(create.status === 200 && create.data.poolId, "pool created");
  const pid = create.data.poolId, code = create.data.inviteCode, aTok = create.data.member.token;
  ok(create.data.member.isAdmin === true, "creator is admin");

  const bob = await api("POST", `/api/pools/${pid}/join`, { inviteCode: code, displayName: "Bob" });
  const carol = await api("POST", `/api/pools/${pid}/join`, { inviteCode: code, displayName: "Carol" });
  ok(bob.status === 200 && carol.status === 200, "Bob & Carol joined");
  const bTok = bob.data.member.token, cTok = carol.data.member.token;
  const badCode = await api("POST", `/api/pools/${pid}/join`, { inviteCode: "WRONG1", displayName: "Mallory" });
  ok(badCode.status === 403, "wrong invite code rejected");
  const dupName = await api("POST", `/api/pools/${pid}/join`, { inviteCode: code, displayName: "alice" });
  ok(dupName.status === 409, "duplicate name rejected");

  sec("thirdPool partial-save safety");
  const partialBracket = fullBracket();
  // Send only 2 picks for group A (no third) but keep a valid thirds pick for group A's team
  const thirdTeamA = GROUPS["A"][2];
  const partialGroups = { ...partialBracket.groups, A: GROUPS["A"].slice(0, 2) };
  const savedPartial = await api("PUT", `/api/pools/${pid}/picks`, { picks: { ...partialBracket, groups: partialGroups, thirds: [thirdTeamA] } }, bTok);
  ok(savedPartial.status === 200, "partial save accepted");
  // Group A has only 2 picks — thirdTeamA should be PRESERVED (not wiped)
  ok(savedPartial.data.picks.thirds.includes(thirdTeamA), "thirds not wiped when group has < 3 picks, got: " + JSON.stringify(savedPartial.data.picks.thirds));

  sec("Save + submit picks");
  const aliceBracket = fullBracket();
  const bobBracket = fullBracket(); // wrong champion
  const fm = E.BY_NUM[104], assign = E.thirdAssignment(bobBracket.thirds);
  const fa = E.resolveRef(fm.a, bobBracket, assign), fb = E.resolveRef(fm.b, bobBracket, assign);
  bobBracket.results[104] = (bobBracket.results[104] === fa) ? fb : fa;
  bobBracket.tiebreakerGoals = 5;
  const carolBracket = { groups: {}, thirds: [], results: {}, tiebreakerGoals: 2 };
  GROUP_LETTERS.forEach(L => carolBracket.groups[L] = GROUPS[L].slice(0, 3)); // groups only

  ok((await api("PUT", `/api/pools/${pid}/picks`, { picks: aliceBracket }, aTok)).status === 200, "Alice saved draft");
  ok((await api("POST", `/api/pools/${pid}/submit`, { picks: aliceBracket }, aTok)).status === 200, "Alice submitted");
  ok((await api("POST", `/api/pools/${pid}/submit`, { picks: bobBracket }, bTok)).status === 200, "Bob submitted");
  ok((await api("PUT", `/api/pools/${pid}/picks`, { picks: carolBracket }, cTok)).status === 200, "Carol saved (not submitted)");

  sec("Locks");
  ok((await api("PUT", `/api/pools/${pid}/picks`, { picks: aliceBracket }, aTok)).status === 423, "submitted member can't edit (423)");
  ok((await api("POST", `/api/pools/${pid}/official`, { official: aliceBracket }, bTok)).status === 403, "non-admin can't set official");
  ok((await api("GET", `/api/pools/${pid}`, null, "garbage")).status === 401, "bad token → 401");

  sec("Privacy before kickoff");
  const beforeBob = await api("GET", `/api/pools/${pid}`, null, bTok);
  ok(beforeBob.data.revealed === false, "not revealed before kickoff");
  ok(beforeBob.data.leaderboard === null, "no leaderboard before kickoff");
  const others = beforeBob.data.members.filter(m => m.id !== beforeBob.data.you.id);
  ok(others.every(m => m.picks === undefined), "other members' picks hidden before kickoff");
  ok(beforeBob.data.you.picks && Object.keys(beforeBob.data.you.picks.groups || {}).length === 12, "you can see your own picks");
  ok(others.some(m => m.submitted === true), "submission status visible (roster) without picks");
  ok(beforeBob.data.official === null, "non-admin can't see official before reveal");
  ok(beforeBob.data.invite === null, "invite code hidden from non-admin members");
  const beforeAlice = await api("GET", `/api/pools/${pid}`, null, aTok);
  ok(beforeAlice.data.invite && beforeAlice.data.invite.code === code, "admin can see invite code");

  sec("Reveal (kickoff) + official results");
  ok((await api("POST", `/api/pools/${pid}/settings`, { lockAt: new Date(Date.now() - 60000).toISOString() }, aTok)).status === 200, "admin moved kickoff to the past");
  const joinLate = await api("POST", `/api/pools/${pid}/join`, { inviteCode: code, displayName: "LateLarry" });
  ok(joinLate.status === 403, "can't join after kickoff");
  ok((await api("PUT", `/api/pools/${pid}/picks`, { picks: carolBracket }, cTok)).status === 423, "picks locked after kickoff (423)");

  const official = fullBracket(); // Alice == official → perfect
  const setOff = await api("POST", `/api/pools/${pid}/official`, { official, finalGoals: 3 }, aTok);
  ok(setOff.status === 200, "admin set official results");

  sec("Leaderboard + scoring after reveal");
  const afterBob = await api("GET", `/api/pools/${pid}`, null, bTok);
  ok(afterBob.data.revealed === true, "revealed after kickoff");
  const lb = afterBob.data.leaderboard;
  ok(Array.isArray(lb) && lb.length === 3, "leaderboard has 3 players");
  ok(afterBob.data.members.every(m => m.picks !== undefined), "everyone's picks visible after kickoff");
  const alice = lb.find(r => r.name === "Alice");
  ok(alice.total === 2080 && alice.rank === 1, "Alice perfect = 2080 and rank 1, got " + alice.total + "/" + alice.rank);
  const bobRow = lb.find(r => r.name === "Bob");
  ok(bobRow.total === 2080 - 480, "Bob (wrong champ) = 1600, got " + bobRow.total);
  ok(lb[0].name === "Alice" && lb[2].name === "Carol", "order: Alice → Bob → Carol");

  sec("Tournament complete → finale + roast");
  ok(afterBob.data.complete === true, "tournament complete (champion decided)");
  const fin = afterBob.data.finale;
  ok(fin && fin.winner.name === "Alice", "finale winner is Alice");
  ok(fin.messages.length === 3, "a cheeky message for every player");
  ok(fin.messages.every(m => typeof m.message === "string" && m.message.length > 10), "messages are non-trivial");
  ok(fin.messages.find(m => m.name === "Alice").message.includes("Alice"), "winner's roast names Alice");

  if (server.closeAllConnections) server.closeAllConnections();
  await new Promise(res => server.close(() => res()));
  console.log("\n" + "=".repeat(48));
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log("=".repeat(48));
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  process.exitCode = fail ? 1 : 0;
  // let the loop drain naturally; force-exit as a safety net if anything lingers
  setTimeout(() => process.exit(process.exitCode), 800).unref();
})().catch(e => { console.error(e); process.exitCode = 1; });
