"use strict";

/*
 * script.js — turns the page into a little desktop OS.
 * Without JS every window is stacked and every link is a plain #anchor.
 *
 *  - Window manager: open / focus / minimize / close / drag ([data-win]).
 *  - Taskbar: one button per open window, Start menu, clock.
 *  - The URL hash follows the focused window, so #work-<id> deep-links work.
 *  - Keyboard: Esc closes the top window, number keys open a work,
 *    A / C / W open About / Contact / My Works, arrows move between folders.
 *  - Loading window once per browser session (skipped for reduced motion).
 *  - Copy button on mailto: contacts.
 */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const compact = window.matchMedia("(max-width: 719px)");

const SCREEN = document.getElementById("screen");
const TASKS = document.getElementById("tasks");
const START = document.getElementById("start");
const START_MENU = document.getElementById("start-menu");
const WINS = Array.from(document.querySelectorAll("[data-win]"));
const FOLDERS = Array.from(document.querySelectorAll("#menu-works .folder"));
const BOOT_KEY = "wilyan-desktop-booted";

const GAP = 16;
let zTop = 10;
let cascade = 0;
const opened = []; // open windows, in the order they were opened (taskbar order)
const stack = []; // open windows, bottom → top

const isOpen = (w) => opened.includes(w);
const isMin = (w) => w.classList.contains("is-min");
const topWin = () => [...stack].reverse().find((w) => !isMin(w)) || null;
const winFor = (id) => {
  const el = id ? document.getElementById(id) : null;
  return el ? el.closest("[data-win]") : null;
};

/* ---------------------------------------------------------------- placement */

function place(win) {
  if (win.dataset.placed) return;
  win.dataset.placed = "1";
  const sw = SCREEN.clientWidth;
  const sh = SCREEN.clientHeight;
  const w = win.offsetWidth;
  const iconsRight = (document.querySelector(".icons")?.getBoundingClientRect().right || 0) + GAP;
  let left;
  let top;

  if (win.id === "hello") {
    left = iconsRight;
    top = GAP + 8;
  } else if (win.id === "works") {
    const right = iconsRight + Math.min(440, sw - GAP * 2) + GAP * 2;
    left = right + w <= sw - GAP ? right : Math.max(iconsRight, sw - w - GAP);
    top = right + w <= sw - GAP ? GAP * 5 : GAP * 9;
  } else {
    left = Math.round((sw - w) / 2) + cascade * 28;
    top = GAP + 12 + cascade * 28;
    cascade = (cascade + 1) % 6;
  }
  move(win, left, Math.min(top, Math.max(GAP, sh - win.offsetHeight - GAP)));
}

function move(win, left, top) {
  const sw = SCREEN.clientWidth;
  const sh = SCREEN.clientHeight;
  const w = win.offsetWidth;
  const x = Math.min(Math.max(left, 80 - w), sw - w);
  const y = Math.min(Math.max(top, 0), sh - 40);
  win.style.left = `${Math.round(x)}px`;
  win.style.top = `${Math.round(y)}px`;
}

/* ----------------------------------------------------------- window manager */

function syncHash() {
  const top = topWin();
  const url = top ? `#${top.id}` : location.pathname + location.search;
  if ((top ? `#${top.id}` : "") !== location.hash) history.replaceState(null, "", url);
}

function focusInside(win) {
  const el =
    win.querySelector("[data-autofocus]") ||
    win.querySelector(".doc__title") ||
    win.querySelector(".folder") ||
    win;
  el.focus({ preventScroll: true });
}

function raise(win, { focus = false } = {}) {
  const i = stack.indexOf(win);
  if (i !== -1) stack.splice(i, 1);
  stack.push(win);
  win.style.zIndex = String(++zTop);
  WINS.forEach((w) => w.classList.toggle("is-top", w === win));
  if (focus) focusInside(win);
  renderTasks();
  syncHash();
}

function openWin(win, { focus = true, target = null } = {}) {
  if (!win) return;
  const fresh = !isOpen(win);
  if (fresh) {
    buddyReact(win);
    opened.push(win);
    win.classList.add("is-open");
    const body = win.querySelector(".win__body");
    if (body) body.scrollTop = 0;
    place(win);
  }
  win.classList.remove("is-min");
  raise(win, { focus });
  if (target && target !== win) {
    target.scrollIntoView({ block: "nearest" });
    target.focus?.({ preventScroll: true });
  }
}

function afterHide(win) {
  win.classList.remove("is-top");
  const next = topWin();
  if (next) raise(next, { focus: true });
  else {
    renderTasks();
    syncHash();
    START.focus({ preventScroll: true });
  }
}

function closeWin(win) {
  if (!isOpen(win)) return;
  opened.splice(opened.indexOf(win), 1);
  stack.splice(stack.indexOf(win), 1);
  win.classList.remove("is-open", "is-min");
  afterHide(win);
}

function minimizeWin(win) {
  if (!isOpen(win) || isMin(win)) return;
  win.classList.add("is-min");
  afterHide(win);
}

/* ------------------------------------------------------------------ chrome */

function addMinimize(win) {
  const bar = win.querySelector(".win__bar");
  const close = bar?.querySelector(".win__x");
  if (!bar || !close) return;
  const min = document.createElement("button");
  min.type = "button";
  min.className = "win__min";
  min.setAttribute("aria-label", "Minimize");
  min.textContent = "_";
  bar.insertBefore(min, close);
}

function renderTasks() {
  const top = topWin();
  TASKS.replaceChildren(
    ...opened.map((win) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "task";
      b.textContent = win.dataset.title || win.id;
      b.setAttribute("aria-pressed", String(win === top));
      b.addEventListener("click", () => {
        if (win === top) minimizeWin(win);
        else openWin(win);
      });
      return b;
    })
  );
}

function initDrag() {
  WINS.forEach((win) => {
    const bar = win.querySelector(".win__bar");
    if (!bar) return;
    bar.addEventListener("pointerdown", (e) => {
      if (compact.matches || e.button !== 0 || e.target.closest("a, button")) return;
      e.preventDefault();
      raise(win);
      const dx = e.clientX - win.offsetLeft;
      const dy = e.clientY - win.offsetTop;
      bar.setPointerCapture(e.pointerId);
      win.classList.add("is-dragging");
      const onMove = (ev) => move(win, ev.clientX - dx, ev.clientY - dy);
      const onUp = () => {
        win.classList.remove("is-dragging");
        bar.removeEventListener("pointermove", onMove);
        bar.removeEventListener("pointerup", onUp);
        bar.removeEventListener("pointercancel", onUp);
      };
      bar.addEventListener("pointermove", onMove);
      bar.addEventListener("pointerup", onUp);
      bar.addEventListener("pointercancel", onUp);
    });
  });
}

/* -------------------------------------------------------------- start menu */

function toggleStart(open = START_MENU.hidden) {
  START_MENU.hidden = !open;
  START.setAttribute("aria-expanded", String(open));
  if (open) START_MENU.querySelector(".start-menu__item")?.focus();
}

function initStart() {
  START.addEventListener("click", () => toggleStart());
  document.addEventListener("pointerdown", (e) => {
    if (!START_MENU.hidden && !e.target.closest("#start-menu, #start")) toggleStart(false);
  });
  START_MENU.querySelector("[data-restart]")?.addEventListener("click", () => {
    try {
      sessionStorage.removeItem(BOOT_KEY);
    } catch {}
    location.href = location.pathname + location.search;
  });
}

function initClock() {
  const clock = document.getElementById("clock");
  if (!clock) return;
  const fmt = new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" });
  const tick = () => {
    const now = new Date();
    clock.textContent = fmt.format(now);
    clock.dateTime = now.toISOString();
  };
  tick();
  setInterval(tick, 15000);
}

/* ------------------------------------------------------------------ router */

function hashId(hash) {
  try {
    return decodeURIComponent(hash.slice(1));
  } catch {
    return "";
  }
}

function openFromHash() {
  const id = hashId(location.hash);
  const target = id ? document.getElementById(id) : null;
  const win = winFor(id);
  if (win) openWin(win, { target });
}

function initLinks() {
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const ownWin = link.closest("[data-win]");

    if (ownWin && link.classList.contains("win__x")) {
      e.preventDefault();
      closeWin(ownWin);
      return;
    }

    const id = hashId(link.getAttribute("href"));
    const win = winFor(id);
    if (!win) return;
    e.preventDefault();
    if (!START_MENU.hidden) toggleStart(false);
    if (ownWin && link.classList.contains("btn--back") && ownWin !== win) closeWin(ownWin);
    openWin(win, { target: document.getElementById(id) });
  });

  document.addEventListener("click", (e) => {
    const min = e.target.closest(".win__min");
    if (min) minimizeWin(min.closest("[data-win]"));
  });

  WINS.forEach((win) => {
    win.addEventListener("pointerdown", () => {
      if (stack[stack.length - 1] !== win) raise(win);
    });
    win.addEventListener("focusin", () => {
      if (isOpen(win) && !isMin(win) && stack[stack.length - 1] !== win) raise(win);
    });
  });

  window.addEventListener("hashchange", openFromHash);
  window.addEventListener("resize", () => {
    opened.forEach((w) => move(w, w.offsetLeft, w.offsetTop));
  });
}

/* --------------------------------------------------------------- keyboard */

const NEXT = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
const SHORTCUTS = { a: "about", c: "contact", w: "works", h: "hello" };

function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.("input, textarea, select")) return;

    if (e.key === "Escape") {
      e.preventDefault();
      if (!START_MENU.hidden) {
        toggleStart(false);
        START.focus();
      } else {
        const top = topWin();
        if (top) closeWin(top);
      }
      return;
    }

    if (e.key in NEXT && FOLDERS.includes(document.activeElement)) {
      e.preventDefault();
      const i = FOLDERS.indexOf(document.activeElement);
      FOLDERS[(i + NEXT[e.key] + FOLDERS.length) % FOLDERS.length].focus();
      return;
    }

    if (e.key in NEXT && !START_MENU.hidden) {
      const items = Array.from(START_MENU.querySelectorAll(".start-menu__item"));
      const i = items.indexOf(document.activeElement);
      if (i === -1) return;
      e.preventDefault();
      items[(i + NEXT[e.key] + items.length) % items.length].focus();
      return;
    }

    const n = Number.parseInt(e.key, 10);
    if (n >= 1 && n <= FOLDERS.length) {
      e.preventDefault();
      openWin(winFor(FOLDERS[n - 1].getAttribute("href").slice(1)));
      return;
    }

    const win = winFor(SHORTCUTS[e.key.toLowerCase()]);
    if (win) {
      e.preventDefault();
      openWin(win);
    }
  });
}

/* ------------------------------------------------------------------- boot */

function initBoot() {
  const boot = document.getElementById("boot");
  let booted = false;
  try {
    booted = sessionStorage.getItem(BOOT_KEY) === "1";
  } catch {}
  if (!boot || booted || reducedMotion.matches || location.hash !== "") return;

  const html = document.documentElement;
  html.classList.add("is-booting");
  const duration = Number.parseFloat(getComputedStyle(html).getPropertyValue("--dur-boot")) || 1400;

  let timer = null;
  function finish() {
    if (!html.classList.contains("is-booting")) return;
    clearTimeout(timer);
    html.classList.remove("is-booting");
    document.removeEventListener("keydown", finish, true);
    boot.removeEventListener("click", finish);
    try {
      sessionStorage.setItem(BOOT_KEY, "1");
    } catch {}
  }

  timer = setTimeout(finish, duration + 350);
  document.addEventListener("keydown", finish, true);
  boot.addEventListener("click", finish);
}

/* ------------------------------------------------------------------ buddy */

const SAY = document.getElementById("buddy-say");
const BEAR = document.getElementById("buddy-bear");
const TIPS = [
  "Hi! I'm Wilyan's space bear.",
  "Tip: drag a window by its title bar.",
  "Tip: press 1–5 to open a work.",
  "Tip: the Start menu has everything.",
  "Tip: Esc closes the top window.",
];
const WIN_LINES = {
  works: "Pick a folder, any folder.",
  about: "That's Wilyan in a nutshell.",
  contact: "Say hi, don't be shy!",
};
let buddyReady = false;
let sayTimer = null;
let tip = 0;

function say(text, ms = 5000) {
  if (!SAY) return;
  SAY.hidden = true;
  SAY.textContent = text;
  void SAY.offsetWidth;
  SAY.hidden = false;
  SAY.parentElement.classList.add("is-talking");
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => {
    SAY.hidden = true;
    SAY.parentElement.classList.remove("is-talking");
  }, ms);
}

function buddyReact(win) {
  if (!buddyReady) return;
  if (WIN_LINES[win.id]) say(WIN_LINES[win.id]);
  else if (win.classList.contains("doc")) say("Good read. Esc closes it.");
}

function greeting() {
  const h = new Date().getHours();
  const part = h < 11 ? "pagi" : h < 15 ? "siang" : h < 18 ? "sore" : "malam";
  return `Selamat ${part}! Welcome to Wilyan's desktop.`;
}

function initDrift() {
  const buddy = document.getElementById("buddy");
  let x = 0;
  let y = 0;
  const drift = (first = false) => {
    const area = buddy.offsetParent;
    if (!area) return;
    const maxX = Math.max(0, area.clientWidth - buddy.offsetWidth);
    const maxY = Math.max(0, area.clientHeight - buddy.offsetHeight);
    const nx = Math.round(first ? maxX * 0.92 : Math.random() * maxX);
    const ny = Math.round(first ? maxY * 0.8 : Math.random() * maxY);
    const secs = first ? 0 : Math.max(6, Math.hypot(nx - x, ny - y) / 50);
    buddy.style.setProperty("--drift", `${secs}s`);
    buddy.style.setProperty("--bx", `${nx}px`);
    buddy.style.setProperty("--by", `${ny}px`);
    buddy.classList.toggle("is-east", nx > area.clientWidth / 2);
    buddy.classList.toggle("is-high", ny < 120);
    x = nx;
    y = ny;
    if (!reducedMotion.matches) setTimeout(drift, (first ? 2500 : secs * 1000) + 1000 + Math.random() * 3000);
  };
  drift(true);
}

function initBuddy() {
  if (!BEAR) return;
  initDrift();
  BEAR.addEventListener("click", () => {
    say(TIPS[tip]);
    tip = (tip + 1) % TIPS.length;
  });
  const greet = () => {
    if (document.documentElement.classList.contains("is-booting")) setTimeout(greet, 400);
    else setTimeout(() => say(greeting(), 6000), 600);
  };
  greet();
}

/* ------------------------------------------------------------- copy email */

function initCopyEmail() {
  document.querySelectorAll("a[data-copyable]").forEach((link) => {
    const address = link.getAttribute("href").replace(/^mailto:/i, "");
    const item = link.closest(".contact__item");
    if (!address || !item) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "contact__copy";
    button.textContent = "Copy";
    button.setAttribute("aria-label", `Copy email address ${address}`);

    let timer = null;
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(address);
      } catch {
        return;
      }
      button.dataset.state = "copied";
      button.textContent = "Copied ✓";
      say("Copied! Talk soon.");
      clearTimeout(timer);
      timer = setTimeout(() => {
        delete button.dataset.state;
        button.textContent = "Copy";
      }, 2500);
    });

    item.appendChild(button);
  });
}

/* ------------------------------------------------------------------- init */

if (SCREEN && TASKS && START && START_MENU && WINS.length > 0) {
  WINS.forEach((win) => {
    win.tabIndex = -1;
    addMinimize(win);
  });
  initBoot();
  initLinks();
  initDrag();
  initStart();
  initClock();
  initBuddy();
  initKeyboard();
  initCopyEmail();

  const deepId = hashId(location.hash);
  const deepLink = winFor(deepId);
  const works = document.getElementById("works");
  const hello = document.getElementById("hello");
  if (works && works !== deepLink) openWin(works, { focus: false });
  if (hello && (!deepLink || compact.matches === false)) openWin(hello, { focus: false });
  if (deepLink) openWin(deepLink, { target: document.getElementById(deepId) });
  else history.replaceState(null, "", location.pathname + location.search);
  buddyReady = true;
}
