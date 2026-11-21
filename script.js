"use strict";

/*
 * script.js — progressive enhancement for the "old computer" screen.
 * Without JS every view is stacked and the menu links are plain anchors.
 *
 *  - Hash router: #menu, #work-<id>, #about, #contact. One view at a time.
 *  - Keyboard: ↑/↓ move through the menu, Enter opens, Esc goes back,
 *    number keys open a work directly.
 *  - Boot screen once per browser session (skipped for reduced motion).
 *  - Copy button on mailto: contacts; status-bar clock.
 */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const SCREEN = document.getElementById("screen");
const CONTENT = document.getElementById("screen-content");
const PATH = document.getElementById("statusbar-path");
const VIEWS = Array.from(document.querySelectorAll(".view"));
const MENU_ITEMS = Array.from(document.querySelectorAll(".menu__item"));
const WORK_ITEMS = Array.from(document.querySelectorAll("#menu-works .menu__item"));

let lastMenuItem = null;

/* ----------------------------------------------------------------- router */

function viewFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  return VIEWS.find((v) => v.id === id) || VIEWS.find((v) => v.id === "menu");
}

function pathFor(view) {
  const path = view.querySelector(".doc__path");
  return path ? path.textContent.trim() : "C:\\MENU";
}

function show(view, { focus = true } = {}) {
  if (!view) return;
  VIEWS.forEach((v) => v.classList.toggle("is-active", v === view));
  SCREEN.dataset.route = view.id;
  if (PATH) PATH.textContent = pathFor(view);
  CONTENT.scrollTop = 0;

  if (!focus) return;
  if (view.id === "menu") {
    const target = lastMenuItem || MENU_ITEMS[0];
    if (target) target.focus({ preventScroll: true });
  } else {
    const heading = view.querySelector(".doc__title");
    if (heading) heading.focus({ preventScroll: true });
  }
}

function go(id) {
  if (location.hash === `#${id}`) show(viewFromHash());
  else location.hash = id;
}

function initRouter() {
  MENU_ITEMS.forEach((item) => {
    item.addEventListener("click", () => {
      lastMenuItem = item;
    });
  });
  window.addEventListener("hashchange", () => show(viewFromHash()));
  show(viewFromHash(), { focus: location.hash !== "" });
}

/* --------------------------------------------------------------- keyboard */

function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const route = SCREEN.dataset.route;

    if (e.key === "Escape" && route !== "menu") {
      e.preventDefault();
      go("menu");
      return;
    }

    if (route !== "menu") return;

    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const current = MENU_ITEMS.indexOf(document.activeElement);
      const step = e.key === "ArrowDown" ? 1 : -1;
      const next =
        current === -1
          ? step > 0 ? 0 : MENU_ITEMS.length - 1
          : (current + step + MENU_ITEMS.length) % MENU_ITEMS.length;
      const item = MENU_ITEMS[next];
      item.focus();
      item.scrollIntoView({ block: "nearest" });
      return;
    }

    const n = Number.parseInt(e.key, 10);
    if (n >= 1 && n <= WORK_ITEMS.length) {
      e.preventDefault();
      lastMenuItem = WORK_ITEMS[n - 1];
      go(WORK_ITEMS[n - 1].dataset.view);
      return;
    }

    const letter = e.key.toLowerCase();
    const shortcut = MENU_ITEMS.find(
      (item) => item.querySelector(".menu__key")?.textContent.trim().toLowerCase() === letter
    );
    if (shortcut && Number.isNaN(n)) {
      e.preventDefault();
      lastMenuItem = shortcut;
      go(shortcut.dataset.view);
    }
  });
}

/* ------------------------------------------------------------------- boot */

function initBoot() {
  const BOOT_KEY = "wilyan-os-booted";
  let booted = false;
  try {
    booted = sessionStorage.getItem(BOOT_KEY) === "1";
  } catch {}
  if (booted || reducedMotion.matches || location.hash !== "") return;

  SCREEN.classList.add("is-booting");
  const duration = Number.parseFloat(
    getComputedStyle(document.documentElement).getPropertyValue("--dur-boot")
  ) || 1600;

  let timer = null;
  function finish() {
    if (!SCREEN.classList.contains("is-booting")) return;
    clearTimeout(timer);
    SCREEN.classList.remove("is-booting");
    document.removeEventListener("keydown", finish, true);
    SCREEN.removeEventListener("click", finish);
    try {
      sessionStorage.setItem(BOOT_KEY, "1");
    } catch {}
  }

  timer = setTimeout(finish, duration + 300);
  document.addEventListener("keydown", finish, true);
  SCREEN.addEventListener("click", finish);
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
      clearTimeout(timer);
      timer = setTimeout(() => {
        delete button.dataset.state;
        button.textContent = "Copy";
      }, 2500);
    });

    item.appendChild(button);
  });
}

/* ------------------------------------------------------------------ clock */

function initClock() {
  const clock = document.getElementById("clock");
  if (!clock) return;
  const fmt = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
  const tick = () => {
    clock.textContent = fmt.format(new Date());
  };
  tick();
  setInterval(tick, 15000);
}

/* ------------------------------------------------------------------- init */

if (SCREEN && CONTENT) {
  initBoot();
  initRouter();
  initKeyboard();
  initCopyEmail();
  initClock();
}
