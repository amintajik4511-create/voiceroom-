
const app = document.getElementById("app");

const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginBtn = document.getElementById("loginBtn");
const guestBtn = document.getElementById("guestBtn");
const roomList = document.getElementById("roomList");
const languageBtn = document.getElementById("languageBtn");

let currentUser = null;
let currentLanguage = "fa";

const rooms = [
  { name: "گپ دوستانه", users: 5, type: "عمومی" },
  { name: "موسیقی و گفتگو", users: 8, type: "عمومی" },
  { name: "اتاق خصوصی", users: 2, type: "خصوصی" }
];

function showRooms() {
  roomList.innerHTML = "";

  rooms.forEach((room) => {
    const item = document.createElement("div");

    item.style.padding = "15px";
    item.style.margin = "10px 0";
    item.style.background = "#263746";
    item.style.borderRadius = "12px";

    const title = document.createElement("h3");
    title.textContent = "🎙️ " + room.name;

    const details = document.createElement("p");
    details.textContent =
      room.users + "/16 نفر | " + room.type;

    const button = document.createElement("button");
    button.textContent = "مشاهده اتاق";

    button.addEventListener("click", () => {
      alert("اتصال واقعی به اتاق در مرحله بعد ساخته می‌شود.");
    });

    item.append(title, details, button);
    roomList.appendChild(item);
  });
}

function enterAsGuest() {
  currentUser = "مهمان";

  alert("خوش آمدی! وارد حالت مهمان شدی.");

  showRooms();
}

function login() {
  const username = usernameInput.value.trim();
  const password = passwordInput.value;

  if (!username || !password) {
    alert("لطفاً نام کاربری و رمز را وارد کن.");
    return;
  }

  alert("صفحه ورود آماده است؛ اتصال به سیستم حساب کاربری در مرحله بعد انجام می‌شود.");
}

guestBtn.addEventListener("click", enterAsGuest);
loginBtn.addEventListener("click", login);

languageBtn.addEventListener("click", () => {
  currentLanguage = currentLanguage === "fa" ? "en" : "fa";

  if (currentLanguage === "en") {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
    languageBtn.textContent = "English / فارسی";
    alert("English mode selected");
  } else {
    document.documentElement.lang = "fa";
    document.documentElement.dir = "rtl";
    languageBtn.textContent = "فارسی / English";
    alert("حالت فارسی انتخاب شد");
  }
});

console.log("VoiceRoom initialized successfully!");
