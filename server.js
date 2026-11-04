const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(express.json({ limit: "10kb" }));

const PORT = process.env.PORT || 3000;
const API_TOKEN = process.env.API_TOKEN || "";               // BDFD sends this in the Authorization header
const SECRET = process.env.KEY_SECRET || "CHANGE_ME_SECRET";  // must match SECRET in public/index.html and AyzIY.lua
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data.json");
const HOURS = 24;
const AL = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/* same key algorithm as the website and the Roblox script */
const hs = (x) => { let h = 5381; for (let i = 0; i < x.length; i++) h = (h * 131 + x.charCodeAt(i)) % 4294967291; return h; };
const en = (n, l) => { let o = ""; for (let i = 0; i < l; i++) { o = AL[n % 32] + o; n = Math.floor(n / 32); } return o; };
function makeKey() {
  const eh = Math.floor(Date.now() / 36e5) + HOURS;
  let nc = ""; for (let i = 0; i < 3; i++) nc += AL[Math.floor(Math.random() * 32)];
  const b = en(eh, 5) + nc;
  const k = b + en(hs(SECRET + b) % 1048576, 4);
  return { key: `AYZ-${k.slice(0, 4)}-${k.slice(4, 8)}-${k.slice(8)}`, exp: eh * 36e5 };
}

/* tiny JSON file store (use a Railway Volume to keep it between deploys) */
let users = {};
try { users = JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); } catch {}
const save = () => { try { fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2)); } catch {} };

/* BDFD calls this when someone runs .s */
app.post("/api/discord", (req, res) => {
  if (!API_TOKEN || req.get("Authorization") !== API_TOKEN) return res.status(401).json({ ok: false, error: "unauthorized" });
  const username = String(req.body.username || "").slice(0, 64).trim();
  const id = String(req.body.id || "").replace(/\D/g, "").slice(0, 25);
  if (!username || !id) return res.status(400).json({ ok: false, error: "missing username or id" });

  let u = users[id];
  if (!u || u.exp <= Date.now()) {
    const k = makeKey();
    u = users[id] = { username, id, key: k.key, exp: k.exp, seen: new Date().toISOString() };
  } else {
    u.username = username;
  }
  save();
  res.json({ ok: true, username, key: u.key, expires: new Date(u.exp).toISOString() });
});

/* admin: see who has used the bot (needs the same token) */
app.get("/api/users", (req, res) => {
  if (!API_TOKEN || req.get("Authorization") !== API_TOKEN) return res.status(401).json({ ok: false });
  res.json({ ok: true, count: Object.keys(users).length, users: Object.values(users) });
});

app.get("/health", (_, res) => res.send("ok"));
const PUB = path.join(__dirname, "public");
app.use(express.static(PUB));
app.get("/", (_, res) => res.sendFile(path.join(PUB, "index.html")));

if (!process.env.VERCEL) app.listen(PORT, () => console.log("AyzIY site running on port " + PORT));
module.exports = app; // lets Vercel run it too
