/* API client + lightweight per-pool identity (secret token in localStorage). */
window.API = (function () {
  async function req(method, path, body, token) {
    const opt = { method, headers: {} };
    if (body) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    if (token) opt.headers["x-token"] = token;
    const r = await fetch("/api" + path, opt);
    let data = null; try { data = await r.json(); } catch (e) {}
    if (!r.ok) throw new Error((data && data.error) || ("Request failed (" + r.status + ")"));
    return data;
  }
  return {
    createPool: b => req("POST", "/pools", b),
    joinPool: (id, b) => req("POST", `/pools/${id}/join`, b),
    getPool: (id, token) => req("GET", `/pools/${id}`, null, token),
    savePicks: (id, token, picks) => req("PUT", `/pools/${id}/picks`, { picks }, token),
    submit: (id, token, picks) => req("POST", `/pools/${id}/submit`, { picks }, token),
    setOfficial: (id, token, official, finalGoals) => req("POST", `/pools/${id}/official`, { official, finalGoals }, token),
    setSettings: (id, token, b) => req("POST", `/pools/${id}/settings`, b, token),
  };
})();

window.Identity = {
  key: id => "wc.pool." + id,
  save(id, member) { localStorage.setItem(this.key(id), JSON.stringify(member)); localStorage.setItem("wc.lastPool", id); },
  get(id) { try { return JSON.parse(localStorage.getItem(this.key(id))); } catch (e) { return null; } },
  last() { return localStorage.getItem("wc.lastPool"); },
  forget(id) { localStorage.removeItem(this.key(id)); if (this.last() === id) localStorage.removeItem("wc.lastPool"); },
};
