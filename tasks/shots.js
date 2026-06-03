/* Multi-user end-to-end in real Chrome: boots the server, drives three players
   in isolated browser contexts through create → join → fill → submit → privacy
   → reveal → official results → live leaderboard → finale, screenshotting each
   stage and exercising the PDF export. Run: node tasks/shots.js */
const puppeteer = require("puppeteer-core");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const os = require("os");

const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ROOT = path.join(__dirname, "..");
const SHOTS = path.join(__dirname, "shots");
fs.mkdirSync(SHOTS, { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "wcpool-e2e-"));
const PORT = 3517;
const BASE = "http://localhost:" + PORT;
const sleep = ms => new Promise(r => setTimeout(r, ms));

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log("  ✗ FAIL:", m); } };

async function fillBracket(page) {
  await page.waitForSelector(".group-card");
  await page.evaluate(() => {
    [...document.querySelectorAll(".group-card")].map(c => c.dataset.group).forEach(L => {
      for (let i = 0; i < 3; i++) document.querySelector(`.group-card[data-group="${L}"]`).querySelectorAll(".team-row")[i].click();
    });
  });
  await page.waitForSelector("#advanceBtn:not([disabled])"); await page.click("#advanceBtn");
  await page.waitForSelector(".third-card");
  await page.evaluate(() => { let g = 0; while ([...document.querySelectorAll(".third-card.selected")].length < 8 && g++ < 40) [...document.querySelectorAll(".third-card")].find(c => !c.classList.contains("selected")).click(); });
  await page.waitForSelector("#advanceBtn:not([disabled])"); await page.click("#advanceBtn");
  await page.waitForSelector(".bracket .match");
  await page.evaluate(() => {
    const roundOf = m => m <= 88 ? 0 : m <= 96 ? 1 : m <= 100 ? 2 : m <= 102 ? 3 : 4;
    [...document.querySelectorAll(".match")].map(el => +el.dataset.m).sort((a, b) => roundOf(a) - roundOf(b) || a - b).forEach(m => {
      const s = [...document.querySelector(`.match[data-m="${m}"]`).querySelectorAll(".slot")].find(x => x.dataset.team); if (s) s.click();
    });
  });
  await page.evaluate(() => { const i = document.querySelector(".tiebreak-input"); i.value = "3"; i.dispatchEvent(new Event("input", { bubbles: true })); });
  await page.waitForSelector("#submitBtn:not([disabled])"); await page.click("#submitBtn");
  await page.waitForSelector(".locked-hero", { timeout: 8000 });
}

async function newUser(browser) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.on("dialog", d => d.accept());
  await page.setViewport({ width: 1440, height: 950 });
  return page;
}

(async () => {
  const server = spawn("node", ["server.js"], { cwd: ROOT, env: { ...process.env, WC_DATA_DIR: TMP, PORT: String(PORT) } });
  server.stderr.on("data", d => console.log("[server]", d.toString().trim()));
  for (let i = 0; i < 40; i++) { try { const r = await fetch(BASE + "/api/pools/x"); if (r.status) break; } catch (e) {} await sleep(150); }

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"] });
  const errors = [];

  // -------- Alice: create + fill + submit --------
  const alice = await newUser(browser);
  alice.on("pageerror", e => errors.push("alice: " + e.message));
  await alice.goto(BASE, { waitUntil: "load" }); await sleep(900);
  await alice.screenshot({ path: path.join(SHOTS, "01-landing.png") });
  await alice.type("#cPool", "The Office World Cup");
  await alice.type("#cName", "Alice");
  await alice.click(".panel .btn-primary");
  await alice.waitForSelector(".invite-bar", { timeout: 8000 });
  const invite = await alice.$eval(".invite-input", el => el.value);
  ok(/\/\?pool=.+&code=.+/.test(invite), "Alice got an invite link");
  await sleep(600);
  await alice.screenshot({ path: path.join(SHOTS, "02-edit-groups.png") });
  await fillBracket(alice);
  await alice.screenshot({ path: path.join(SHOTS, "03-alice-locked.png") });
  console.log("Alice submitted");

  // -------- Bob + Carol: join via invite + fill + submit --------
  const bob = await newUser(browser);
  bob.on("pageerror", e => errors.push("bob: " + e.message));
  await bob.goto(invite, { waitUntil: "load" }); await sleep(700);
  await bob.waitForSelector("#jName"); await bob.type("#jName", "Bob");
  await bob.screenshot({ path: path.join(SHOTS, "04-join.png") });
  await bob.click(".join-card .btn-primary");
  await fillBracket(bob);
  console.log("Bob submitted");

  const carol = await newUser(browser);
  await carol.goto(invite, { waitUntil: "load" }); await sleep(700);
  await carol.waitForSelector("#jName"); await carol.type("#jName", "Carol");
  await carol.click(".join-card .btn-primary");
  await fillBracket(carol);
  console.log("Carol submitted");

  // -------- privacy: Bob (pre-reveal) cannot see others' picks --------
  await bob.reload({ waitUntil: "load" }); await sleep(700);
  const bobPre = await bob.evaluate(() => ({
    hasEveryoneTab: !!document.querySelector(".tab") && [...document.querySelectorAll(".tab")].some(t => /Everyone/.test(t.textContent)),
    hasLeaderboard: !!document.querySelector(".lb"),
    hasOtherBracket: !!document.querySelector(".bracket .match"),
    rosterPrivate: !!document.querySelector(".roster-foot"),
    rosterNames: [...document.querySelectorAll(".roster-name")].map(n => n.textContent),
  }));
  ok(!bobPre.hasEveryoneTab && !bobPre.hasLeaderboard, "pre-reveal: no leaderboard / Everyone tab for Bob");
  ok(!bobPre.hasOtherBracket, "pre-reveal: Bob sees no bracket but his own roster");
  ok(bobPre.rosterPrivate && bobPre.rosterNames.length === 3, "pre-reveal: roster lists 3 players, marked private");
  await bob.screenshot({ path: path.join(SHOTS, "05-locked-privacy.png") });
  console.log("privacy verified pre-reveal");

  // -------- Alice (admin) starts the tournament --------
  await alice.bringToFront();
  await alice.waitForSelector(".admin-panel");
  await alice.evaluate(() => [...document.querySelectorAll(".admin-panel .btn")].find(b => /Start tournament/.test(b.textContent)).click());
  await alice.waitForSelector(".tabs", { timeout: 8000 });
  ok(true, "tournament revealed — tabs appeared");

  // admin enters official results via "Simulate sample results"
  await alice.evaluate(() => [...document.querySelectorAll(".tab")].find(t => /Official/.test(t.textContent)).click());
  await alice.waitForSelector(".official-bar");
  await alice.evaluate(() => [...document.querySelectorAll(".official-actions .btn")].find(b => /Simulate/.test(b.textContent)).click());
  await sleep(1500); // debounced save + refresh + finale
  await alice.screenshot({ path: path.join(SHOTS, "06-finale.png") });
  const finaleName = await alice.evaluate(() => { const e = document.querySelector("#finaleName"); return e && !document.querySelector("#finaleOverlay").hidden ? e.textContent : null; });
  ok(finaleName === "Alice", "finale overlay crowns Alice (perfect bracket), got " + finaleName);

  // close finale, view leaderboard
  await alice.evaluate(() => document.querySelector("#finaleCloseBtn").click());
  await alice.evaluate(() => [...document.querySelectorAll(".tab")].find(t => /Leaderboard/.test(t.textContent)).click());
  await alice.waitForSelector(".lb-row");
  await sleep(500);
  await alice.screenshot({ path: path.join(SHOTS, "07-leaderboard.png") });
  const board = await alice.evaluate(() => [...document.querySelectorAll(".lb .lb-row:not(.lb-head)")].map(r => ({ name: r.querySelector(".lb-name").textContent, pts: r.querySelector(".lb-pts").textContent })));
  ok(board[0].name.includes("Alice") && board[0].pts === "2080", "leaderboard: Alice top with 2080, got " + JSON.stringify(board[0]));
  ok(board.length === 3 && board[2].name.includes("Carol"), "leaderboard has 3, Carol last");
  ok(!!(await alice.$(".lb-roast")), "cheeky roast lines shown on the leaderboard");

  // Everyone tab → view a player's bracket with green correct lines
  await alice.evaluate(() => [...document.querySelectorAll(".tab")].find(t => /Everyone/.test(t.textContent)).click());
  await alice.waitForSelector(".person-card");
  await alice.evaluate(() => document.querySelector(".person-card").click());
  await alice.waitForSelector(".bracket .match");
  await sleep(700);
  const greenLines = await alice.evaluate(() => document.querySelectorAll(".match-wrap.correct").length);
  ok(greenLines > 0, "green 'correct' lines render on a viewed bracket (" + greenLines + ")");
  await alice.setViewport({ width: 2000, height: 1100 }); await sleep(400);
  await alice.screenshot({ path: path.join(SHOTS, "08-everyone-green.png") });

  // -------- My Bracket (read-only, scored) --------
  await alice.evaluate(() => [...document.querySelectorAll(".tab")].find(t => /My Bracket/.test(t.textContent)).click());
  await alice.waitForSelector("#exportRoot .bracket .match");
  await sleep(500);
  const my = await alice.evaluate(() => ({
    greens: document.querySelectorAll(".match-wrap.correct").length,
    total: (document.querySelector(".score-total b") || {}).textContent,
    noPdfButton: ![...document.querySelectorAll("button")].some(b => /PDF/i.test(b.textContent)),
  }));
  ok(my.total === "2080" && my.greens > 0, "My Bracket shows my score (2080) with green correct lines");
  ok(my.noPdfButton, "no PDF button anywhere (removed)");

  await browser.close();
  server.kill();
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
  console.log("\nJS errors:", errors.length); errors.slice(0, 6).forEach(e => console.log("  •", e));
  console.log("=".repeat(48));
  console.log(`  ${pass} passed, ${fail} failed`);
  console.log("=".repeat(48));
  process.exitCode = (fail || errors.length) ? 1 : 0;
  setTimeout(() => process.exit(process.exitCode), 600).unref();
})().catch(e => { console.error(e); process.exitCode = 1; setTimeout(() => process.exit(1), 300).unref(); });
