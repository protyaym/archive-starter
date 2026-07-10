# Left history archive — starter scaffold

A working pilot: the Tebhaga movement (1946–47) and its East Bengal continuation,
the Nachole uprising (1949–50), modeled as a small connected graph and rendered
on a map with filters. No build step, no server required to develop, no paid
tool anywhere in the chain.

## Run it

Because `app.js` fetches the JSON files, opening `index.html` directly with
`file://` will hit a browser CORS block in most browsers. Use any tiny local
server instead — all free, no account, no trial:

```
python3 -m http.server 8000
```
then open `http://localhost:8000` in your browser. (Node's `npx serve` works
identically if you'd rather use that.)

## Why these tools specifically

Every piece here is free with no time limit, no feature paywall, and no
account required to use the free tier — the opposite of a 30-day-trial dataset:

- **Leaflet.js** (map) — open source (BSD-2), free forever, no API key.
- **OpenStreetMap tiles** — free, open data, no key for reasonable/low-volume
  use like this. If the site gets real traffic later, self-host tiles or use
  a paid tile provider at that point — not needed yet.
- **Google Fonts** (Fraunces, IBM Plex Sans, IBM Plex Mono) — free, open-licensed
  fonts, no account.
- **Plain JSON in the repo** (data layer) — no database service, so nothing to
  outgrow a free tier on.
- **GitHub + GitHub Pages** (next step, not wired up yet) — free static hosting
  with no time limit, version history for free, and lets other contributors
  submit changes as pull requests instead of you being the only editor.

## The data model

Six files, one per entity type, each a flat JSON array. Every entity has:

- `id` — stable, prefixed by type (`mv_`, `ev_`, `pe_`, `org_`, `tx_`, `pl_`)
- `summary_card` — 1–3 sentences, what the "explorer" audience sees first
- `full_entry` — the longer version, what the "researcher" audience reads
- `relationships` — typed links to other entity ids (`led_by`, `part_of`, `continued_by`...)
- `sources` — never empty; if you don't have a source yet, that's a sign the
  entity isn't ready to publish, not a field to skip
- `contested` (optional) — set `true` when accounts diverge; the UI flags it
  visually rather than picking a number/story and hiding the disagreement
- `editor_note` (optional) — things a future editor needs to check before this
  goes live. Several entities in this pilot have one — that's intentional,
  not a mistake to clean up before you use it as a template.

`app.js` merges all six files into one lookup table by `id` at load time, so
relationships resolve regardless of which file the target lives in. This is
the pattern that scales: adding a `naxalbari.json` later doesn't require
touching the map code at all, only adding `mv_naxalbari` and linking
`pe_majumdar`'s existing `led` relationship to it.

## What this pilot deliberately leaves undone

- `pe_majumdar` (Charu Majumdar) has an editor note pointing forward to
  Naxalbari (1967) without writing that content yet — a template for how to
  extend a person across movements without rewriting their existing entry.
- `org_cpi_undivided` has an editor note flagging the unresolved 1964 CPI/CPI(M)
  split — another deliberate stub, not an oversight.
- Casualty figures for the Nachole clash are not stated as a single number,
  because the sources checked for this scaffold disagree. That's the pattern
  to reuse for Partition: state the disagreement, cite who says what, and let
  `contested: true` do its job — don't average the numbers or pick the one
  that sounds most dramatic.
- Several sources here are exam-prep aggregator sites (ClearIAS, Vajiram &
  Ravi, Insights IAS). They were useful for cross-checking the shape of the
  story quickly, but they are not the standard to publish on. Before this
  goes live, replace/supplement them with the academic literature — Sunil
  Sen's *Agrarian Struggle in Bengal 1946–47* is the standard secondary
  source for Tebhaga specifically.

## Entity pages and editing

**Every entity now has a shareable page.** `entity.html?id=mv_tebhaga` renders
the full record on its own URL -- title, dates, full entry, sources, and
clickable links to every related entity. The inline card in the map/timeline
explorer is still the quick-preview version for browsing (it deliberately
doesn't link relationships away, so exploring the map doesn't keep bouncing
you to other pages); each card now has a "View full page" link at the bottom
that opens the permalink version. Loading logic, colors, and the
relationship/source rendering are shared between both in `js/data.js` --
`app.js` (the explorer) and `js/entity.js` (the permalink page) both call
into it, so there's exactly one place that knows how to read the data.

**Editing right now means editing the JSON files directly** in VS Code --
that's not a placeholder step, it's the actual workflow for a solo maintainer.
To change something: open the relevant file in `data/`, edit the field, save.
To add a new entity: copy the shape of an existing one in the same file, give
it a new unique `id`, fill it in. To link two entities, add a `relationships`
entry with a `type` and a `target` matching another entity's exact `id`.

**Before you commit, run the validator:**

```
node scripts/validate.js
```

It checks every file for the mistakes that are easy to make by hand: duplicate
ids, a relationship pointing at an id that doesn't exist (typo an id and this
catches it), bad coordinates, and missing fields. Warnings (like a missing
source) don't block you -- they're judgment calls -- but errors do, and the
script exits non-zero so you'll notice if you ever wire it into anything
automated later. Get in the habit of running it right before every commit.

## Next steps, roughly in order

1. **Verify and tighten the Tebhaga/Nachole data.** Every `editor_note` in
   these files is a specific, named thing to check. Clear those before adding
   more entities.
2. **Push this to GitHub**, turn on GitHub Pages, and you have a free,
   permanent, shareable URL with full edit history.
3. **Add the map's time-based boundary layer.** Right now all pins sit on a
   modern map regardless of date. [OpenHistoricalMap](https://www.openhistoricalmap.org/)
   is a free, open, crowd-sourced project built exactly for this — geographic
   data tagged with start/end dates, so a British India layer and a
   post-1947 layer are both queryable from the same free source. This is the
   piece that makes the pre/post-1947 boundary redraw you wanted actually
   possible without hand-tracing historical maps yourself.
4. **When you have more than one or two contributors who shouldn't have to
   touch JSON or git**, [Decap CMS](https://decapcms.org/) (formerly Netlify
   CMS) is free, open source, and self-hosted -- it gives contributors a
   form-based editor that writes back to the same JSON files in the GitHub
   repo, no separate database or paid CMS seat involved. It needs a bit more
   setup (an admin page, an OAuth connection to GitHub) than anything so far,
   so it's worth doing only once hand-editing JSON is actually the bottleneck
   -- not before.
5. **Then build Partition.** By that point the `contested` flag, the
   editor-note pattern, and the multi-source citation habit will already be
   proven on Tebhaga/Nachole — which is lower-stakes ground to work the bugs
   out on than the single most contested chapter of the whole archive.
