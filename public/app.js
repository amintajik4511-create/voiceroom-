
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const guestBtn = document.getElementById("guestBtn");
const roomList = document.getElementById("roomList");
const languageBtn = document.getElementById("languageBtn");

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

  if (!response.ok) {
    throw new Error(result.error || "خطایی رخ داد.");
  }

  return result;
}

function showMessage(text) {
  alert(text);
}

function startApp(user) {
  currentUser = user;
  showMessage("خوش آمدی " + (user.displayName || "مهمان"));
  connectSocket();
}

async function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    return showMessage("نام کاربری و رمز عبور را وارد کن.");
  }

  try {
    const result = await api("/api/login", {
      username,
      password
    });

    startApp(result.user);
  } catch (error) {
    showMessage(error.message);
  }
}

async function register() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    return showMessage("نام کاربری و رمز عبور را وارد کن.");
  }

  if (password.length < 8) {
    return showMessage("رمز عبور باید حداقل ۸ کاراکتر باشد.");
  }

  const displayName = prompt("نام نمایشی خود را وارد کن:") || username;

  try {
    const result = await api("/api/register", {
      username,
      password,
      displayName
    });

    startApp(result.user);
  } catch (error) {
    showMessage(error.message);
  }
}

function enterAsGuest() {
  startApp({
    username: null,
    displayName: "مهمان"
  });
}

function connectSocket() {
  if (socket) {
    socket.disconnect();
  }

  function initialize() {
    socket = io();

    socket.on("connect", () => {
      socket.emit("rooms:list");
    });

    socket.on("connect_error", () => {
      showMessage("اتصال به سرور برقرار نشد.");
    });

    socket.on("rooms:list", renderRooms);
  }

  if (typeof io === "function") {
    initialize();
  } else {
    const script = document.createElement("script");
    script.src = "/socket.io/socket.io.js";

    script.onload = initialize;

    script.onerror = () => {
      showMessage("ارتباط با سرور برقرار نشد.");
    };

    document.head.appendChild(script);
  }
}

function renderRooms(rooms) {
  if (currentRoom) return;

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
    return showMessage("اتصال به سرور برقرار نیست.");
  }

  if (currentRoom) {
    return showMessage("ابتدا از اتاق فعلی خارج شو.");
  }

  let password = "";

  if (room.locked) {
    password = prompt("رمز اتاق را وارد کن:");

    if (password === null) return;
  }

  socket.emit("room:join", {
    id: room.id,
    password,
    name: currentUser.displayName
  }, result => {
    if (!result.ok) {
      return showMessage(result.error);
    }

    currentRoom = result.room;
    showRoom(result.participants);
  });
}

function showRoom(participants) {
  roomList.replaceChildren();

  const title = document.createElement("h3");
  title.textContent = "🎙️ " + currentRoom.title;

  const count = document.createElement("p");
  count.textContent = "اعضای اتاق: " + participants.length + "/16";

  const members = document.createElement("div");

  participants.forEach(person => {
    const p = document.createElement("p");
    p.textContent = "👤 " + person.name;
    members.appendChild(p);
  });

  const leaveButton = document.createElement("button");
  leaveButton.textContent = "خروج از اتاق";
  leaveButton.addEventListener("click", leaveRoom);

  roomList.append(title, count, members, leaveButton);
}

function leaveRoom() {
  if (!socket || !currentRoom) return;

  socket.emit("room:leave");
  currentRoom = null;
  socket.emit("rooms:list");
}

function createRoomButton() {
  const section = document.querySelector(".rooms");

  if (!section || document.getElementById("createRoomBtn")) return;

  const button = document.createElement("button");
  button.id = "createRoomBtn";
  button.textContent = "ساخت اتاق جدید";

  button.addEventListener("click", createRoom);

  section.insertBefore(button, roomList);
}

function createRoom() {
  if (!socket || !socket.connected) {
    return showMessage("ابتدا به سرور وصل شو.");
  }

  if (currentRoom) {
    return showMessage("ابتدا از اتاق فعلی خارج شو.");
  }

  const title = prompt("نام اتاق را وارد کن:");

  if (!title || !title.trim()) return;

  const password = prompt(
    "برای اتاق رمز بگذار. برای اتاق عمومی خالی بگذار:"
  );

  if (password === null) return;

  socket.emit("room:create", {
    title: title.trim(),
    password
  }, result => {
    if (result.ok) {
      showMessage("اتاق با موفقیت ساخته شد.");
      socket.emit("rooms:list");
    }
  });
}

async function checkSession() {
  try {
    const response = await fetch("/api/me", {
      credentials: "same-origin"
    });

    const result = await response.json();

    if (result.user) {
      startApp(result.user);
    }
  } catch (error) {
    console.error("Session error:", error);
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

createRoomButton();
checkSession();

console.log("VoiceRoom initialized successfully!");
