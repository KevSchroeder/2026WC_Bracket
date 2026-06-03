/* ============================================================================
   2026 World Cup Bracket Pool — front-end orchestration
   Screens: Landing → (Create / Join) → Pool
     pre-lock + editing   : fill bracket, autosave drafts, submit to lock
     pre-lock + submitted : "locked in", countdown, no peeking at others
     revealed             : My Bracket · Leaderboard · Everyone · Official (admin)
     complete             : winner celebration + cheeky roast for all
   ============================================================================ */
"use strict";
const appEl = document.getElementById("app");
const topRight = document.getElementById("topRight");

let POOL_ID = null, ME = null, POOL = null;
let working = null, officialWorking = null;
let editView = "groups", officialView = "groups", revealTab = "mybracket", everyoneView = null;
let saveTimer = null, officialSaveTimer = null, pollTimer = null, countdownTimer = null, finaleShown = false, savingState = "idle";

/* ------------------------------- helpers --------------------------------- */
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  if (props) for (const k in props) {
    const v = props[k];
    if (k === "class") e.className = v;
    else if (k === "html") e.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "disabled" || k === "hidden" || k === "checked") { if (v) e.setAttribute(k, ""); }
    else if (v != null) e.setAttribute(k, v);
  }
  kids.flat().forEach(c => { if (c == null || c === false) return; e.appendChild(typeof c === "object" ? c : document.createTextNode(String(c))); });
  return e;
}
const clone = o => JSON.parse(JSON.stringify(o || {}));
const inviteUrl = () => POOL && POOL.invite ? location.origin + POOL.invite.path : null;
function normPicks(p) { p = clone(p); p.groups = p.groups || {}; GROUP_LETTERS.forEach(L => { if (!Array.isArray(p.groups[L])) p.groups[L] = []; }); p.thirds = Array.isArray(p.thirds) ? p.thirds : []; p.results = p.results || {}; if (typeof p.tiebreakerGoals !== "number") p.tiebreakerGoals = null; return p; }

let toastT = null;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg; el.hidden = false;
  requestAnimationFrame(() => el.classList.add("show"));
  clearTimeout(toastT); toastT = setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.hidden = true, 300); }, 2800);
}
function setProgress(pct) { document.getElementById("progressFill").style.width = Math.max(0, Math.min(100, pct)) + "%"; }
function bracketComplete(p) {
  return BracketUI.allGroupsComplete(p) && (p.thirds || []).length === 8 &&
    knockoutCount(p) === 31 && typeof p.tiebreakerGoals === "number";
}
function knockoutCount(p) { return BRACKET.filter(m => p.results && p.results[m.m]).length; }
async function copy(text) { try { await navigator.clipboard.writeText(text); toast("Invite link copied 📋"); } catch (e) { prompt("Copy your invite link:", text); } }

/* --------------------------------- init ---------------------------------- */
function init() {
  BracketUI.preloadFlags();
  document.getElementById("brandHome").addEventListener("click", goLanding);
  document.getElementById("finaleCloseBtn").addEventListener("click", () => { document.getElementById("finaleOverlay").hidden = true; stopConfetti(); });
  document.getElementById("finaleResultsBtn").addEventListener("click", () => { document.getElementById("finaleOverlay").hidden = true; stopConfetti(); revealTab = "leaderboard"; renderRevealed(); });

  const params = new URLSearchParams(location.search);
  const pidParam = params.get("pool"), codeParam = params.get("code");
  if (pidParam) {
    const id = Identity.get(pidParam);
    if (id) { POOL_ID = pidParam; ME = id; return loadPool(); }
    return showJoin(pidParam, codeParam || "");
  }
  const last = Identity.last();
  if (last && Identity.get(last)) { POOL_ID = last; ME = Identity.get(last); return loadPool(); }
  goLanding();
}

/* ------------------------------- LANDING --------------------------------- */
function goLanding() {
  clearTimeout(saveTimer); clearTimeout(officialSaveTimer); clearInterval(countdownTimer);
  stopPoll(); POOL = null; POOL_ID = null; ME = null; topRight.innerHTML = ""; setProgress(0);
  history.replaceState(null, "", location.pathname);
  const recent = recentPools();
  appEl.innerHTML = "";
  appEl.appendChild(h("section", { class: "landing" },
    h("div", { class: "hero" },
      h("h2", { class: "hero-title" }, "Run the World Cup ", h("span", {}, "bracket pool")),
      h("p", { class: "hero-sub" }, "Pick all 48 teams from the group stage to the Final, invite your friends, and battle up a live leaderboard. Nobody sees each other's picks until the first whistle.")),
    h("div", { class: "landing-grid" },
      // create
      h("div", { class: "panel" },
        h("h3", {}, "Create a pool"),
        h("p", { class: "muted" }, "You'll be the commissioner — share the invite link and enter results as the tournament plays out."),
        field("Pool name", h("input", { id: "cPool", class: "inp", placeholder: "The Office World Cup", maxlength: "60" })),
        field("Your display name", h("input", { id: "cName", class: "inp", placeholder: "e.g. Alex", maxlength: "40" })),
        h("button", { class: "btn btn-primary btn-lg", onclick: doCreate }, "Create pool →")),
      // join
      h("div", { class: "panel" },
        h("h3", {}, "Have an invite?"),
        h("p", { class: "muted" }, "Paste the invite link a friend sent you, pick a name, and you're in."),
        field("Invite link", h("input", { id: "jLink", class: "inp", placeholder: location.origin + "/?pool=…&code=…" })),
        field("Your display name", h("input", { id: "jName", class: "inp", placeholder: "e.g. Sam", maxlength: "40" })),
        h("button", { class: "btn btn-ghost btn-lg", onclick: doJoinFromLink }, "Join pool →"))),
    recent.length ? h("div", { class: "recent" }, h("h4", {}, "Your pools"),
      h("div", { class: "recent-list" }, recent.map(r =>
        h("button", { class: "recent-chip", onclick: () => { POOL_ID = r.id; ME = Identity.get(r.id); loadPool(); } },
          h("b", {}, r.name || "Pool"), h("span", {}, r.you))))) : null));
}
function field(label, input) { return h("label", { class: "field" }, h("span", {}, label), input); }
function recentPools() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith("wc.pool.")) { const id = k.slice(8); const m = Identity.get(id); if (m) out.push({ id, you: m.name, name: m.poolName }); } }
  return out;
}
async function doCreate() {
  const poolName = document.getElementById("cPool").value.trim();
  const displayName = document.getElementById("cName").value.trim();
  if (!displayName) return toast("Enter your display name");
  try {
    const r = await API.createPool({ poolName, displayName });
    const member = { ...r.member, poolName: poolName || "World Cup Pool" };
    Identity.save(r.poolId, member);
    POOL_ID = r.poolId; ME = member;
    await loadPool();
    toast("Pool created — share your invite link!");
  } catch (e) { toast(e.message); }
}
function parseInvite(link) {
  try { const u = new URL(link.trim(), location.origin); return { pool: u.searchParams.get("pool"), code: u.searchParams.get("code") }; }
  catch (e) { return { pool: null, code: null }; }
}
async function doJoinFromLink() {
  const { pool, code } = parseInvite(document.getElementById("jLink").value);
  const name = document.getElementById("jName").value.trim();
  if (!pool || !code) return toast("That doesn't look like a valid invite link");
  if (!name) return toast("Enter your display name");
  await joinPool(pool, code, name);
}
async function joinPool(pool, code, name) {
  try {
    const r = await API.joinPool(pool, { inviteCode: code, displayName: name });
    const member = { ...r.member, poolName: r.poolName };
    Identity.save(pool, member);
    POOL_ID = pool; ME = member;
    await loadPool();
    toast("You're in! Fill out your bracket.");
  } catch (e) { toast(e.message); }
}
function showJoin(pool, code) {
  topRight.innerHTML = ""; setProgress(0);
  appEl.innerHTML = "";
  appEl.appendChild(h("section", { class: "landing" },
    h("div", { class: "panel join-card" },
      h("div", { class: "join-badge" }, "🎟️ You've been invited"),
      h("h3", {}, "Join the World Cup pool"),
      h("p", { class: "muted" }, "Pick a display name to join. Your picks stay hidden from everyone until the tournament kicks off."),
      field("Invite code", h("input", { id: "jCode", class: "inp", value: code, placeholder: "ABC123" })),
      field("Your display name", h("input", { id: "jName", class: "inp", placeholder: "e.g. Sam", maxlength: "40" })),
      h("div", { class: "row-btns" },
        h("button", { class: "btn btn-primary btn-lg", onclick: () => joinPool(pool, document.getElementById("jCode").value.trim().toUpperCase(), document.getElementById("jName").value.trim()) }, "Join pool →"),
        h("button", { class: "btn btn-ghost btn-lg", onclick: goLanding }, "Back")))));
}

/* ----------------------------- LOAD + DISPATCH --------------------------- */
async function loadPool(opts = {}) {
  try { POOL = await API.getPool(POOL_ID, ME.token); }
  catch (e) {
    if (/Not a member|member of this pool|401/i.test(e.message)) { Identity.forget(POOL_ID); return goLanding(); }
    appEl.innerHTML = ""; appEl.appendChild(h("div", { class: "panel error-panel" }, h("h3", {}, "Couldn't load the pool"), h("p", { class: "muted" }, e.message), h("button", { class: "btn btn-ghost", onclick: goLanding }, "Back home")));
    return;
  }
  // keep stored poolName fresh
  if (ME && POOL.poolName && ME.poolName !== POOL.poolName) { ME.poolName = POOL.poolName; Identity.save(POOL_ID, ME); }
  history.replaceState(null, "", location.pathname + `?pool=${POOL_ID}`);
  // Reset per-pool session state (tab, everyone selection, finale flag) on every load.
  // keepWorking: preserve in-memory picks when 423 fires mid-edit so user sees what they had.
  if (!opts.keepWorking) working = normPicks(POOL.you.picks);
  revealTab = "mybracket"; everyoneView = null; finaleShown = false;
  renderTopRight();
  if (!POOL.revealed) { POOL.you.submitted ? renderLocked() : renderEdit(opts); }
  else renderRevealed();
  if (POOL.complete) maybeShowFinale();
  managePolling();
}
function renderTopRight() {
  topRight.innerHTML = "";
  const adminBadge = POOL.isAdmin ? h("span", { class: "mini-badge admin" }, "Commissioner") : null;
  topRight.appendChild(h("div", { class: "pool-chip" },
    h("span", { class: "pool-chip-name" }, POOL.poolName),
    h("span", { class: "pool-chip-meta" }, `${POOL.members.length} player${POOL.members.length > 1 ? "s" : ""}`),
    adminBadge));
  if (inviteUrl()) topRight.appendChild(h("button", { class: "btn btn-ghost btn-sm", onclick: () => copy(inviteUrl()) }, "Invite"));
  topRight.appendChild(h("button", { class: "btn btn-ghost btn-sm", title: "Switch pool / leave", onclick: leave }, "Leave"));
}
function leave() { if (!confirm("Leave this pool on this device? You can rejoin with the invite link.")) return; Identity.forget(POOL_ID); goLanding(); }

/* -------------------------------- EDIT ----------------------------------- */
function renderEdit() {
  if (!working) working = normPicks(POOL.you.picks);
  stopPoll();
  const steps = [["groups", "Group Stage"], ["thirds", "Best Thirds"], ["knockout", "Knockout"]];
  const stepper = h("nav", { class: "stepper" }, steps.map(([k, label], i) =>
    h("button", { class: "step" + (editView === k ? " active" : "") + (stepDone(k) ? " done" : ""), disabled: stepLocked(k), onclick: () => { editView = k; renderEdit(); } },
      h("i", {}, i + 1), h("span", {}, label))));

  const iurl = inviteUrl();
  const inviteBar = iurl ? h("div", { class: "invite-bar" },
    h("span", { class: "invite-ico" }, "🔗"),
    h("div", { class: "invite-text" }, h("b", {}, "Invite your friends"), h("span", { class: "muted" }, "Everyone needs the link to join before kickoff.")),
    h("input", { class: "inp invite-input", readonly: "", value: iurl, onclick: e => e.target.select() }),
    h("button", { class: "btn btn-primary btn-sm", onclick: () => copy(iurl) }, "Copy link")) : null;

  const body = h("div", { class: "edit-body" });
  const foot = h("div", { class: "view-foot" });

  appEl.innerHTML = "";
  appEl.appendChild(h("section", { class: "view pool-view" },
    h("div", { class: "view-head" },
      h("div", {}, h("h2", {}, "Your bracket"), h("p", { class: "muted" }, "Fill every round, set your Final tiebreaker, then submit to lock it in.")),
      h("div", { class: "view-head-meta" }, h("span", { class: "chip", id: "saveChip" }, "Draft"))),
    inviteBar, stepper, body, foot, rosterPanel(), adminPanel()));

  if (editView === "groups") {
    body.appendChild(h("p", { class: "step-hint muted" }, "Tap teams to rank them 1st → 2nd → 3rd in all 12 groups."));
    const grid = h("div", { class: "groups-grid" }); body.appendChild(grid);
    BracketUI.mountGroups(grid, working, { mode: "edit", onChange: onEditChange, toast });
  } else if (editView === "thirds") {
    body.appendChild(h("p", { class: "step-hint muted" }, "8 of the 12 third-placed teams advance. Pick your 8."));
    const grid = h("div", { class: "thirds-grid" }); body.appendChild(grid);
    BracketUI.mountThirds(grid, working, { mode: "edit", onChange: onEditChange, toast });
  } else {
    body.appendChild(h("p", { class: "step-hint muted" }, "Click a team to send it through — Round of 32 to the Final."));
    const wrap = h("div", { class: "bracket-wrap" }); const scroll = h("div", { class: "bracket-scroll" });
    const bk = h("div", { class: "bracket" }); scroll.appendChild(bk); wrap.appendChild(scroll); body.appendChild(wrap);
    BracketUI.mountKnockout(bk, working, { mode: "edit", onChange: onEditChange, toast });
    body.appendChild(tiebreakerRow());
  }

  // footer nav / submit
  if (editView !== "knockout") {
    foot.appendChild(h("button", { id: "advanceBtn", class: "btn btn-primary btn-lg", disabled: !canAdvance(editView), onclick: () => { editView = nextStep(editView); renderEdit(); } },
      editView === "groups" ? "Continue to Best Thirds →" : "Build the Knockout →"));
  } else {
    foot.appendChild(h("button", { class: "btn btn-ghost btn-lg", onclick: () => { editView = "thirds"; renderEdit(); } }, "← Thirds"));
    foot.appendChild(h("button", { class: "btn btn-primary btn-lg", id: "submitBtn", disabled: !bracketComplete(working), onclick: doSubmit }, "Lock in my bracket 🔒"));
  }
  updateEditChrome();
}
function stepDone(k) { return k === "groups" ? BracketUI.allGroupsComplete(working) : k === "thirds" ? (working.thirds || []).length === 8 : knockoutCount(working) === 31; }
function stepLocked(k) { return (k === "thirds" && !BracketUI.allGroupsComplete(working)) || (k === "knockout" && (working.thirds || []).length !== 8); }
function canAdvance(k) { return k === "groups" ? BracketUI.allGroupsComplete(working) : (working.thirds || []).length === 8; }
function nextStep(k) { return k === "groups" ? "thirds" : "knockout"; }
function tiebreakerRow() {
  return h("div", { class: "tiebreak" },
    h("div", { class: "tiebreak-label" }, h("b", {}, "Tiebreaker"), h("span", { class: "muted" }, "Total goals scored by both teams in the Final")),
    h("input", { type: "number", min: "0", max: "20", class: "inp tiebreak-input", value: working.tiebreakerGoals ?? "", placeholder: "e.g. 3",
      oninput: e => { const v = e.target.value === "" ? null : Math.max(0, Math.min(20, parseInt(e.target.value, 10))); working.tiebreakerGoals = isNaN(v) ? null : v; onEditChange(); } }));
}
function onEditChange() { scheduleSave(); updateEditChrome(); }
function updateEditChrome() {
  const done = GROUP_LETTERS.filter(L => BracketUI.groupComplete(working, L)).length + (working.thirds || []).length + knockoutCount(working) + (typeof working.tiebreakerGoals === "number" ? 1 : 0);
  setProgress(done / 52 * 100);
  const sb = document.getElementById("submitBtn"); if (sb) sb.disabled = !bracketComplete(working);
  const adv = document.getElementById("advanceBtn"); if (adv) adv.disabled = !canAdvance(editView);
  document.querySelectorAll(".stepper .step").forEach((b, i) => { b.disabled = stepLocked(["groups", "thirds", "knockout"][i]); b.classList.toggle("done", stepDone(["groups", "thirds", "knockout"][i])); });
  const chip = document.getElementById("saveChip"); if (chip) chip.textContent = savingState === "saving" ? "Saving…" : savingState === "saved" ? "Draft saved ✓" : "Draft";
}
function scheduleSave() {
  savingState = "saving"; updateEditChrome();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try { await API.savePicks(POOL_ID, ME.token, working); savingState = "saved"; }
    catch (e) { savingState = "idle"; if (/locked|started|423/i.test(e.message)) { toast("The tournament just started — picks are locked."); return loadPool({ keepWorking: true }); } toast(e.message); }
    updateEditChrome();
  }, 700);
}
async function doSubmit() {
  if (!bracketComplete(working)) return toast("Finish every round and set your tiebreaker first");
  if (!confirm("Submit and lock your bracket? You won't be able to change it after this.")) return;
  try { await API.submit(POOL_ID, ME.token, working); toast("Locked in! 🔒"); await loadPool(); }
  catch (e) { toast(e.message); if (/locked|started/i.test(e.message)) loadPool(); }
}

/* ------------------------------- LOCKED ---------------------------------- */
function renderLocked() {
  stopPoll();
  const champ = POOL.you.picks.results && POOL.you.picks.results[104];
  appEl.innerHTML = "";
  appEl.appendChild(h("section", { class: "view pool-view" },
    h("div", { class: "locked-hero" },
      h("div", { class: "locked-ico" }, "🔒"),
      h("h2", {}, "You're locked in"),
      h("p", { class: "muted" }, "Your picks are sealed. Nobody — not even the commissioner — can see anyone's bracket until the first match kicks off."),
      h("div", { class: "countdown", id: "countdown" }),
      champ ? h("div", { class: "locked-champ" }, "Your champion pick: ", BracketUI.flag(champ), h("b", {}, BracketUI.team(champ).name)) : null,
      h("div", { class: "row-btns" },
        inviteUrl() ? h("button", { class: "btn btn-ghost", onclick: () => copy(inviteUrl()) }, "Invite more players") : null,
        h("button", { class: "btn btn-primary", onclick: () => { revealTab = "mybracket"; renderMyBracketReadonly(true); } }, "Review my bracket"))),
    rosterPanel(), adminPanel()));
  startCountdown();
}
function startCountdown() {
  clearInterval(countdownTimer);
  const tick = () => {
    const el = document.getElementById("countdown"); if (!el) return clearInterval(countdownTimer);
    const ms = Date.parse(POOL.lockAt) - Date.now();
    if (ms <= 0) { el.textContent = "Kicking off…"; clearInterval(countdownTimer); loadPool(); return; }
    const d = Math.floor(ms / 864e5), hh = Math.floor(ms % 864e5 / 36e5), mm = Math.floor(ms % 36e5 / 6e4), ss = Math.floor(ms % 6e4 / 1e3);
    el.innerHTML = `<span class="cd-label">First match in</span> <b>${d}d ${hh}h ${mm}m ${ss}s</b>`;
  };
  tick(); countdownTimer = setInterval(tick, 1000);
}

/* ------------------------------- ROSTER ---------------------------------- */
function rosterPanel() {
  const submitted = POOL.members.filter(m => m.submitted).length;
  return h("div", { class: "panel roster" },
    h("div", { class: "roster-head" }, h("h3", {}, "Players"), h("span", { class: "chip" }, `${submitted}/${POOL.members.length} locked in`)),
    h("div", { class: "roster-list" }, POOL.members.map(m =>
      h("div", { class: "roster-item" + (m.id === POOL.you.id ? " you" : "") },
        h("span", { class: "avatar", style: avatarStyle(m.name) }, initials(m.name)),
        h("span", { class: "roster-name" }, m.name, m.id === POOL.you.id ? " (you)" : "", m.isAdmin ? h("span", { class: "mini-badge admin" }, "C") : ""),
        h("span", { class: "roster-status " + (m.submitted ? "ok" : "wait") }, m.submitted ? "Locked in ✓" : "Still picking…")))),
    POOL.revealed ? null : h("p", { class: "roster-foot muted" }, "🙈 Brackets stay private until the first whistle."));
}
function initials(n) { return n.trim().split(/\s+/).map(w => w[0]).join("").slice(0, 2).toUpperCase(); }
function avatarStyle(n) { let hsh = 0; for (let i = 0; i < n.length; i++) hsh = n.charCodeAt(i) + ((hsh << 5) - hsh); const hue = Math.abs(hsh) % 360; return `background:linear-gradient(135deg,hsl(${hue} 70% 55%),hsl(${(hue + 40) % 360} 70% 45%))`; }

/* ------------------------- ADMIN (pre-reveal) ---------------------------- */
function adminPanel() {
  if (!POOL.isAdmin || POOL.revealed) return null;
  return h("div", { class: "panel admin-panel" },
    h("h3", {}, "🛠️ Commissioner controls"),
    h("p", { class: "muted" }, "Set when the first match kicks off — every bracket locks and becomes visible to the whole pool at that moment."),
    h("div", { class: "row-btns" },
      h("label", { class: "field inline" }, h("span", {}, "Kickoff"),
        h("input", { type: "datetime-local", class: "inp", id: "lockAtInp", value: toLocalInput(POOL.lockAt) })),
      h("button", { class: "btn btn-ghost btn-sm", onclick: saveLockAt }, "Save time"),
      h("button", { class: "btn btn-primary btn-sm", onclick: startNow }, "Start tournament now →")));
}
function toLocalInput(iso) { const d = new Date(iso); const l = new Date(d.getTime() - d.getTimezoneOffset() * 60000); return l.toISOString().slice(0, 16); }
async function saveLockAt() {
  const v = document.getElementById("lockAtInp").value; if (!v) return;
  try { await API.setSettings(POOL_ID, ME.token, { lockAt: new Date(v).toISOString() }); toast("Kickoff updated"); await loadPool(); }
  catch (e) { toast(e.message); }
}
async function startNow() {
  if (!confirm("Start the tournament now? This locks every bracket and reveals all picks.")) return;
  try { await API.setSettings(POOL_ID, ME.token, { lockAt: new Date(Date.now() - 1000).toISOString() }); toast("Tournament started!"); await loadPool(); }
  catch (e) { toast(e.message); }
}

/* ------------------------------ REVEALED --------------------------------- */
function renderRevealed() {
  setProgress(100);
  const tabs = [["mybracket", "My Bracket"], ["leaderboard", "Leaderboard"], ["everyone", "Everyone"]];
  if (POOL.isAdmin) tabs.push(["official", "Official Results"]);
  appEl.innerHTML = "";
  appEl.appendChild(h("section", { class: "view pool-view" },
    h("nav", { class: "tabs" }, tabs.map(([k, label]) =>
      h("button", { class: "tab" + (revealTab === k ? " active" : ""), onclick: () => { revealTab = k; renderRevealed(); } }, label,
        k === "leaderboard" && POOL.complete ? h("span", { class: "tab-dot" }) : null))),
    h("div", { id: "tabBody", class: "tab-body" })));
  if (revealTab === "mybracket") renderMyBracketReadonly();
  else if (revealTab === "leaderboard") renderLeaderboard();
  else if (revealTab === "everyone") renderEveryone();
  else if (revealTab === "official") renderOfficial();
}

function scoreSummary(member) {
  if (member.total == null) return null;
  const bd = member.breakdown || {};
  const parts = [["Groups", bd.group], ["Thirds", bd.thirds], ["R32", bd.R32], ["R16", bd.R16], ["QF", bd.QF], ["SF", bd.SF], ["Final", bd.F], ["Champ bonus", bd.champ]];
  return h("div", { class: "score-summary" },
    h("div", { class: "score-total" }, h("b", {}, member.total), h("span", { class: "muted" }, `/ ${POOL.maxScore} pts · ${member.accuracyPct}%`)),
    h("div", { class: "score-breakdown" }, parts.map(([k, v]) => h("span", { class: "score-pill" + (v ? " pos" : "") }, `${k} ${v || 0}`))));
}

function bracketExportBlock(picks, who, withExport) {
  const champ = picks.results && picks.results[104];
  const head = h("div", { class: "export-head", id: "exportHead" },
    h("div", { class: "export-title" }, h("span", { class: "export-mark" }, "26"),
      h("div", {}, h("strong", {}, `${who} — World Cup 2026 Bracket`), h("em", {}, champ ? `Champion pick: ${BracketUI.team(champ).name}` : "—"))),
    champ ? h("div", { class: "export-champ" }, h("div", { class: "winner-pill" }, BracketUI.flag(champ), h("b", {}, BracketUI.team(champ).name))) : h("div", {}));
  const scroll = h("div", { class: "bracket-scroll" }); const bk = h("div", { class: "bracket" }); scroll.appendChild(bk);
  const root = h("div", { class: "bracket-wrap", id: "exportRoot" }, head, scroll);
  // mount after in DOM
  setTimeout(() => BracketUI.mountKnockout(bk, normPicks(picks), { mode: "view", official: POOL.official || {} }), 0);
  return root;
}

function renderMyBracketReadonly(fromLocked) {
  const body = document.getElementById("tabBody") || appEl;
  if (fromLocked) { // reached from locked screen — render a standalone view
    appEl.innerHTML = "";
    appEl.appendChild(h("section", { class: "view pool-view" },
      h("div", { class: "view-head" }, h("div", {}, h("h2", {}, "Your bracket")), h("div", {}, h("button", { class: "btn btn-ghost", onclick: () => loadPool() }, "← Back"))),
      h("div", { class: "legend" }, legendGreen()),
      bracketExportBlock(POOL.you.picks, "You", false)));
    return;
  }
  body.innerHTML = "";
  body.appendChild(h("div", { class: "legend" }, legendGreen(), POOL.you.total != null ? null : null));
  const me = POOL.members.find(m => m.id === POOL.you.id) || {};
  const ss = scoreSummary(me); if (ss) body.appendChild(ss);
  body.appendChild(bracketExportBlock(POOL.you.picks, "You", true));
}
function legendGreen() { return h("div", { class: "legend-item" }, h("span", { class: "legend-line" }), "Bright-green lines = picks that came true"); }

function renderLeaderboard() {
  const body = document.getElementById("tabBody");
  body.innerHTML = "";
  const board = POOL.leaderboard || [];
  if (POOL.complete && POOL.finale) {
    const w = POOL.finale.winner;
    body.appendChild(h("div", { class: "champ-banner" },
      h("div", { class: "champ-banner-trophy" }, "🏆"),
      h("div", {}, h("div", { class: "champ-banner-kicker" }, "Pool Champion"),
        h("div", { class: "champ-banner-name" }, w.name), h("div", { class: "muted" }, `${w.total} pts · ${w.accuracyPct}% of a perfect bracket`)),
      h("button", { class: "btn btn-primary btn-sm", onclick: showFinaleOverlay }, "Replay celebration")));
  }
  const table = h("div", { class: "lb" },
    h("div", { class: "lb-row lb-head" }, h("span", { class: "lb-rk" }, "#"), h("span", { class: "lb-name" }, "Player"), h("span", { class: "lb-champ" }, "Champion"), h("span", { class: "lb-acc" }, "Acc"), h("span", { class: "lb-pts" }, "PTS")));
  board.forEach(r => {
    const champId = champPickOf(r.id);
    const msg = POOL.finale && POOL.finale.messages.find(m => m.id === r.id);
    table.appendChild(h("div", { class: "lb-row" + (r.id === POOL.you.id ? " you" : "") + (r.rank === 1 ? " lead" : "") },
      h("span", { class: "lb-rk" }, medal(r.rank)),
      h("span", { class: "lb-name" }, h("span", { class: "avatar sm", style: avatarStyle(r.name) }, initials(r.name)), h("span", {}, r.name, r.id === POOL.you.id ? " (you)" : "")),
      h("span", { class: "lb-champ" }, champId ? h("span", { class: "champ-cell" + (r.championRight ? " right" : "") }, BracketUI.flag(champId), BracketUI.team(champId).code) : "—"),
      h("span", { class: "lb-acc" }, r.accuracyPct + "%"),
      h("span", { class: "lb-pts" }, r.total)));
    if (msg) table.appendChild(h("div", { class: "lb-roast" }, msg.message));
  });
  body.appendChild(table);
  body.appendChild(h("p", { class: "muted lb-foot" }, POOL.complete ? "Final standings." : "Live standings — updates as official results come in."));
}
function champPickOf(memberId) { const m = POOL.members.find(x => x.id === memberId); return m && m.picks && m.picks.results ? m.picks.results[104] : null; }
function medal(rank) { return rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank; }

function renderEveryone() {
  const body = document.getElementById("tabBody");
  body.innerHTML = "";
  body.appendChild(h("p", { class: "muted" }, "Everyone's picks are public now. Tap a player to study their bracket — correct calls light up green."));
  const grid = h("div", { class: "people-grid" });
  (POOL.leaderboard || POOL.members).forEach(r => {
    const champId = champPickOf(r.id);
    grid.appendChild(h("button", { class: "person-card" + (everyoneView === r.id ? " active" : ""), onclick: () => { everyoneView = r.id; renderEveryone(); } },
      h("span", { class: "avatar", style: avatarStyle(r.name) }, initials(r.name)),
      h("div", { class: "person-meta" }, h("b", {}, r.name, r.id === POOL.you.id ? " (you)" : ""),
        h("span", { class: "muted" }, (r.total != null ? r.total + " pts" : "") + (champId ? " · " + BracketUI.team(champId).code : ""))),
      r.rank ? h("span", { class: "person-rank" }, medal(r.rank)) : null));
  });
  body.appendChild(grid);
  if (everyoneView) {
    const m = POOL.members.find(x => x.id === everyoneView);
    if (m && m.picks) {
      body.appendChild(h("div", { class: "legend" }, legendGreen()));
      const ss = scoreSummary(m); if (ss) body.appendChild(ss);
      body.appendChild(bracketExportBlock(m.picks, m.name, false));
    }
  }
}

/* ------------------------------ OFFICIAL (admin) ------------------------- */
function renderOfficial() {
  const body = document.getElementById("tabBody");
  officialWorking = normPicks(POOL.official || {});
  body.innerHTML = "";
  body.appendChild(h("div", { class: "official-bar panel" },
    h("div", {}, h("h3", {}, "Official results"), h("p", { class: "muted" }, "Enter what actually happens. Everyone's score updates live against this master bracket.")),
    h("div", { class: "official-actions" },
      h("button", { class: "btn btn-ghost btn-sm", onclick: simulateOfficial }, "Simulate sample results"),
      h("label", { class: "field inline" }, h("span", {}, "Final total goals"),
        h("input", { type: "number", min: "0", max: "30", class: "inp", id: "finalGoals", value: (POOL.official && POOL.official.finalGoals != null) ? POOL.official.finalGoals : "", oninput: scheduleOfficialSave })))));

  const steps = [["groups", "Groups"], ["thirds", "Thirds"], ["knockout", "Knockout"]];
  body.appendChild(h("nav", { class: "stepper" }, steps.map(([k, label], i) =>
    h("button", { class: "step" + (officialView === k ? " active" : ""), onclick: () => { officialView = k; renderOfficial(); } }, h("i", {}, i + 1), h("span", {}, label)))));

  const container = h("div", { class: "edit-body" }); body.appendChild(container);
  if (officialView === "groups") { const g = h("div", { class: "groups-grid" }); container.appendChild(g); BracketUI.mountGroups(g, officialWorking, { mode: "official", onChange: scheduleOfficialSave, toast }); }
  else if (officialView === "thirds") { const g = h("div", { class: "thirds-grid" }); container.appendChild(g); BracketUI.mountThirds(g, officialWorking, { mode: "official", onChange: scheduleOfficialSave, toast }); }
  else { const w = h("div", { class: "bracket-wrap" }); const s = h("div", { class: "bracket-scroll" }); const bk = h("div", { class: "bracket" }); s.appendChild(bk); w.appendChild(s); container.appendChild(w); BracketUI.mountKnockout(bk, officialWorking, { mode: "official", onChange: scheduleOfficialSave, toast }); }
  body.appendChild(h("div", { class: "official-save", id: "officialSave" }, "Saved automatically"));
}
function scheduleOfficialSave() {
  const el = document.getElementById("officialSave"); if (el) el.textContent = "Saving…";
  clearTimeout(officialSaveTimer);
  officialSaveTimer = setTimeout(async () => {
    const fg = document.getElementById("finalGoals"); const finalGoals = fg && fg.value !== "" ? parseInt(fg.value, 10) : undefined;
    try {
      const r = await API.setOfficial(POOL_ID, ME.token, officialWorking, finalGoals);
      POOL.official = r.official;
      const fresh = await API.getPool(POOL_ID, ME.token);   // refresh live scores/finale
      POOL.leaderboard = fresh.leaderboard; POOL.members = fresh.members; POOL.complete = fresh.complete; POOL.finale = fresh.finale;
      const e = document.getElementById("officialSave"); if (e) e.textContent = "Saved ✓ — scores updated";
      if (POOL.complete) maybeShowFinale();
    } catch (e) { toast(e.message); }
  }, 600);
}
function simulateOfficial() {
  // deterministic plausible tournament: groups in draw order, first 8 groups' thirds advance, top slot wins every match
  officialWorking = { groups: {}, thirds: [], results: {}, tiebreakerGoals: null };
  GROUP_LETTERS.forEach(L => officialWorking.groups[L] = GROUPS[L].slice(0, 3));
  officialWorking.thirds = GROUP_LETTERS.slice(0, 8).map(L => GROUPS[L][2]);
  const assign = thirdAssignment(officialWorking.thirds);
  ["R32", "R16", "QF", "SF", "F"].forEach(r => BRACKET.filter(m => m.round === r).forEach(m => {
    const a = resolveRef(m.a, officialWorking, assign), b = resolveRef(m.b, officialWorking, assign);
    officialWorking.results[m.m] = a || b;
  }));
  const fg = document.getElementById("finalGoals"); if (fg) fg.value = 3;
  scheduleOfficialSave();
  toast("Filled a sample tournament — tweak any match, scores update live");
  setTimeout(() => renderOfficial(), 700);
}

/* ------------------------------- FINALE ---------------------------------- */
function maybeShowFinale() { if (finaleShown || !POOL.finale) return; finaleShown = true; showFinaleOverlay(); }
function showFinaleOverlay() {
  const f = POOL.finale; if (!f) return;
  const w = f.winner;
  document.getElementById("finaleName").textContent = w.name;
  document.getElementById("finaleSub").textContent = `${w.total} points · ${w.accuracyPct}% of a perfect bracket${w.championRight ? " · called the champion 🎯" : ""}`;
  const champId = champPickOf(w.id);
  const av = document.getElementById("finaleAvatar"); av.innerHTML = "";
  av.appendChild(champId ? BracketUI.flag(champId, "xl") : h("span", { class: "avatar xl", style: avatarStyle(w.name) }, initials(w.name)));
  const mine = f.messages.find(m => m.id === POOL.you.id);
  document.getElementById("finaleMsg").textContent = mine ? mine.message : "";
  document.getElementById("finaleOverlay").hidden = false;
  confettiBurst(document.getElementById("confetti"));
}

/* ------------------------------ POLLING ---------------------------------- */
function managePolling() { stopPoll(); if (POOL && POOL.revealed && !POOL.complete) pollTimer = setInterval(refresh, 25000); }
function stopPoll() { clearInterval(pollTimer); pollTimer = null; }
async function refresh() {
  try {
    const prev = revealTab, ev = everyoneView, complete = POOL.complete;
    POOL = await API.getPool(POOL_ID, ME.token);
    if (!POOL.revealed) { await loadPool(); return; }   // await prevents post-loadPool renders
    revealTab = prev; everyoneView = ev;
    if (revealTab === "leaderboard") renderLeaderboard();
    else if (revealTab === "everyone") renderEveryone();
    else if (revealTab === "mybracket") renderMyBracketReadonly();
    renderTopRight();
    if (POOL.complete && !complete) maybeShowFinale();
    if (POOL.complete) stopPoll();
  } catch (e) {
    if (/401|Not a member|member of this pool/i.test(e.message)) { Identity.forget(POOL_ID); goLanding(); }
    // else: transient network error — skip silently, next tick will retry
  }
}

/* ------------------------------ CONFETTI --------------------------------- */
let confettiRAF = null;
function confettiBurst(canvas) {
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  const colors = ["#ff2e7e", "#7b5cff", "#19d8d8", "#ffce4a", "#ffffff"];
  const P = [];
  for (let i = 0; i < 260; i++) P.push({ x: canvas.width / 2 + (Math.random() - .5) * canvas.width * .4, y: canvas.height * .32 + (Math.random() - .5) * 90, vx: (Math.random() - .5) * 18 * dpr, vy: (Math.random() * -17 - 4) * dpr, g: (.34 + Math.random() * .26) * dpr, s: (5 + Math.random() * 8) * dpr, rot: Math.random() * 6.28, vr: (Math.random() - .5) * .3, c: colors[(Math.random() * colors.length) | 0], life: 1 });
  const start = performance.now();
  function frame(now) {
    const el = now - start; ctx.clearRect(0, 0, canvas.width, canvas.height);
    P.forEach(p => { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= .99; p.rot += p.vr; if (el > 2800) p.life -= .02; ctx.save(); ctx.globalAlpha = Math.max(0, p.life); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * .6); ctx.restore(); });
    if (el < 4600) confettiRAF = requestAnimationFrame(frame); else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  cancelAnimationFrame(confettiRAF); confettiRAF = requestAnimationFrame(frame);
}
function stopConfetti() { cancelAnimationFrame(confettiRAF); const c = document.getElementById("confetti"); c.getContext("2d").clearRect(0, 0, c.width, c.height); }

init();
