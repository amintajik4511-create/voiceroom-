const express = require("express");
const http = require("http");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "{}");

const readUsers = () => JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
const writeUsers = (u) => fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2));
app.use(express.json({ limit: "1mb" }));
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || "change-this-development-secret",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 7 * 86400000 }
});
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/register", async (req, res) => {
  const { username, password, displayName } = req.body || {};
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username || "") || (password || "").length < 8)
    return res.status(400).json({ error: "نام کاربری باید ۳ تا ۲۰ کاراکتر و رمز حداقل ۸ کاراکتر باشد." });
  const users = readUsers();
  if (users[username.toLowerCase()]) return res.status(409).json({ error: "این نام کاربری قبلاً گرفته شده است." });
  users[username.toLowerCase()] = {
    password: await bcrypt.hash(password, 12),
    displayName: String(displayName || username).slice(0, 32),
    bio: "",
    avatar: ""
  };
  writeUsers(users);
  req.session.user = { username: username.toLowerCase(), displayName: users[username.toLowerCase()].displayName };
  res.json({ user: req.session.user });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body || {};
  const users = readUsers();
  const user = users[String(username || "").toLowerCase()];
  if (!user || !(await bcrypt.compare(password || "", user.password)))
    return res.status(401).json({ error: "نام کاربری یا رمز عبور اشتباه است." });
  req.session.user = { username: String(username).toLowerCase(), displayName: user.displayName };
  res.json({ user: req.session.user, profile: { displayName: user.displayName, bio: user.bio, avatar: user.avatar } });
});

app.get("/api/me", (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  const users = readUsers();
  const u = users[req.session.user.username];
  res.json({ user: req.session.user, profile: u ? { displayName: u.displayName, bio: u.bio, avatar: u.avatar } : {} });
});

app.post("/api/profile", (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: "ابتدا وارد حساب شوید." });
  const users = readUsers(), u = users[req.session.user.username];
  if (!u) return res.status(404).json({ error: "حساب پیدا نشد." });
  u.displayName = String(req.body.displayName || u.displayName).slice(0, 32);
  u.bio = String(req.body.bio || "").slice(0, 160);
  u.avatar = String(req.body.avatar || "").slice(0, 500000);
  writeUsers(users);
  req.session.user.displayName = u.displayName;
  res.json({ ok: true, profile: { displayName: u.displayName, bio: u.bio, avatar: u.avatar } });
});

app.post("/api/logout", (req, res) => req.session.destroy(() => res.json({ ok: true })));

const rooms = new Map();
const MAX = 16;
function publicRoom(room) {
  return { id: room.id, title: room.title, locked: !!room.passwordHash, count: room.members.size, capacity: MAX };
}
io.on("connection", socket => {
  socket.on("rooms:list", () => socket.emit("rooms:list", [...rooms.values()].map(publicRoom)));
  socket.on("room:create", async (data, cb = () => {}) => {
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    const room = {
      id, title: String(data.title || "اتاق جدید").slice(0, 40),
      passwordHash: data.password ? await bcrypt.hash(String(data.password), 10) : null,
      members: new Map()
    };
    rooms.set(id, room);
    cb({ ok: true, room: publicRoom(room) });
    io.emit("rooms:list", [...rooms.values()].map(publicRoom));
  });
  socket.on("room:join", async (data, cb = () => {}) => {
    const id = String(data.id || "").toUpperCase(), room = rooms.get(id);
    if (!room) return cb({ ok: false, error: "اتاق پیدا نشد." });
    if (room.passwordHash && !(await bcrypt.compare(String(data.password || ""), room.passwordHash)))
      return cb({ ok: false, error: "رمز اتاق اشتباه است." });
    if (room.members.size >= MAX) return cb({ ok: false, error: "ظرفیت ۱۶ نفر تکمیل است." });
    const user = socket.request.session.user || {};
    const participant = {
      id: socket.id,
      username: user.username || ("guest_" + socket.id.slice(0, 5)),
      name: String(data.name || user.displayName || "مهمان").slice(0, 32),
      avatar: String(data.avatar || "").slice(0, 500000),
      guest: !user.username
    };
    socket.join(id);
    socket.data.roomId = id;
    room.members.set(socket.id, participant);
    cb({ ok: true, room: publicRoom(room), participants: [...room.members.values()] });
    socket.to(id).emit("peer:joined", participant);
    io.emit("rooms:list", [...rooms.values()].map(publicRoom));
  });
  socket.on("room:leave", () => leave(socket));
  socket.on("webrtc:signal", ({ to, signal }) => {
    if (to && signal) io.to(to).emit("webrtc:signal", { from: socket.id, signal });
  });
  socket.on("voice:state", ({ muted }) => {
    const id = socket.data.roomId, room = rooms.get(id);
    if (room) io.to(id).emit("voice:state", { id: socket.id, muted: !!muted });
  });
  socket.on("disconnect", () => leave(socket));
});
function leave(socket) {
  const id = socket.data.roomId, room = rooms.get(id);
  if (!room) return;
  room.members.delete(socket.id);
  socket.to(id).emit("peer:left", { id: socket.id });
  socket.leave(id);
  socket.data.roomId = null;
  if (!room.members.size) rooms.delete(id);
  io.emit("rooms:list", [...rooms.values()].map(publicRoom));
}
server.listen(PORT, () => console.log(`VoiceRoom running on http://localhost:${PORT}`));
