#!/usr/bin/env node
"use strict";

/*
 * build.js — zero-dependency static build for the portfolio.
 *
 * Reads content.json + template.html, writes index.html.
 * Run: node build.js
 *
 * Rules (see README.md):
 *  - Every interpolated value is HTML-escaped.
 *  - Empty / missing optional fields render as absent.
 *  - Empty arrays hide their whole section.
 *  - Validation fails loudly, naming the offending field.
 *  - Hand-editing tolerated: UTF-8 BOM and trailing commas are stripped.
 */

const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const CONTENT_PATH = path.join(ROOT, "content.json");
const TEMPLATE_PATH = path.join(ROOT, "template.html");
const OUTPUT_PATH = path.join(ROOT, "index.html");

/* ---------------------------------------------------------------- escaping */

function esc(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const SAFE_SCHEMES = new Set(["http", "https", "mailto", "tel"]);

/** Returns an escaped href, or null (with a warning) for unsafe schemes. */
function escAttrUrl(value, field) {
  const raw = String(value).trim();
  const schemeMatch = raw.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (!SAFE_SCHEMES.has(scheme)) {
      warn(`${field}: dropped unsafe URL scheme "${scheme}:" (${raw})`);
      return null;
    }
  }
  return esc(raw);
}

/* ----------------------------------------------------------------- logging */

const warnings = [];
function warn(msg) {
  warnings.push(`  warning: ${msg}`);
}

/* -------------------------------------------------------------- validation */

const errors = [];
function err(field, msg) {
  errors.push(`  content.json: ${field} — ${msg}`);
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function optString(field, v) {
  if (v !== undefined && v !== null && typeof v !== "string") {
    err(field, `expected a string, got ${JSON.stringify(v)}`);
    return false;
  }
  return true;
}

function optStringArray(field, v) {
  if (v === undefined || v === null) return true;
  if (!Array.isArray(v)) {
    err(field, `expected an array of strings, got ${JSON.stringify(v)}`);
    return false;
  }
  v.forEach((item, i) => {
    if (!isNonEmptyString(item)) {
      err(`${field}[${i}]`, `expected a non-empty string, got ${JSON.stringify(item)}`);
    }
  });
  return true;
}

function validateArraySection(name, value, checkItem) {
  if (value === undefined || value === null) return; // absent = hidden section
  if (!Array.isArray(value)) {
    err(name, `expected an array, got ${JSON.stringify(value)}`);
    return;
  }
  value.forEach((item, i) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      err(`${name}[${i}]`, "expected an object");
      return;
    }
    checkItem(item, i);
  });
}

function validate(content) {
  // player — required
  if (typeof content.player !== "object" || content.player === null) {
    err("player", "missing (required object with name, class)");
  } else {
    const p = content.player;
    if (!isNonEmptyString(p.name)) err("player.name", "missing (required non-empty string)");
    if (!isNonEmptyString(p.class)) err("player.class", "missing (required non-empty string)");
    optString("player.tagline", p.tagline);
    optString("player.location", p.location);
    optString("player.resumeUrl", p.resumeUrl);
    optString("player.availabilityNote", p.availabilityNote);
    if (p.available !== undefined && p.available !== null && typeof p.available !== "boolean") {
      err("player.available", `must be true or false, got ${JSON.stringify(p.available)}`);
    }
  }

  // stats[]
  validateArraySection("stats", content.stats, (s, i) => {
    if (!isNonEmptyString(s.skill)) err(`stats[${i}].skill`, "missing (required non-empty string)");
    if (!Number.isInteger(s.level) || s.level < 1 || s.level > 5) {
      err(`stats[${i}].level`, `must be an integer 1–5, got ${JSON.stringify(s.level)}`);
    }
    optString(`stats[${i}].note`, s.note);
  });

  // quests[]
  validateArraySection("quests", content.quests, (q, i) => {
    if (!isNonEmptyString(q.title)) err(`quests[${i}].title`, "missing (required non-empty string)");
    // objective is required UNLESS the quest gives a full STAR breakdown instead.
    const hasStar = ["situation", "task", "action", "result"].every((k) => isNonEmptyString(q[k]));
    if (!hasStar) {
      if (!isNonEmptyString(q.objective)) {
        err(`quests[${i}].objective`, "missing (required unless situation/task/action/result are all provided)");
      }
    } else {
      optString(`quests[${i}].objective`, q.objective);
    }
    optString(`quests[${i}].situation`, q.situation);
    optString(`quests[${i}].task`, q.task);
    optString(`quests[${i}].action`, q.action);
    optString(`quests[${i}].result`, q.result);
    if (q.id !== undefined && q.id !== null && q.id !== "") {
      if (typeof q.id !== "string" || !/^[a-zA-Z0-9_-]+$/.test(q.id)) {
        err(`quests[${i}].id`, `letters, numbers, hyphens and underscores only, got ${JSON.stringify(q.id)}`);
      }
    }
    optString(`quests[${i}].status`, q.status);
    optString(`quests[${i}].era`, q.era);
    // party: non-empty string OR array of non-empty strings
    if (q.party !== undefined && q.party !== null && q.party !== "") {
      if (typeof q.party === "string") {
        if (!isNonEmptyString(q.party)) err(`quests[${i}].party`, "expected a non-empty string");
      } else {
        optStringArray(`quests[${i}].party`, q.party);
      }
    }
    optStringArray(`quests[${i}].loot`, q.loot);
    // xp: outcome text (string) or a number — empty string renders absent
    if (q.xp !== undefined && q.xp !== null && q.xp !== "") {
      if (typeof q.xp !== "string" && typeof q.xp !== "number") {
        err(`quests[${i}].xp`, `expected a string or number, got ${JSON.stringify(q.xp)}`);
      }
    }
    optString(`quests[${i}].link`, q.link);
  });

  // worldMap[]
  validateArraySection("worldMap", content.worldMap, (m, i) => {
    if (!isNonEmptyString(m.year) && typeof m.year !== "number") {
      err(`worldMap[${i}].year`, "missing (required string or number)");
    }
    if (!isNonEmptyString(m.title)) err(`worldMap[${i}].title`, "missing (required non-empty string)");
    optString(`worldMap[${i}].note`, m.note);
  });

  // currentQuest — optional object; note (or description) required when present
  if (content.currentQuest !== undefined && content.currentQuest !== null) {
    const c = content.currentQuest;
    if (typeof c !== "object" || Array.isArray(c)) {
      err("currentQuest", "expected an object");
    } else {
      if (!isNonEmptyString(c.title)) err("currentQuest.title", "missing (required non-empty string)");
      if (!isNonEmptyString(c.note) && !isNonEmptyString(c.description)) {
        err("currentQuest.note", "missing (required non-empty string)");
      }
      if (c.available !== undefined && c.available !== null && typeof c.available !== "boolean") {
        err("currentQuest.available", `must be true or false, got ${JSON.stringify(c.available)}`);
      }
    }
  }

  // languages[]
  validateArraySection("languages", content.languages, (l, i) => {
    if (!isNonEmptyString(l.name)) err(`languages[${i}].name`, "missing (required non-empty string)");
    if (!isNonEmptyString(l.level)) err(`languages[${i}].level`, "missing (required non-empty string, e.g. \"Native\")");
  });

  // contact[]
  validateArraySection("contact", content.contact, (c, i) => {
    if (!isNonEmptyString(c.label)) err(`contact[${i}].label`, "missing (required non-empty string)");
    if (!isNonEmptyString(c.url) && !isNonEmptyString(c.href)) {
      err(`contact[${i}].url`, "missing (required non-empty string)");
    }
    optString(`contact[${i}].value`, c.value);
  });
}

/* ---------------------------------------------------------------- getters */

function get(obj, dottedPath) {
  return dottedPath.split(".").reduce((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return acc[key];
  }, obj);
}

/* --------------------------------------------------------------- renderers */

/** Stable view id for a work: "work-<id>", or "work-<n>" when id is absent. */
function workId(q, i) {
  return isNonEmptyString(q.id) ? `work-${q.id}` : `work-${i + 1}`;
}

function renderStat(s) {
  const bar = "█".repeat(s.level) + "░".repeat(5 - s.level);
  const note = isNonEmptyString(s.note)
    ? `\n          <span class="stat__note">${esc(s.note)}</span>`
    : "";
  return [
    `        <li class="stat">`,
    `          <span class="stat__name">${esc(s.skill)}</span>`,
    `          <span class="stat__bar" role="img" aria-label="Level ${s.level} of 5">${bar}</span>${note}`,
    `        </li>`,
  ].join("\n");
}

/** Main-menu row for a work. */
function renderQuestMenu(q, i) {
  const id = workId(q, i);
  const era = isNonEmptyString(q.era)
    ? `\n            <span class="menu__meta">${esc(q.era)}</span>`
    : "";
  return [
    `        <li>`,
    `          <a class="menu__item" href="#${esc(id)}" data-view="${esc(id)}">`,
    `            <span class="menu__key">${i + 1}</span>`,
    `            <span class="menu__label">${esc(q.title)}</span>${era}`,
    `          </a>`,
    `        </li>`,
  ].join("\n");
}

/** Full-screen document for a work. */
function renderQuest(q, i) {
  const id = workId(q, i);
  const fileName = (isNonEmptyString(q.id) ? q.id : `work-${i + 1}`).toUpperCase();

  const eraBits = [];
  if (isNonEmptyString(q.era)) eraBits.push(esc(q.era));
  if (isNonEmptyString(q.status)) eraBits.push(`<span class="doc__status">[${esc(q.status.toUpperCase())}]</span>`);
  const era = eraBits.length > 0
    ? `\n        <p class="doc__era">${eraBits.join(" ")}</p>`
    : "";

  const hasStar = ["situation", "task", "action", "result"].every((k) => isNonEmptyString(q[k]));
  let body;
  if (hasStar) {
    const rows = [
      ["Situation", q.situation],
      ["Task", q.task],
      ["Action", q.action],
      ["Result", q.result],
    ].map(([label, text]) =>
      `          <div class="doc__row">\n` +
      `            <dt>${label}</dt>\n` +
      `            <dd>${esc(text)}</dd>\n` +
      `          </div>`
    );
    body = `\n        <dl class="doc__star">\n${rows.join("\n")}\n        </dl>`;
  } else {
    body = `\n        <p class="doc__objective">${esc(q.objective)}</p>`;
  }

  const metaRows = [];
  const hasParty =
    isNonEmptyString(q.party) || (Array.isArray(q.party) && q.party.length > 0);
  if (hasParty) {
    const partyText = Array.isArray(q.party) ? q.party.map(esc).join(" · ") : esc(q.party);
    metaRows.push(
      `          <div class="doc__row">\n` +
      `            <dt>Role</dt>\n` +
      `            <dd>${partyText}</dd>\n` +
      `          </div>`
    );
  }
  if (Array.isArray(q.loot) && q.loot.length > 0) {
    const tags = q.loot.map((item) => `              <li class="tag">${esc(item)}</li>`).join("\n");
    metaRows.push(
      `          <div class="doc__row">\n` +
      `            <dt>Skills</dt>\n` +
      `            <dd>\n              <ul class="tags">\n${tags}\n              </ul>\n            </dd>\n` +
      `          </div>`
    );
  }
  if (isNonEmptyString(q.xp) || typeof q.xp === "number") {
    const xpText =
      typeof q.xp === "number" ? `${Math.round(q.xp).toLocaleString("en-US")} XP` : q.xp;
    metaRows.push(
      `          <div class="doc__row">\n` +
      `            <dt>Impact</dt>\n` +
      `            <dd class="doc__impact">${esc(xpText)}</dd>\n` +
      `          </div>`
    );
  }
  const meta = metaRows.length > 0
    ? `\n        <dl class="doc__meta">\n${metaRows.join("\n")}\n        </dl>`
    : "";

  const href = isNonEmptyString(q.link) ? escAttrUrl(q.link, "quests[].link") : null;
  const link = href
    ? `\n          <a class="btn" href="${href}" target="_blank" rel="noopener">Open project ↗</a>`
    : "";

  return [
    `      <article class="view doc" id="${esc(id)}" aria-labelledby="${esc(id)}-title">`,
    `        <p class="doc__path">C:\\WORKS\\${esc(fileName)}.TXT</p>`,
    `        <h2 class="doc__title" id="${esc(id)}-title" tabindex="-1">${esc(q.title)}</h2>${era}${body}${meta}`,
    `        <p class="doc__actions">`,
    `          <a class="btn btn--back" href="#menu">&lt; Back to menu <kbd>Esc</kbd></a>${link}`,
    `        </p>`,
    `      </article>`,
  ].join("\n");
}

function renderMapNode(m) {
  const note = isNonEmptyString(m.note)
    ? `\n            <span class="log__note">${esc(m.note)}</span>`
    : "";
  return [
    `        <li class="log__row">`,
    `          <span class="log__year">${esc(m.year)}</span>`,
    `          <span class="log__body">`,
    `            <span class="log__title">${esc(m.title)}</span>${note}`,
    `          </span>`,
    `        </li>`,
  ].join("\n");
}

function renderCurrentQuest(c, player) {
  // Availability flag lives on player; currentQuest.available is the fallback.
  const available =
    typeof player.available === "boolean"
      ? player.available
      : typeof c.available === "boolean"
        ? c.available
        : null;
  let status = "";
  if (available !== null) {
    const stateClass = available ? "status status--open" : "status status--closed";
    const stateText = available ? "Available for new work" : "Not available right now";
    const note =
      available && isNonEmptyString(player.availabilityNote)
        ? ` <span class="status__note">— ${esc(player.availabilityNote)}</span>`
        : "";
    status = `        <p class="${stateClass}"><span class="status__dot" aria-hidden="true"></span>${stateText}${note}</p>\n`;
  }
  const body = isNonEmptyString(c.note) ? c.note : c.description;
  return [
    `${status}        <p class="current"><span class="current__label">Now building:</span> <span class="current__title">${esc(c.title)}</span></p>`,
    `        <p class="current__desc">${esc(body)}</p>`,
  ].join("\n");
}

function renderLanguage(l) {
  return [
    `        <li class="lang">`,
    `          <span class="lang__name">${esc(l.name)}</span>`,
    `          <span class="lang__level">${esc(l.level)}</span>`,
    `        </li>`,
  ].join("\n");
}

/** Derives display text for a contact row when `value` is absent. */
function contactDisplayValue(rawUrl) {
  const raw = String(rawUrl).trim();
  if (/^mailto:/i.test(raw)) return raw.replace(/^mailto:/i, "");
  if (/^tel:/i.test(raw)) return raw.replace(/^tel:/i, "");
  return raw.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

function renderContact(c) {
  const rawUrl = isNonEmptyString(c.url) ? c.url : c.href;
  const href = escAttrUrl(rawUrl, "contact[].url");
  const display = isNonEmptyString(c.value) ? c.value : contactDisplayValue(rawUrl);
  if (!href) {
    // Unsafe URL dropped: render the label as text, never a broken link.
    return [
      `        <li class="contact__item">`,
      `          <span class="contact__label">${esc(c.label)}</span>`,
      `          <span class="contact__value">${esc(display)}</span>`,
      `        </li>`,
    ].join("\n");
  }
  const isMail = href.startsWith("mailto:");
  const copyable = isMail ? ` data-copyable` : "";
  const external = /^https?:/i.test(href) ? ` target="_blank" rel="noopener"` : "";
  return [
    `        <li class="contact__item">`,
    `          <span class="contact__label">${esc(c.label)}</span>`,
    `          <a class="contact__link" href="${href}"${copyable}${external}>${esc(display)}</a>`,
    `        </li>`,
  ].join("\n");
}

/* ------------------------------------------------------------------ engine */

function build(template, content) {
  const computed = {
    "meta.description": isNonEmptyString(get(content, "player.tagline"))
      ? get(content, "player.tagline")
      : `${get(content, "player.name") || ""} — ${get(content, "player.class") || ""}`.trim(),
    year: String(new Date().getFullYear()),
    worksCount: String((content.quests || []).length),
  };

  let html = template;

  // 1. Optional regions: kept only when the value is a non-empty string.
  html = html.replace(
    /<!--\s*@optional:([\w.]+)\s*-->([\s\S]*?)<!--\s*\/@optional:\1\s*-->/g,
    (match, pathExpr, inner) => {
      const value = get(content, pathExpr);
      return isNonEmptyString(value) ? inner : "";
    }
  );

  // 2. Sections. Empty / missing arrays remove the whole marked region.
  html = html.replace(
    /<!--\s*@section:(\w+)\s*-->([\s\S]*?)<!--\s*\/@section:\1\s*-->/g,
    (match, key, inner) => {
      const value = content[key];

      if (key === "currentQuest") {
        if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
        return inner.replace(/<!--\s*@slot:currentQuest\s*-->/g, () =>
          renderCurrentQuest(value, content.player || {})
        );
      }

      if (!Array.isArray(value) || value.length === 0) return "";
      const renderItem = ITEM_RENDERERS[key];
      if (!renderItem) {
        warn(`@section:${key} has no item renderer — section dropped`);
        return "";
      }
      // `@items:key` uses the key's renderer; `@items:key.variant` uses "key.variant".
      return inner.replace(
        new RegExp(`<!--\\s*@items:${key}(?:\\.(\\w+))?\\s*-->`, "g"),
        (m, variant) => {
          const render = variant ? ITEM_RENDERERS[`${key}.${variant}`] : renderItem;
          if (!render) {
            warn(`@items:${key}.${variant} has no item renderer — dropped`);
            return "";
          }
          return value.map(render).join("\n");
        }
      );
    }
  );

  // 3. Scalar tokens — escaped, always.
  html = html.replace(/{{\s*([\w.]+)\s*}}/g, (match, pathExpr) => {
    if (Object.prototype.hasOwnProperty.call(computed, pathExpr)) {
      return esc(computed[pathExpr]);
    }
    const value = get(content, pathExpr);
    if (value === undefined || value === null) {
      warn(`token {{${pathExpr}}} resolved to nothing — rendered empty`);
      return "";
    }
    return esc(value);
  });

  return html;
}

const ITEM_RENDERERS = {
  stats: renderStat,
  quests: renderQuest,
  "quests.menu": renderQuestMenu,
  worldMap: renderMapNode,
  languages: renderLanguage,
  contact: renderContact,
};

/* --------------------------------------------------------------------- main */

function main() {
  let raw;
  try {
    raw = fs.readFileSync(CONTENT_PATH, "utf8");
  } catch (e) {
    console.error(`build failed: cannot read content.json (${e.message})`);
    process.exit(1);
  }

  let content;
  try {
    // Hand-editing tolerance: strip UTF-8 BOM and trailing commas.
    content = JSON.parse(
      raw.replace(/^﻿/, "").replace(/,(\s*[}\]])/g, "$1")
    );
  } catch (e) {
    console.error(`build failed: content.json is not valid JSON — ${e.message}`);
    process.exit(1);
  }

  validate(content);
  if (errors.length > 0) {
    console.error(`build failed: content.json has ${errors.length} problem(s):\n`);
    errors.forEach((e) => console.error(e));
    process.exit(1);
  }

  const template = fs.readFileSync(TEMPLATE_PATH, "utf8");
  const html = build(template, content);

  fs.writeFileSync(OUTPUT_PATH, html);

  const counts = [
    `${(content.stats || []).length} stats`,
    `${(content.quests || []).length} quests`,
    `${(content.worldMap || []).length} map nodes`,
    `${(content.languages || []).length} languages`,
    `${(content.contact || []).length} contacts`,
  ].join(" · ");
  console.log(`built index.html (${counts})`);
  warnings.forEach((w) => console.warn(w));
}

main();
