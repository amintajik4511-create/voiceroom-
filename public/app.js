
const app = document.getElementById("app");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const guestBtn = document.getElementById("guestBtn");
const roomList = document.getElementById("roomList");
const languageBtn = document.getElementById("languageBtn");
const registerBtn = document.getElementById("registerBtn");

let currentUser = null;
let socket = null;
let currentRoom = null;

async function api(url, data) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(data)
  });

  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "خطایی رخ داد.");
  return result;
}

function message(text) {
  alert(text);
}

function setLoggedIn(user) {
  currentUser = user;
  message("خوش آمدی " + (user.displayName || user.username || "مهمان"));
  connectSocket();
}

async function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    return message("نام کاربری و رمز عبور را وارد کن.");
  }

  try {
    const result = await api("/api/login", { username, password });
    setLoggedIn(result.user);
  } catch (error) {
    message(error.message);
  }
}

async function register() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    return message("نام کاربری و رمز عبور را وارد کن.");
  }

  if (password.length < 8) {
    return message("رمز عبور باید حداقل ۸ کاراکتر باشد.");
  }

  const displayName = prompt("نام نمایشی خود را وارد کن:") || username;

  try {
    const result = await api("/api/register", {
      username,
      password,
      displayName
    });

    setLoggedIn(result.user);
  } catch (error) {
    message(error.message);
  }
}

function enterAsGuest() {
  setLoggedIn({
    username: null,
    displayName: "مهمان"
  });
}

function connectSocket() {
  if (socket) {
    socket.disconnect();
  }

  function startSocket() {
    socket = io();

    socket.on("connect", () => {
      socket.emit("rooms:list");
    });

    socket.on("connect_error", () => {
      message("اتصال به سرور برقرار نشد. دوباره تلاش کن.");
    });

    socket.on("rooms:list", renderRooms);

    socket.on("peer:joined", participant => {
      if (currentRoom) {
        message(participant.name + " وارد اتاق شد.");
      }
    });

    socket.on("peer:left", () => {
      if (currentRoom) socket.emit("rooms:list");
    });
  }

  if (typeof io === "function") {
    startSocket();
  } else {
    const script = document.createElement("script");
    script.src = "/socket.io/socket.io.js";
    script.onload = startSocket;
    script.onerror = () => message("بارگذاری ارتباط با سرور ناموفق بود.");
    document.head.appendChild(script);
  }
}

function renderRooms(rooms) {
  roomList.replaceChildren();

  if (!rooms.length) {
    const empty = document.createElement("p");
    empty.textContent = "هنوز اتاقی ساخته نشده است.";
    roomList.appendChild(empty);
    return;
  }

  rooms.forEach(room => {
    const item = document.createElement("div");
    item.style.padding = "15px";
    item.style.margin = "10px 0";
    item.style.background = "#263746";
    item.style.borderRadius = "12px";

    const title = document.createElement("h3");
    title.textContent = "🎙️ " + room.title;

    const details = document.createElement("p");
    details.textContent =
      room.count + "/" + room.capacity + " نفر | " +
      (room.locked ? "خصوصی 🔒" : "عمومی");

    const button = document.createElement("button");
    button.textContent = "ورود به اتاق";
    button.addEventListener("click", () => joinRoom(room));

    item.append(title, details, button);
    roomList.appendChild(item);
  });
}

function joinRoom(room) {
  if (!socket || !socket.connected) {
    return message("اتصال به سرور برقرار نیست.");
  }

  const password = room.locked
    ? prompt("رمز اتاق را وارد کن:")
    : "";

  if (password === null) return;

  socket.emit("room:join", {
    id: room.id,
    password,
    name: currentUser.displayName
  }, result => {
    if (!result.ok) return message(result.error);

    currentRoom = result.room;
    roomList.replaceChildren();

    const heading = document.createElement("h3");
    heading.textContent = "🎙️ " + result.room.title;

    const info = document.createElement("p");
    info.textContent = "اعضای حاضر: " + result.participants.length;

    const members = document.createElement("p");
    members.textContent = result.participants
      .map(person => person.name)
      .join("، ");

    const leaveButton = document.createElement("button");
    leaveButton.textContent = "خروج از اتاق";
    leaveButton.addEventListener("click", leaveRoom);

    roomList.append(heading, info, members, leaveButton);
    message("وارد اتاق شدی. ارتباط صوتی در مرحله بعد اضافه می‌شود.");
  });
}

function leaveRoom() {
  if (!socket || !currentRoom) return;

  socket.emit("room:leave");
  currentRoom = null;
  socket.emit("rooms:list");
}

function addCreateRoomButton() {
  const roomsSection = document.querySelector(".rooms");
  if (!roomsSection || document.getElementById("createRoomBtn")) return;

  const button = document.createElement("button");
  button.id = "createRoomBtn";
  button.textContent = "ساخت اتاق جدید";
  button.addEventListener("click", createRoom);

  roomsSection.insertBefore(button, roomList);
}

function createRoom() {
  if (!socket || !socket.connected) {
    return message("اتصال به سرور برقرار نیست.");
  }

  const title = prompt("نام اتاق را وارد کن:");
  if (!title || !title.trim()) return;

  const password = prompt("برای اتاق رمز بگذار؟ (بدون رمز = عمومی)");
  if (password === null) return;

  socket.emit("room:create", {
    title: title.trim(),
    password: password
  }, result => {
    if (!result.ok) return message("ساخت اتاق ناموفق بود.");

    socket.emit("rooms:list");
    message("اتاق ساخته شد.");
  });
}

async function checkSession() {
  try {
    const response = await fetch("/api/me", {
      credentials: "same-origin"
    });
    const result = await response.json();

    if (result.user) {
      currentUser = result.user;
      connectSocket();
    }
  } catch (error) {
    console.error("Session check failed:", error);
  }
}

loginBtn.addEventListener("click", login);
registerBtn.addEventListener("click", register);
guestBtn.addEventListener("click", enterAsGuest);

languageBtn.addEventListener("click", () => {
  const isPersian = document.documentElement.lang === "fa";

  document.documentElement.lang = isPersian ? "en" : "fa";
  document.documentElement.dir = isPersian ? "ltr" : "rtl";

  languageBtn.textContent = isPersian
    ? "English / فارسی"
    : "فارسی / English";
});

addCreateRoomButton();
checkSession();

console.log("VoiceRoom initialized successfully!");

