/* ============================================================================
   BracketUI — renders the group stage, best-thirds and knockout bracket from a
   bracket `state` ({groups, thirds, results, tiebreakerGoals}).
   Modes:
     "edit"     interactive; mutates state + calls opts.onChange
     "view"     read-only; paints bright-green connector lines for correct picks
                (needs opts.official)
     "official" interactive; same as edit, used by the admin to enter real results
   Relies on globals from shared/data.js + shared/engine.js (classic scripts).
   ============================================================================ */
window.BracketUI = (function () {
"use strict";

const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function team(id) { const t = TEAMS[id]; return t ? { id, code: id, ...t } : null; }
function flag(id, cls = "") {
  const t = team(id);
  const img = document.createElement("img");
  img.className = ("flag " + cls).trim();
  img.alt = t ? t.name + " flag" : "";
  img.decoding = "async"; img.crossOrigin = "anonymous"; img.referrerPolicy = "no-referrer";
  if (t) img.src = `https://flagcdn.com/w160/${t.iso}.png`;
  img.addEventListener("error", () => {
    const span = document.createElement("span");
    span.className = img.className + " flag-fallback";
    span.textContent = t ? t.code : "—";
    if (img.isConnected) img.replaceWith(span);
  });
  return img;
}
function preloadFlags() { Object.keys(TEAMS).forEach(id => { const i = new Image(); i.crossOrigin = "anonymous"; i.src = `https://flagcdn.com/w160/${TEAMS[id].iso}.png`; }); }

/* ----------------------------- GROUP STAGE ------------------------------- */
function rankOf(state, L, id) {
  const picks = state.groups[L] || (state.groups[L] = []);
  const i = picks.indexOf(id);
  if (i >= 0) return i + 1;
  if (picks.length === 3) return 4;
  return 0;
}
const groupComplete = (state, L) => (state.groups[L] || []).length === 3;
function allGroupsComplete(state) { return GROUP_LETTERS.every(L => groupComplete(state, L)); }

function mountGroups(container, state, opts) {
  const interactive = opts.mode === "edit" || opts.mode === "official";
  GROUP_LETTERS.forEach(L => { if (!state.groups[L]) state.groups[L] = []; });
  function render() {
    container.innerHTML = "";
    GROUP_LETTERS.forEach(L => container.appendChild(card(L)));
  }
  function card(L) {
    const c = document.createElement("div");
    c.className = "group-card" + (groupComplete(state, L) ? " complete" : "");
    c.dataset.group = L;
    const head = document.createElement("div");
    head.className = "group-head";
    head.innerHTML = `<div class="group-letter">${L}</div><h3>Group ${L}</h3>`;
    c.appendChild(head);
    GROUPS[L].forEach(id => c.appendChild(row(L, id)));
    if (interactive) {
      const hint = document.createElement("div");
      hint.className = "group-hint";
      const n = (state.groups[L] || []).length;
      hint.textContent = n === 0 ? "Tap the group winner" : n === 1 ? "Now the runner-up"
        : n === 2 ? "Tap who finishes 3rd" : "1st & 2nd advance · 3rd enters the thirds race";
      c.appendChild(hint);
    }
    return c;
  }
  function row(L, id) {
    const t = team(id), r = rankOf(state, L, id);
    const el = document.createElement("div");
    el.className = "team-row" + (r ? " r" + r : "");
    // correctness marker in view mode (advancer correct vs official top-2)
    if (opts.mode === "view" && opts.official && r >= 1 && r <= 2) {
      const off = opts.official.groups && opts.official.groups[L];
      if (off && (off[0] === id || off[1] === id)) el.classList.add("correct-pick");
    }
    el.appendChild(flag(id));
    const nm = document.createElement("div"); nm.className = "tname"; nm.textContent = t.name; el.appendChild(nm);
    const cd = document.createElement("span"); cd.className = "tcode"; cd.textContent = t.code; el.appendChild(cd);
    const b = document.createElement("div"); b.className = "rank-badge"; b.textContent = r && r <= 3 ? r : ""; el.appendChild(b);
    if (interactive) el.addEventListener("click", () => pick(L, id, el));
    return el;
  }
  function pick(L, id, el) {
    const picks = state.groups[L];
    const i = picks.indexOf(id);
    if (i >= 0) picks.splice(i, 1);
    else if (picks.length < 3) picks.push(id);
    else { opts.toast && opts.toast("Top 3 set — tap a ranked team to change it"); return; }
    // keep thirds consistent with new 3rd-place teams
    state.thirds = (state.thirds || []).filter(t => GROUP_LETTERS.some(g => (state.groups[g] || [])[2] === t));
    const fresh = card(L);
    el.closest(".group-card").replaceWith(fresh);
    if (picks.indexOf(id) >= 0) {
      const nr = $$(".team-row", fresh).find(x => x.querySelector(".tname").textContent === team(id).name);
      nr && nr.classList.add("just-picked");
    }
    opts.onChange && opts.onChange();
  }
  render();
  return { render };
}

/* ----------------------------- BEST THIRDS ------------------------------- */
function thirdTeams(state) { return GROUP_LETTERS.map(L => ({ L, id: (state.groups[L] || [])[2] })).filter(x => x.id); }

function mountThirds(container, state, opts) {
  const interactive = opts.mode === "edit" || opts.mode === "official";
  if (!state.thirds) state.thirds = [];
  function render() {
    container.innerHTML = "";
    thirdTeams(state).forEach(({ L, id }) => container.appendChild(card(L, id)));
  }
  function card(L, id) {
    const t = team(id), selected = state.thirds.includes(id), full = state.thirds.length >= 8;
    const c = document.createElement("div");
    c.className = "third-card" + (selected ? " selected" : (interactive && full ? " locked" : ""));
    if (opts.mode === "view" && opts.official && selected) {
      if ((opts.official.thirds || []).includes(id)) c.classList.add("correct-pick");
    }
    c.appendChild(flag(id, "lg"));
    const w = document.createElement("div"); w.style.flex = "1";
    w.innerHTML = `<div class="tname">${t.name}</div><div class="tgrp">3rd · Group ${L}</div>`;
    c.appendChild(w);
    const dot = document.createElement("div"); dot.className = "pick-dot"; c.appendChild(dot);
    if (interactive) c.addEventListener("click", () => toggle(id));
    return c;
  }
  function toggle(id) {
    const i = state.thirds.indexOf(id);
    if (i >= 0) state.thirds.splice(i, 1);
    else if (state.thirds.length < 8) state.thirds.push(id);
    else { opts.toast && opts.toast("That's 8 already — deselect one to swap"); return; }
    render(); opts.onChange && opts.onChange();
  }
  render();
  return { render };
}

/* ----------------------------- KNOCKOUT ---------------------------------- */
const SIDES = [
  { key: "L", rounds: ["R32", "R16", "QF", "SF"] },
  { key: "F", rounds: ["F"] },
  { key: "R", rounds: ["R32", "R16", "QF", "SF"] },
];

function mountKnockout(container, state, opts) {
  const interactive = opts.mode === "edit" || opts.mode === "official";
  if (!state.results) state.results = {};

  function render() {
    const assign = thirdAssignment(state.thirds || []);
    prune(state);
    const correctness = (opts.mode === "view" && opts.official) ? matchCorrectness(state, opts.official) : {};
    container.innerHTML = "";
    SIDES.forEach(side => {
      if (side.key === "F") { container.appendChild(finalColumn(assign, correctness)); return; }
      const wing = document.createElement("div");
      wing.className = "bracket-side " + (side.key === "L" ? "left" : "right");
      side.rounds.forEach(r => wing.appendChild(roundCol(side.key, r, assign, correctness)));
      container.appendChild(wing);
    });
  }
  function roundCol(sideKey, round, assign, correctness) {
    const col = document.createElement("div"); col.className = "round";
    const lab = document.createElement("div"); lab.className = "round-label"; lab.textContent = ROUND_META[round].name;
    col.appendChild(lab);
    BRACKET.filter(m => m.side === sideKey && m.round === round)
      .forEach(m => col.appendChild(matchWrap(m, assign, correctness)));
    return col;
  }
  function finalColumn(assign, correctness) {
    const col = document.createElement("div"); col.className = "col-final";
    col.innerHTML = `<div class="final-cap">The Final</div><div class="trophy">🏆</div>`;
    col.appendChild(matchWrap(BY_NUM[104], assign, correctness, true));
    const mini = document.createElement("div"); mini.className = "champ-mini";
    const champ = state.results[104];
    if (champ) {
      const pill = document.createElement("div"); pill.className = "winner-pill";
      pill.appendChild(flag(champ));
      const b = document.createElement("b"); b.textContent = team(champ).name + (opts.mode === "official" ? " — Champions" : ""); pill.appendChild(b);
      mini.appendChild(pill);
    }
    col.appendChild(mini);
    return col;
  }
  function matchWrap(match, assign, correctness, isFinal = false) {
    const wrap = document.createElement("div");
    wrap.className = "match-wrap";
    if (correctness[match.m]) wrap.classList.add("correct");
    if (match.round !== "R32" && match.round !== "F") {
      const conn = document.createElement("div"); conn.className = "conn"; wrap.appendChild(conn);
    }
    const card = document.createElement("div");
    card.className = "match" + (isFinal ? " final-match" : "");
    card.dataset.m = match.m;
    const winner = state.results[match.m] || null;
    if (winner) card.classList.add("decided");
    const num = document.createElement("div"); num.className = "match-num"; num.textContent = "#" + match.m; card.appendChild(num);
    [match.a, match.b].forEach(ref => card.appendChild(slot(match, ref, resolveRef(ref, state, assign), winner)));
    wrap.appendChild(card);
    return wrap;
  }
  function slot(match, ref, id, winner) {
    const s = document.createElement("div");
    if (!id) { s.className = "slot empty"; s.innerHTML = `<span class="flag flag-fallback">—</span><span class="sname">${refLabel(ref)}</span>`; return s; }
    const t = team(id);
    s.className = "slot" + (winner ? (winner === id ? " winner" : " loser") : "");
    s.dataset.team = id;
    s.appendChild(flag(id));
    const nm = document.createElement("span"); nm.className = "sname"; nm.textContent = t.name; s.appendChild(nm);
    const cd = document.createElement("span"); cd.className = "scode"; cd.textContent = t.code; s.appendChild(cd);
    if (interactive) s.addEventListener("click", () => pickWinner(match, id));
    return s;
  }
  function refLabel(ref) {
    return ref.t === "W" ? "Winner Group " + ref.g : ref.t === "R" ? "Runner-up " + ref.g
      : ref.t === "T" ? "3rd place" : "Winner Match " + ref.m;
  }
  function pickWinner(match, id) {
    if (state.results[match.m] === id) return;
    state.results[match.m] = id;
    opts.onChange && opts.onChange(match.m === 104 ? id : null);
    render();  // sync: DOM must be current before next click resolves
    // Defer only the animation class additions to the next frame to avoid layout thrash
    requestAnimationFrame(() => {
      const justEl = container.querySelector(`.match[data-m="${match.m}"] .slot.winner`);
      justEl && justEl.classList.add("just-won");
      if (match.next) {
        const nextEl = container.querySelector(`.match[data-m="${match.next}"]`);
        nextEl && $$(".slot", nextEl).forEach(x => { if (x.dataset.team === id) x.classList.add("fill-in"); });
      }
    });
  }
  render();
  return { render };
}

return { mountGroups, mountThirds, mountKnockout, flag, team, preloadFlags, allGroupsComplete, groupComplete, thirdTeams };
})();
