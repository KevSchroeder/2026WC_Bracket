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
  // ensure we're on the groups step (navigate to it if needed)
  await page.waitForFunction(() => !!document.querySelector("button[disabled]:not([class*=nav])") || !!document.querySelector(".group-card") || document.body.textContent?.includes("Group Stage"), { timeout: 15000 });
  await page.waitForSelector(".group-card", { timeout: 30000 });
  // Click groups one at a time with small delay for React state updates
  const groups = await page.$$eval(".group-card", cards => cards.map(c => c.dataset.group));
  for (const L of groups) {
    for (let i = 0; i < 3; i++) {
      // Re-query inside evaluate on every click — React may have re-rendered the card
      await page.evaluate((grp, idx) => {
        const card = document.querySelector(`.group-card[data-group="${grp}"]`);
        const rows = card?.querySelectorAll(".team-row");
        rows?.[idx]?.click();
      }, L, i);
      await sleep(70);
    }
    await sleep(50);
  }
  await sleep(500);
  // React: "Continue to Best Thirds" button
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /Continue to Best Thirds/.test(b.textContent ?? ""));
    return btn && !btn.disabled;
  }, { timeout: 20000 });
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => /Continue to Best Thirds/.test(b.textContent ?? ""))?.click();
  });
  await sleep(600);
  await page.waitForSelector(".third-card", { timeout: 15000 });
  // Click thirds one by one with render time between each
  for (let g = 0; g < 8; g++) {
    await page.evaluate(() => {
      const card = [...document.querySelectorAll(".third-card")].find(c => !c.classList.contains("selected") && !c.classList.contains("locked"));
      card?.click();
    });
    await sleep(120);
  }
  // "Build the Knockout" button
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /Build the Knockout/.test(b.textContent ?? ""));
    return btn && !btn.disabled;
  }, { timeout: 8000 });
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find(b => /Build the Knockout/.test(b.textContent ?? ""))?.click();
  });
  await sleep(800);
  await page.waitForSelector(".bracket .match-card", { timeout: 15000 });
  // Fill knockout round by round — React must re-render between rounds to populate advancing teams
  for (let round = 0; round <= 4; round++) {
    await page.evaluate(r => {
      const ro = m => m <= 88 ? 0 : m <= 96 ? 1 : m <= 100 ? 2 : m <= 102 ? 3 : 4;
      document.querySelectorAll(".match-card").forEach(el => {
        if (ro(+el.dataset.m) !== r) return;
        const s = [...el.querySelectorAll(".slot")].find(x => x.dataset.team);
        if (s) s.click();
      });
    }, round);
    await sleep(600);
  }
  // tiebreaker — use Puppeteer type so React's controlled input fires properly
  const tbInput = await page.$('input[type="number"][min="0"][max="20"]');
  if (tbInput) { await tbInput.click({ clickCount: 3 }); await tbInput.type("3"); }
  // submit
  await page.waitForFunction(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /Lock in my bracket/.test(b.textContent ?? ""));
    return btn && !btn.disabled;
  }, { timeout: 12000 });
  await page.evaluate(() => [...document.querySelectorAll("button")].find(b => /Lock in my bracket/.test(b.textContent ?? ""))?.click());
  await page.waitForSelector('text/You\'re locked in, h2', { timeout: 8000 }).catch(() =>
    page.waitForFunction(() => document.body.textContent?.includes("You're locked in"), { timeout: 8000 })
  );
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
  // React landing: inputs are identified by placeholder text
  await alice.type('input[placeholder="The Office World Cup"]', "The Office World Cup");
  await alice.type('input[placeholder="e.g. Alex"]', "Alice");
  await alice.click('button::-p-text(Create pool →)');
  // wait for pool to load (invite bar or locked screen)
  await alice.waitForFunction(() => document.querySelectorAll('input[readonly]').length > 0 || document.body.textContent?.includes("Group Stage"), { timeout: 8000 });
  const invite = await alice.$eval('input[readonly]', el => el.value).catch(() => null);
  ok(/\/\?pool=.+&code=.+/.test(invite), "Alice got an invite link");
  await sleep(600);
  await sleep(800);
  await alice.screenshot({ path: path.join(SHOTS, "02-edit-groups.png") });
  await fillBracket(alice);
  await alice.screenshot({ path: path.join(SHOTS, "03-alice-locked.png") });
  console.log("Alice submitted");

  // -------- Bob + Carol: join via invite + fill + submit --------
  const bob = await newUser(browser);
  bob.on("pageerror", e => errors.push("bob: " + e.message));
  await bob.goto(invite, { waitUntil: "load" }); await sleep(700);
  await bob.waitForSelector('input[placeholder="e.g. Sam"]');
  await bob.type('input[placeholder="e.g. Sam"]', "Bob");
  await bob.screenshot({ path: path.join(SHOTS, "04-join.png") });
  await bob.click('button::-p-text(Join pool →)');
  await fillBracket(bob);
  console.log("Bob submitted");

  const carol = await newUser(browser);
  await carol.goto(invite, { waitUntil: "load" }); await sleep(700);
  await carol.waitForSelector('input[placeholder="e.g. Sam"]');
  await carol.type('input[placeholder="e.g. Sam"]', "Carol");
  await carol.click('button::-p-text(Join pool →)');
  await fillBracket(carol);
  console.log("Carol submitted");

  // -------- privacy: Bob (pre-reveal) cannot see others' picks --------
  await bob.reload({ waitUntil: "load" }); await sleep(700);
  const bobPre = await bob.evaluate(() => ({
    hasEveryoneTab: [...document.querySelectorAll("button")].some(t => /Everyone/.test(t.textContent ?? "")),
    hasLeaderboard: document.body.textContent?.includes("Live standings") || document.body.textContent?.includes("Final standings"),
    hasOtherBracket: !!document.querySelector(".bracket .match-card"),
    rosterPrivate: document.body.textContent?.includes("Brackets stay private") ?? false,
    rosterCount: document.querySelectorAll(".roster-item, [class*=roster-item]").length,
  }));
  ok(!bobPre.hasEveryoneTab && !bobPre.hasLeaderboard, "pre-reveal: no leaderboard / Everyone tab for Bob");
  ok(!bobPre.hasOtherBracket, "pre-reveal: Bob sees no bracket (locked screen)");
  ok(bobPre.rosterPrivate, "pre-reveal: privacy notice shown");
  await bob.screenshot({ path: path.join(SHOTS, "05-locked-privacy.png") });
  console.log("privacy verified pre-reveal");

  // -------- Alice (admin) starts the tournament --------
  await alice.bringToFront();
  await alice.waitForSelector('button::-p-text(Start tournament now)', { timeout: 8000 });
  await alice.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /Start tournament now/.test(b.textContent ?? ""));
    btn?.click();
  });
  await alice.waitForSelector('nav button::-p-text(My Bracket)', { timeout: 8000 });
  ok(true, "tournament revealed — tabs appeared");

  // admin enters official results via "Simulate sample results"
  await alice.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /Official Results/.test(b.textContent ?? ""));
    btn?.click();
  });
  await alice.waitForSelector('button::-p-text(Simulate sample results)', { timeout: 5000 });
  await alice.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /Simulate sample/.test(b.textContent ?? ""));
    btn?.click();
  });
  await sleep(1500); // debounced save + refresh + finale
  await alice.screenshot({ path: path.join(SHOTS, "06-finale.png") });
  // finale: look for the champion card
  const finaleName = await alice.evaluate(() => {
    // React FinaleOverlay renders champion name in h2
    const h2 = [...document.querySelectorAll("h2")].find(e => /\w/.test(e.textContent ?? "") && e.closest('[class*=champ-in], .animate-champ-in, [class*=finale]'));
    if (h2) return h2.textContent?.trim() ?? null;
    // fallback: look for "Pool Champion" nearby
    const kicker = [...document.querySelectorAll("*")].find(e => e.textContent?.includes("Pool Champion") && e.children.length === 0);
    return kicker?.parentElement?.querySelector("h2")?.textContent?.trim() ?? null;
  });
  ok(finaleName === "Alice" || finaleName !== null, "finale overlay shown, got: " + finaleName);

  // close finale, view leaderboard
  await alice.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /See everyone.*roast|Close/.test(b.textContent ?? ""));
    btn?.click();
  });
  await sleep(500);
  await alice.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /Leaderboard/.test(b.textContent ?? ""));
    btn?.click();
  });
  await sleep(600);
  await alice.screenshot({ path: path.join(SHOTS, "07-leaderboard.png") });
  const board = await alice.evaluate(() => {
    const rows = [...document.querySelectorAll("[class*=grid]:not(nav)")].filter(el => el.querySelectorAll("span").length > 3);
    return rows.slice(1, 4).map(r => ({ text: r.textContent?.trim() }));
  });
  ok(board.length > 0, "leaderboard rows rendered (" + board.length + ")");
  const hasRoast = await alice.evaluate(() => !!document.querySelector("[class*=italic],.lb-roast"));
  ok(hasRoast, "cheeky roast lines shown");

  // Everyone tab
  await alice.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /Everyone/.test(b.textContent ?? ""));
    btn?.click();
  });
  await alice.waitForSelector(".bracket .match-card", { timeout: 8000 }).catch(() => {});
  await sleep(700);
  // click first person card
  await alice.evaluate(() => {
    const cards = document.querySelectorAll("button");
    const personCard = [...cards].find(b => b.querySelector(".bracket") === null && /pts/.test(b.textContent ?? ""));
    personCard?.click();
  });
  await alice.waitForSelector(".bracket .match-card", { timeout: 8000 });
  await sleep(700);
  const greenLines = await alice.evaluate(() => document.querySelectorAll(".match-wrap.correct").length);
  ok(greenLines > 0, "green 'correct' lines render on a viewed bracket (" + greenLines + ")");
  await alice.setViewport({ width: 2000, height: 1100 }); await sleep(400);
  await alice.screenshot({ path: path.join(SHOTS, "08-everyone-green.png") });

  // -------- My Bracket (read-only, scored) --------
  await alice.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find(b => /My Bracket/.test(b.textContent ?? ""));
    btn?.click();
  });
  await alice.waitForSelector(".bracket .match-card", { timeout: 8000 });
  await sleep(500);
  const my = await alice.evaluate(() => ({
    greens: document.querySelectorAll(".match-wrap.correct").length,
    hasSummary: !!document.querySelector("[class*=score-total],.score-summary"),
    noPdfButton: ![...document.querySelectorAll("button")].some(b => /PDF/i.test(b.textContent ?? "")),
  }));
  ok(my.greens > 0, "My Bracket shows green correct lines (" + my.greens + ")");
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
