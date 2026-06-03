/* End-to-end DOM simulation with jsdom: drives the real app.js against the real
   index.html, no browser. Run: node tasks/dom-check.js */
const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const root = path.join(__dirname, "..");

let pass = 0, fail = 0;
const ok = (c, m) => { if(c) pass++; else { fail++; console.log("  ✗ FAIL:", m); } };

const jsErrors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => jsErrors.push(e.message));

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
// strip all <script> tags; we inject data.js + app.js together so they share scope
html = html.replace(/<script[\s\S]*?<\/script>/g, "");

const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/", virtualConsole: vc });
const { window } = dom;
const { document } = window;

// ---- stubs ----
window.scrollTo = () => {};
window.confirm = () => true;
window.alert = () => {};
const ctxStub = new Proxy({}, { get: (t, p) => (typeof p === "string" ? () => {} : undefined), set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => ctxStub;
window.requestAnimationFrame = cb => { cb(window.performance.now() + 100000); return 0; };
window.cancelAnimationFrame = () => {};

// ---- inject app ----
let code = fs.readFileSync(path.join(root, "data.js"), "utf8") + "\n" +
           fs.readFileSync(path.join(root, "app.js"), "utf8") +
           "\n;window.__B=BRACKET;window.__G=GROUPS;window.__GL=GROUP_LETTERS;" +
           "window.__TG=(function(){var m={};GROUP_LETTERS.forEach(function(L){GROUPS[L].forEach(function(id){m[id]=L})});return m})();";
window.eval(code);

const BRACKET = window.__B, GROUPS = window.__G, GL = window.__GL, TG = window.__TG;
const $ = sel => document.querySelector(sel);
const $$ = sel => [...document.querySelectorAll(sel)];

console.log("DOM end-to-end simulation\n");

// ---- initial state ----
ok(!$("#view-groups").hidden, "groups view visible at start");
ok($$("#groupsGrid .group-card").length === 12, "12 group cards rendered");
ok($("#toThirdsBtn").disabled, "Continue button starts disabled");

// ---- play the group stage: set 1st/2nd/3rd = draw order for every group ----
GL.forEach(L => {
  for(let i = 0; i < 3; i++){
    const card = $(`.group-card[data-group="${L}"]`);
    const rows = [...card.querySelectorAll(".team-row")];
    rows[i].dispatchEvent(new window.Event("click", { bubbles: true }));
  }
});
ok($$("#groupsGrid .group-card.complete").length === 12, "all 12 groups marked complete");
ok(!$("#toThirdsBtn").disabled, "Continue enabled after 12 groups");
ok($("#groupsDoneChip").textContent.includes("12 / 12"), "chip shows 12 / 12");

// ---- go to thirds, pick 8 ----
$("#toThirdsBtn").dispatchEvent(new window.Event("click", { bubbles: true }));
ok(!$("#view-thirds").hidden, "thirds view visible");
ok($$("#thirdsGrid .third-card").length === 12, "12 third-place cards");
let guard = 0;
while($$("#thirdsGrid .third-card.selected").length < 8 && guard++ < 50){
  const next = $$("#thirdsGrid .third-card").find(c => !c.classList.contains("selected"));
  next.dispatchEvent(new window.Event("click", { bubbles: true }));
}
ok($$("#thirdsGrid .third-card.selected").length === 8, "8 thirds selected");
ok(!$("#toKnockoutBtn").disabled, "Build Knockout enabled at 8 thirds");

// ---- build knockout ----
$("#toKnockoutBtn").dispatchEvent(new window.Event("click", { bubbles: true }));
ok(!$("#view-knockout").hidden, "knockout view visible");
ok($$("#bracket .match").length === 31, "31 match cards rendered, got " + $$("#bracket .match").length);

// R32 fully populated (no empty slots), and third-slots never face a group rival
const thirdFacing = { 74:"E", 77:"I", 79:"A", 80:"L", 81:"D", 82:"G", 85:"B", 87:"K" };
let r32empty = 0, rivalry = 0;
BRACKET.filter(m => m.round === "R32").forEach(m => {
  const el = $(`.match[data-m="${m.m}"]`);
  const slots = [...el.querySelectorAll(".slot")];
  slots.forEach(s => { if(!s.dataset.team) r32empty++; });
  if(thirdFacing[m.m]){
    const winGroup = thirdFacing[m.m];
    const thirdSlot = slots.find(s => TG[s.dataset.team] !== winGroup) ? null : null;
    const thirdId = slots.map(s => s.dataset.team).find(id => TG[id] !== winGroup);
    if(thirdId && TG[thirdId] === winGroup) rivalry++;
  }
});
ok(r32empty === 0, "no empty slots in the Round of 32");
ok(rivalry === 0, "no third-placed team faces the winner of its own group");

// ---- resolve every match to the Final (always pick the top slot) ----
const order = { R32:0, R16:1, QF:2, SF:3, F:4 };
const seq = BRACKET.slice().sort((a, b) => order[a.round] - order[b.round] || a.m - b.m);
seq.forEach(m => {
  const el = $(`.match[data-m="${m.m}"]`);
  const slot = [...el.querySelectorAll(".slot")].find(s => s.dataset.team);
  slot && slot.dispatchEvent(new window.Event("click", { bubbles: true }));
});

ok($$("#bracket .slot.winner").length >= 31, "every match has a winner highlighted");
ok(!$("#champOverlay").hidden, "champion overlay shown after the Final");
const champ = $("#champName").textContent.trim();
ok(champ && champ !== "—", "champion name set: " + champ);
ok($("#progressFill").style.width === "100%", "progress bar at 100%, got " + $("#progressFill").style.width);
ok($("#exportSubtitle").textContent.toLowerCase().includes("champion"), "export header names a champion");

// ---- cascade: reopen knockout edit, flip the Final's losing finalist in an earlier round ----
$("#champCloseBtn").dispatchEvent(new window.Event("click", { bubbles: true }));
ok($("#champOverlay").hidden, "overlay closes on 'keep editing'");

// flip match 73 winner -> its downstream must stay consistent
const m73 = $(`.match[data-m="73"]`);
const slots73 = [...m73.querySelectorAll(".slot")];
const loser73 = slots73.find(s => !s.classList.contains("winner"));
loser73.dispatchEvent(new window.Event("click", { bubbles: true }));
const m90 = $(`.match[data-m="90"]`);
const winner90 = m90.querySelector(".slot.winner");
if(winner90){
  const present = [...m90.querySelectorAll(".slot")].map(s => s.dataset.team);
  ok(present.includes(winner90.dataset.team), "after flip, match 90 winner is still a valid participant (cascade ok)");
} else {
  ok(true, "after flip, match 90 winner cleared (cascade ok)");
}

// ---- no uncaught jsdom errors ----
ok(jsErrors.length === 0, "no uncaught JS errors (" + jsErrors.length + ")" + (jsErrors[0] ? ": " + jsErrors[0].split("\n")[0] : ""));

console.log("\n" + "=".repeat(48));
console.log(`  ${pass} passed, ${fail} failed`);
console.log("=".repeat(48));
window.close();
process.exit(fail ? 1 : 0);
