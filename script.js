"use strict";

/*
 * script.js — progressive enhancement for the pastel retro desktop.
 * Without JS every window is stacked and the folders are plain anchors.
 *
 *  - Hash router: #menu (home), #work-<id>, #about, #contact. One view at a time.
 *    Hashes pointing inside home (e.g. #works) scroll there instead.
 *  - Keyboard: arrows move between folders/keys, Enter opens, Esc closes,
 *    number keys open a work, A / C open About / Contact.
 *  - Loading window once per browser session (skipped for reduced motion).
 *  - Copy button on mailto: contacts.
 */

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

const ROOT = document.getElementById("views");
const VIEWS = Array.from(document.querySelectorAll(".view"));
const WORK_ITEMS = Array.from(document.querySelectorAll("#menu-works .menu__item"));
const KEY_ITEMS = Array.from(document.querySelectorAll(".keys .menu__item"));
const MENU_ITEMS = [...WORK_ITEMS, ...KEY_ITEMS];
const HOME = VIEWS.find((v) => v.id === "menu");

let lastMenuItem = null;

/* ----------------------------------------------------------------- router */

function targetFromHash() {
  const id = decodeURIComponent(location.hash.slice(1));
  return id ? document.getElementById(id) : null;
}

function viewFor(target) {
  if (!target) return HOME;
  return VIEWS.find((v) => v === target || v.contains(target)) || HOME;
}

function show({ focus = true } = {}) {
  const target = targetFromHash();
  const view = viewFor(target);
  const changed = ROOT.dataset.route !== view.id;

  VIEWS.forEach((v) => v.classList.toggle("is-active", v === view));
  ROOT.dataset.route = view.id;
  view.querySelectorAll(".win__body").forEach((b) => (b.scrollTop = 0));

  if (target && target !== view && view.contains(target)) {
    target.scrollIntoView({ block: "start", behavior: reducedMotion.matches ? "auto" : "smooth" });
    const first = target.closest(".win")?.querySelector(".menu__item") || target;
    first.focus({ preventScroll: true });
    return;
  }

  if (changed) window.scrollTo(0, 0);
  if (!focus) return;

  if (view === HOME) {
    const item = lastMenuItem || MENU_ITEMS[0];
    if (item) {
      item.focus({ preventScroll: true });
      item.scrollIntoView({ block: "nearest" });
    }
  } else {
    view.querySelector(".doc__title")?.focus({ preventScroll: true });
  }
}

function go(id) {
  if (location.hash === `#${id}`) show();
  else location.hash = id;
}

function initRouter() {
  MENU_ITEMS.forEach((item) => {
    item.addEventListener("click", () => {
      lastMenuItem = item;
    });
  });
  window.addEventListener("hashchange", () => show());
  show({ focus: location.hash !== "" });
}

/* --------------------------------------------------------------- keyboard */

const NEXT = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

function initKeyboard() {
  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest?.("input, textarea, select")) return;
    const route = ROOT.dataset.route;

    if (e.key === "Escape" && route !== "menu") {
      e.preventDefault();
      go("menu");
      return;
    }

    if (route !== "menu") return;

    if (e.key in NEXT) {
      const current = MENU_ITEMS.indexOf(document.activeElement);
      if (current === -1 && document.activeElement !== document.body) return;
      e.preventDefault();
      const step = NEXT[e.key];
      const next =
        current === -1
          ? step > 0 ? 0 : MENU_ITEMS.length - 1
          : (current + step + MENU_ITEMS.length) % MENU_ITEMS.length;
      MENU_ITEMS[next].focus();
      MENU_ITEMS[next].scrollIntoView({ block: "nearest" });
      return;
    }

    const n = Number.parseInt(e.key, 10);
    if (n >= 1 && n <= WORK_ITEMS.length) {
      e.preventDefault();
      lastMenuItem = WORK_ITEMS[n - 1];
      go(lastMenuItem.dataset.view);
      return;
    }

    const letter = e.key.toLowerCase();
    const shortcut = KEY_ITEMS.find(
      (item) => item.querySelector(".menu__key")?.textContent.trim().toLowerCase() === letter
    );
    if (shortcut) {
      e.preventDefault();
      lastMenuItem = shortcut;
      go(shortcut.dataset.view);
    }
  });
}

/* ------------------------------------------------------------------- boot */

function initBoot() {
  const BOOT_KEY = "wilyan-desktop-booted";
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

/* ------------------------------------------------------------------- init */

if (ROOT && HOME) {
  initBoot();
  initRouter();
  initKeyboard();
  initCopyEmail();
}
