/* Tiny atomic JSON datastore — no native deps, fine for a friends-pool scale.
   Single Node process, synchronous write-through (write temp + rename). */
const fs = require("fs");
const path = require("path");

const DIR = process.env.WC_DATA_DIR || path.join(__dirname, "data");
const FILE = path.join(DIR, "db.json");

let db = { pools: {} };

function load() {
  try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); }
  catch (e) { db = { pools: {} }; }
  if (!db.pools) db.pools = {};
  return db;
}
function save() {
  fs.mkdirSync(DIR, { recursive: true });
  const tmp = FILE + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, FILE);
}

fs.mkdirSync(DIR, { recursive: true });
load();

module.exports = { db, load, save };
