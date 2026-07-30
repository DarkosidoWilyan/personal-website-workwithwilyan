"use strict";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ------------------------------------------------------- quest data -------- */

const QUEST_DATA = (() => {
  const el = document.getElementById("quest-data");
  if (!el) return [];
  try { return JSON.parse(el.textContent); } catch { return []; }
})();

/* ------------------------------------------------------- reveal-once ------
 * One orchestrated entrance, staggered by DOM index. One-shot: never
 * re-fires on scroll. Reduced motion: everything is simply visible.
 */
function initReveal() {
  if (reducedMotion.matches) return;

  document.documentElement.classList.add("js");

  const targets = document.querySelectorAll(".header, .quest-menu, .footer");
  targets.forEach((el, i) => {
    el.setAttribute("data-reveal", "");
    el.style.setProperty("--i", String(i));
  });

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
  );

  targets.forEach((el) => observer.observe(el));
}

/* ------------------------------------------------------- copy email -------
 * mailto: rows on the signboard get a COPY button. The label swap is the
 * feedback — no toast. Silent success, visible result.
 */
function initCopyEmail() {
  const links = document.querySelectorAll("a[data-copyable]");

  links.forEach((link) => {
    const address = link.getAttribute("href").replace(/^mailto:/i, "");
    const item = link.closest(".sign__item");
    if (!address || !item) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "sign__copy";
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

/* ------------------------------------------------------ background scene ---
 * 320x200 pixel-art canvas — background image only, full-screen cover.
 */
function initBackground() {
  const canvas = document.getElementById("bg-canvas");
  if (!canvas) return;
  if (reducedMotion.matches) return;

  const ctx = canvas.getContext("2d");
  const BW = 320, BH = 200;
  canvas.width = BW;
  canvas.height = BH;

  const bg = new Image();

  function frame() {
    if (!bg.complete) {
      requestAnimationFrame(frame);
      return;
    }
    ctx.drawImage(bg, 0, 0, BW, BH);
    requestAnimationFrame(frame);
  }
  bg.src = "assets/bg.png";
  requestAnimationFrame(frame);
}

/* --------------------------------------------------------- avatar sprite --
 * Header bear mascot — rotating pixel frames.
 */
function initAvatar() {
  const canvas = document.getElementById("avatar-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const SIZE = 104;
  canvas.width = SIZE;
  canvas.height = SIZE;

  const frames = [];
  for (let i = 0; i < 8; i++) {
    const img = new Image();
    img.src = "assets/bear_spin_" + i + ".png";
    frames.push(img);
  }

  const staticImg = new Image();
  staticImg.src = "assets/bear_static.png";

  function draw(img) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    if (!img || !img.complete || !img.naturalWidth) return;
    const s = Math.min(SIZE / img.naturalWidth, SIZE / img.naturalHeight);
    const w = img.naturalWidth * s;
    const h = img.naturalHeight * s;
    ctx.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  }

  if (reducedMotion.matches) {
    staticImg.onload = () => draw(staticImg);
    return;
  }

  const FRAME_DURATION = 340;

  function frame(t) {
    const idx = Math.floor(t / FRAME_DURATION) % frames.length;
    const f = frames[idx];
    if (f && f.complete && f.naturalWidth) draw(f);
    else if (staticImg.complete && staticImg.naturalWidth) draw(staticImg);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* --------------------------------------------------------- camp scene ------
 * Bottom dock: warrior + bonfire + loot sack idle animation.
 */
function initCamp() {
  if (document.getElementById("camp-canvas")) return;

  const canvas = document.createElement("canvas");
  canvas.id = "camp-canvas";
  canvas.width = 256;
  canvas.height = 128;
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);

  const ctx = canvas.getContext("2d");

  const frames = [];
  for (let i = 0; i < 9; i++) {
    const img = new Image();
    img.src = "assets/camp_" + i + ".png";
    frames.push(img);
  }

  const staticImg = new Image();
  staticImg.src = "assets/camp_static.png";

  if (reducedMotion.matches) {
    staticImg.onload = () => {
      ctx.clearRect(0, 0, 256, 128);
      ctx.drawImage(staticImg, 0, 0);
    };
    return;
  }

  const FRAME_DURATION = 300;

  function frame(t) {
    const idx = Math.floor(t / FRAME_DURATION) % frames.length;
    const f = frames[idx];
    ctx.clearRect(0, 0, 256, 128);
    if (f && f.complete && f.naturalWidth) {
      ctx.drawImage(f, 0, 0);
    } else if (staticImg.complete && staticImg.naturalWidth) {
      ctx.drawImage(staticImg, 0, 0);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

/* --------------------------------------------------------- quest menu ----- */

function initQuestMenu() {
  const list = document.getElementById("menu-list");
  if (!list || QUEST_DATA.length === 0) return;

  QUEST_DATA.forEach((q, i) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "quest-menu__item";
    item.setAttribute("data-quest-index", String(i));
    item.innerHTML =
      '<span class="quest-menu__item-num">' + (i + 1) + '</span>' +
      '<span class="quest-menu__item-title">' + esc(q.title) + '</span>';
    item.addEventListener("click", () => openQuest(i));
    list.appendChild(item);
  });
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ------------------------------------------------------- scroll overlay --- */

let overlayOpen = false;
let animating = false;

const scrollFrames = [];
for (let i = 0; i < 9; i++) {
  const img = new Image();
  img.src = "assets/scroll_open_" + i + ".png";
  scrollFrames.push(img);
}

const OVERLAY = document.getElementById("overlay");
const SCROLL_CANVAS = document.getElementById("scroll-canvas");
const SCROLL_CTX = SCROLL_CANVAS.getContext("2d");
const CLOSE_BTN = document.getElementById("overlay-close");

function openQuest(index) {
  if (overlayOpen || animating) return;
  const q = QUEST_DATA[index];
  if (!q) return;

  OVERLAY.classList.add("overlay--open");
  OVERLAY.classList.remove("overlay--content-shown");
  overlayOpen = true;

  populateContent(q);
  playAnimation(0, 8, function () {
    OVERLAY.classList.add("overlay--content-shown");
    animating = false;
  });
}

function closeOverlay() {
  if (!overlayOpen || animating) return;
  OVERLAY.classList.remove("overlay--content-shown");
  animating = true;
  playAnimation(8, 0, function () {
    OVERLAY.classList.remove("overlay--open");
    overlayOpen = false;
    animating = false;
  });
}

function playAnimation(from, to, done) {
  const step = from <= to ? 1 : -1;
  let current = from;

  SCROLL_CTX.clearRect(0, 0, 128, 128);
  const f = scrollFrames[current];
  if (f.complete) SCROLL_CTX.drawImage(f, 0, 0);

  function tick() {
    current += step;
    if (step > 0 ? current > to : current < to) {
      if (done) done();
      return;
    }
    const f = scrollFrames[current];
    if (f.complete) {
      SCROLL_CTX.clearRect(0, 0, 128, 128);
      SCROLL_CTX.drawImage(f, 0, 0);
    }
    setTimeout(tick, 80);
  }

  if (from !== to) {
    setTimeout(tick, 80);
  } else {
    if (done) done();
  }
}

function populateContent(q) {
  const title = document.getElementById("o-title");
  const era = document.getElementById("o-era");
  const objective = document.getElementById("o-objective");
  const star = document.getElementById("o-star");
  const party = document.getElementById("o-party");
  const tags = document.getElementById("o-tags");
  const xp = document.getElementById("o-xp");

  if (title) title.textContent = q.title;
  if (era) era.textContent = q.era;

  const hasStar = q.situation && q.task && q.action && q.result;

  if (objective) {
    objective.textContent = hasStar ? "" : (q.objective || "");
    objective.style.display = hasStar ? "none" : "";
  }
  if (star) {
    star.hidden = !hasStar;
    if (hasStar) {
      document.getElementById("o-situation").textContent = q.situation;
      document.getElementById("o-task").textContent = q.task;
      document.getElementById("o-action").textContent = q.action;
      document.getElementById("o-result").textContent = q.result;
    }
  }

  if (party) party.textContent = q.party;
  if (tags) {
    tags.innerHTML = "";
    (q.loot || []).forEach(function (t) {
      const li = document.createElement("li");
      li.className = "tag";
      li.textContent = t;
      tags.appendChild(li);
    });
  }
  if (xp) {
    xp.textContent = q.xp || "";
    xp.style.display = q.xp ? "" : "none";
  }
}

function initOverlay() {
  if (!OVERLAY || !SCROLL_CANVAS || !CLOSE_BTN) return;

  CLOSE_BTN.addEventListener("click", closeOverlay);
  OVERLAY.addEventListener("click", function (e) {
    if (e.target === OVERLAY) closeOverlay();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlayOpen) closeOverlay();
  });
}

/* -------------------------------------------------------- init ------------ */

initReveal();
initCopyEmail();
initBackground();
initAvatar();
initCamp();
initQuestMenu();
initOverlay();
