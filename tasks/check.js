/* Node verification of the pure tournament logic in data.js + app.js algorithms.
   Run: node tasks/check.js   (from project root) */
const fs = require("fs");
const vm = require("vm");
const path = require("path");

const DATA = require(path.join(__dirname, "..", "public", "shared", "data.js"));
const { TEAMS, GROUPS, GROUP_LETTERS, BRACKET, THIRD_SLOTS } = DATA;
void vm;

let pass = 0, fail = 0;
const ok  = (c, m) => { if(c){ pass++; } else { fail++; console.log("  ✗ FAIL:", m); } };
const sec = (m) => console.log("\n" + m);

const TEAM_GROUP = {};
GROUP_LETTERS.forEach(L => GROUPS[L].forEach(id => TEAM_GROUP[id] = L));

/* ---- data integrity ---- */
sec("Data integrity");
ok(Object.keys(TEAMS).length === 48, "48 teams, got " + Object.keys(TEAMS).length);
ok(Object.values(TEAMS).every(t => t.name && t.iso), "every team has name + iso");
ok(GROUP_LETTERS.length === 12, "12 groups");
const allTeams = [];
GROUP_LETTERS.forEach(L => { ok(GROUPS[L].length === 4, "group " + L + " has 4"); allTeams.push(...GROUPS[L]); });
ok(allTeams.length === 48 && new Set(allTeams).size === 48, "48 distinct teams across groups");
ok(allTeams.every(id => TEAMS[id]), "every group team exists in TEAMS");

/* ---- bracket structure ---- */
sec("Bracket structure");
const byNum = {}; BRACKET.forEach(m => byNum[m.m] = m);
const cnt = r => BRACKET.filter(m => m.round === r).length;
ok(cnt("R32") === 16, "16 R32 matches");
ok(cnt("R16") === 8, "8 R16 matches");
ok(cnt("QF") === 4, "4 QF matches");
ok(cnt("SF") === 2, "2 SF matches");
ok(cnt("F") === 1, "1 Final");
ok(BRACKET.length === 31, "31 matches total");

// R32 participants: 12 winners, 12 runners-up, 8 thirds (slots 1..8)
const r32 = BRACKET.filter(m => m.round === "R32");
const W = [], R = [], T = [];
r32.forEach(m => [m.a, m.b].forEach(ref => {
  if(ref.t === "W") W.push(ref.g);
  else if(ref.t === "R") R.push(ref.g);
  else if(ref.t === "T") T.push(ref.slot);
}));
ok(W.length === 12 && new Set(W).size === 12, "12 distinct group winners in R32");
ok(R.length === 12 && new Set(R).size === 12, "12 distinct runners-up in R32");
ok(T.length === 8 && [...new Set(T)].sort((a,b)=>a-b).join(",") === "1,2,3,4,5,6,7,8", "third slots 1..8");

// tree: each non-R32 match has exactly 2 feeders; every match (not final) has a valid next
const feeders = {}; BRACKET.forEach(m => { if(m.next != null){ (feeders[m.next] = feeders[m.next] || []).push(m.m); } });
["R16","QF","SF","F"].forEach(r => BRACKET.filter(m=>m.round===r).forEach(m =>
  ok((feeders[m.m]||[]).length === 2, "match " + m.m + " (" + r + ") has 2 feeders, got " + (feeders[m.m]||[]).length)));
ok(byNum[104].next === null, "final has no next");
BRACKET.filter(m=>m.m!==104).forEach(m => ok(byNum[m.next], "match " + m.m + " feeds a real match"));

// the two M-refs of each downstream match equal its two feeders
["R16","QF","SF","F"].forEach(r => BRACKET.filter(m=>m.round===r).forEach(m => {
  const refs = [m.a, m.b].filter(x=>x.t==="M").map(x=>x.m).sort((a,b)=>a-b);
  const fds = (feeders[m.m]||[]).slice().sort((a,b)=>a-b);
  ok(JSON.stringify(refs) === JSON.stringify(fds), "match " + m.m + " refs match its feeders");
}));

// side balance: 8 R32 per wing
ok(r32.filter(m=>m.side==="L").length === 8, "8 R32 on left");
ok(r32.filter(m=>m.side==="R").length === 8, "8 R32 on right");

/* ---- third-place constraint matching (Kuhn) ---- */
function thirdAssignment(thirdsIds){
  const thirds = thirdsIds.map(id => ({ id, g: TEAM_GROUP[id] }));
  const slots = THIRD_SLOTS, n = slots.length;
  const slotToThird = new Array(n).fill(-1);
  function tryAssign(ti, seen){
    for(let s=0;s<n;s++){
      if(thirds[ti].g === slots[s].group) continue;
      if(seen[s]) continue; seen[s]=true;
      if(slotToThird[s]===-1 || tryAssign(slotToThird[s], seen)){ slotToThird[s]=ti; return true; }
    }
    return false;
  }
  for(let ti=0;ti<thirds.length;ti++) tryAssign(ti, new Array(n).fill(false));
  const map = {};
  slots.forEach((s,idx)=>{ if(slotToThird[idx]>=0) map[s.slot]=thirds[slotToThird[idx]].id; });
  return map;
}
function thirdOf(L){ return GROUPS[L][2]; }   // 3rd place team of a group (draw order standings)

sec("Third-place matching — every 8-of-12 combination");
const SLOT_GROUPS = THIRD_SLOTS.map(s=>s.group); // {E,I,A,L,D,G,B,K}
function combos(arr, k){
  const res=[]; (function go(start, pick){ if(pick.length===k){res.push(pick.slice());return;}
    for(let i=start;i<arr.length;i++){pick.push(arr[i]); go(i+1,pick); pick.pop();} })(0,[]);
  return res;
}
let combosTested=0, combosBad=0;
for(const combo of combos(GROUP_LETTERS, 8)){
  combosTested++;
  const ids = combo.map(thirdOf);
  const map = thirdAssignment(ids);
  const assigned = Object.values(map);
  // all 8 slots filled, distinct, each respects no-group-rematch
  let good = Object.keys(map).length === 8 && new Set(assigned).size === 8;
  for(const s of THIRD_SLOTS){
    const id = map[s.slot];
    if(!id || TEAM_GROUP[id] === s.group){ good = false; }
  }
  // every selected third placed exactly once
  if(good){ for(const id of ids){ if(assigned.indexOf(id) < 0) good=false; } }
  if(!good) combosBad++;
}
ok(combosTested === 495, "tested all C(12,8)=495 combinations, got " + combosTested);
ok(combosBad === 0, "every combination yields a valid rivalry-free perfect matching (" + combosBad + " bad)");

/* ---- full knockout resolution + cascade prune ---- */
sec("Knockout resolution + cascade prune");
const groups = {}; GROUP_LETTERS.forEach(L => groups[L] = GROUPS[L].slice(0,3)); // 1st,2nd,3rd
const thirds = GROUP_LETTERS.slice(0,8).map(thirdOf); // pick 8 thirds (groups A-H)
const assign = thirdAssignment(thirds);
const results = {};
function resolveRef(ref){
  switch(ref.t){
    case "W": return groups[ref.g][0];
    case "R": return groups[ref.g][1];
    case "T": return assign[ref.slot] || null;
    case "M": return results[ref.m] || null;
  }
}
function prune(){
  let changed=true;
  while(changed){ changed=false;
    for(const m of BRACKET){ const w=results[m.m]; if(w==null) continue;
      const a=resolveRef(m.a), b=resolveRef(m.b);
      if(w!==a && w!==b){ delete results[m.m]; changed=true; } } }
}
// resolve round by round, "a" side always wins
["R32","R16","QF","SF","F"].forEach(r => BRACKET.filter(m=>m.round===r).forEach(m => {
  const a=resolveRef(m.a), b=resolveRef(m.b); results[m.m] = a || b;
}));
ok(Object.keys(results).length === 31, "all 31 matches decided");
ok(!!results[104] && TEAMS[results[104]], "a champion emerges: " + (TEAMS[results[104]]||{}).name);
prune();
ok(Object.keys(results).length === 31, "prune keeps a consistent full bracket intact");

// cascade: flip an R32 winner to the other team, prune should clear its downstream chain
const target = byNum[73];
const other = resolveRef(target.a) === results[73] ? resolveRef(target.b) : resolveRef(target.a);
results[73] = other;                       // now 73's winner changed
prune();
ok(results[90] === undefined || (resolveRef(byNum[90].a)===results[90] || resolveRef(byNum[90].b)===results[90]),
   "after flipping match 73, downstream stays consistent (cascade pruned)");
ok(results[73] === other, "flipped winner retained");

/* ---- summary ---- */
console.log("\n" + "=".repeat(48));
console.log(`  ${pass} passed, ${fail} failed`);
console.log("=".repeat(48));
process.exit(fail ? 1 : 0);
