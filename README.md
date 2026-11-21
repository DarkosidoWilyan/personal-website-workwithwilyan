# workwithwilyan — personal portfolio

Single-page portfolio built with the [Hallmark](https://github.com/Nutlope/hallmark) skill.
Hand-written HTML + CSS + ES modules. No framework, no bundler, no `npm install`.

**You only ever edit `content.json`.** The HTML and CSS never change when you
add a project, a skill, a timeline entry, or a link.

## Files

| File | What it is | Edit it? |
| --- | --- | --- |
| `content.json` | All repeating content (stats, quests, map, contact) | **Yes — the only file you edit** |
| `template.html` | One-off chrome: desktop windows, old computer, loading window, folders shell | Rarely |
| `build.js` | Zero-dependency Node build script | No |
| `tokens.css` | Design tokens: palette, fonts, spacing, motion | Rarely |
| `style.css` | Page styles (imports `tokens.css`) | Rarely |
| `script.js` | Progressive enhancement (window router, keyboard navigation, loading window, copy-email) | Rarely |
| `index.html` | **Build output. Committed. Deploy this.** | Never — overwritten |

## How to add a quest

Open `content.json` and add an entry to the `quests` array:

```json
{
  "id": "my-quest",
  "title": "The Quest Title",
  "status": "complete",
  "era": "Company · Role",
  "objective": "One or two sentences. What you built, for whom, what changed.",
  "party": "Led end-to-end",
  "loot": ["Skill", "Domain", "Method"],
  "xp": "~IDR 1.6 billion saved in annual operating cost",
  "link": ""
}
```

Then run `node build.js`. That's it — the work appears as a new numbered
folder in the **My Works** window and gets its own Note Pad window at `#work-<id>`.

Rules of the schema:

- **Required per quest:** `title`, `objective`. Everything else is optional.
- Optional fields left out (or set to `""`) render as *absent* — no empty rows,
  no `undefined` anywhere.
- An **empty array hides its whole section** (`"quests": []` removes the Quest
  Log section, header included).
- Everything is HTML-escaped at build time. Apostrophes, `&`, `<`, `>` are safe.
- `stats[].level` must be an integer **1–5** (rendered as pips, never percentages).
- Hand-editing is tolerated: a UTF-8 BOM and trailing commas are stripped
  before parsing (strict JSON is still recommended).

The full schema, section by section:

```jsonc
{
  "player": {
    "name": "Mohammad Wildan Yanuar",   // required — title screen
    "class": "Product Manager",         // required — title screen
    "tagline": "…",                     // optional — hidden if absent
    "location": "Jakarta, Indonesia",   // optional — hidden if absent
    "resumeUrl": "/resume.pdf",         // optional — hides the skip link if absent
    "available": true,                  // optional — the availability flag
    "availabilityNote": "Jakarta — hybrid, remote, or on-site" // optional, shown when available
  },
  "stats": [                            // empty array → section hidden
    { "skill": "Product Management", "level": 4, "note": "optional" }
  ],
  "quests": [                           // empty array → section hidden
    {
      "title": "…", "objective": "…",   // required
      "id": "accounting-migration",     // optional — deep-link anchor: #quest-accounting-migration
      "status": "complete",             // optional — chip on the card ("complete" renders gold)
      "era": "ALAMI · Associate Product Manager", // optional — small line under the title
      "party": "Led end-to-end",        // optional — string OR array of strings
      "loot": ["…"],                    // optional — array of tag strings
      "xp": "…",                        // optional — outcome text (or a number, rendered as "N XP")
      "link": ""                        // optional — title becomes a link when non-empty
    }
  ],
  "worldMap": [                         // empty array → section hidden
    { "year": "2022", "title": "…", "note": "optional" }
  ],
  "currentQuest": {                     // delete the whole key → section hidden
    "title": "…", "note": "…"           // required ("description" also accepted for note)
  },
  "languages": [                        // empty array → section hidden
    { "name": "Indonesian", "level": "Native" } // both required; level is free text
  ],
  "contact": [                          // empty array → signboard hidden
    { "label": "Email", "url": "mailto:you@example.com", "value": "optional display text" }
  ]
}
```

Notes:

- `contact[].url` — when `value` is absent, display text is derived from the
  URL (`mailto:` shows the address; web URLs show the bare domain + path).
- A `mailto:` contact row automatically gets a **Copy** button (added by
  `script.js`; no-JS visitors simply get the link).
- Only `http:`, `https:`, `mailto:`, `tel:` and relative URLs are allowed in
  `url` / `link` fields. Anything else is dropped with a warning at build time.
- `worldMap[].year` may be a string or a number.
- The availability flag lives on `player.available`; `currentQuest.available`
  is accepted as a fallback.

## How to rebuild

You need Node.js (any recent version). No install step, no dependencies.

```sh
node build.js
```

On success it prints a summary and rewrites `index.html`.
On invalid content it **fails loudly** and names the offending field:

```
build failed: content.json has 1 problem(s):

  content.json: stats[2].level — must be an integer 1–5, got 7
```

Commit both `content.json` and the regenerated `index.html`.

## How to deploy

The site is fully static. `index.html` is the whole site — it opens correctly
from any document root. Upload these files to your VPS:

```
index.html  style.css  tokens.css  script.js  (+ resume.pdf if you link one)
```

Example nginx block:

```nginx
server {
    listen 80;
    server_name workwithwilyan.example.com;
    root /var/www/workwithwilyan;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

From your machine, a plain copy is enough:

```sh
scp index.html style.css tokens.css script.js resume.pdf \
  you@your-vps:/var/www/workwithwilyan/
```

`template.html`, `build.js`, and `content.json` do **not** need to be on the
server — they're the source, not the site. (Keeping them in the repo is still
a good idea.)

## Design system

The site is a muted retro desktop: cream dotted paper, Win95-style
windows with chunky ink outlines and cool gradient title bars, an old
computer, planets and sparkles. A "loading, hang tight!" window shows once per
session, then the home screen shows a **Hello World!** window, About/Contact
keycaps and a **My Works** window with one folder per work. Clicking a folder
(or ←/→ + Enter, or number keys) opens that work as a Note Pad window; ✕ or Esc
closes it. Every folder is a plain `#anchor` link, so without JavaScript the
windows simply stack.

On screen, quest fields are labelled for a portfolio: `party` → **Role**,
`loot` → **Skills**, `xp` → **Impact**. `stats`, `worldMap`, `languages` and
`currentQuest` render in the **About me** window; `contact` in **Hello!**.

Locked in `tokens.css`: paper/window/ink surfaces, a muted palette (blue,
slate, teal, sage, orange, sand, butter) and its gradients, two font families
(Silkscreen for window chrome and buttons, Space Mono for reading), a 4pt
spacing scale. All motion (loading bar, floating planets, twinkling sparkles)
respects `prefers-reduced-motion`; there is no audio anywhere.
