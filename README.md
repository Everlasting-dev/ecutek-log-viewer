# EcuTek Log Reader (Client‑side, Mobile‑aware)

Fast, zero‑backend viewer for EcuTek (and generic CSV/TXT) logs. Parses locally in the browser and renders Plotly charts. Includes a **Compare** mode with multi‑Y, per‑series offset, enable/disable, and color control. Session cache lets you switch pages without re‑uploading.

## Features
- **100% client‑side**: Files never leave the device; works offline after first load.
- **Auto plot** (index.html): plots every numeric column vs **Time**.
- **Compare mode** (compare.html): pick **X = Time/RPM**, up to **5 Y** series, per‑series **offset step**, color picker, quick enable/disable, smart auto‑select (boost/AFR/throttle/etc.).
- **Session cache**: log is kept in `sessionStorage` across pages.
- **Robust CSV parser**: comment lines starting with `#` ignored, numeric detection, basic NaN handling.
- **Responsive UI**: mobile‑friendly layout, Plotly resizing.

## Tech Stack
- **Plotly.js** for charts (CDN).
- **PapaParse** for CSV (CDN, used by HTML pages; parser also provided in `parser.js`).
- Vanilla JS + CSS (no build step).

## Repo Layout
```
/index.html      # Multi-plot view (auto plot vs Time)
/compare.html    # Compare view (X: Time/RPM; 5 Y slots; offsets, colors)
/style.css       # Dark UI
/app.js          # Index page logic (cache, parse, auto-plot)
/compare.js      # Compare page logic (UI, offsets, colors, cache)
/parser.js       # Shared CSV helpers: parseCSV, findTimeIndex, findRpmIndex, numericColumns
/main.js         # Legacy combined view (single upload → multi+compare tabs)
```
CDN deps pinned:
- Plotly: `https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js`
- PapaParse: `https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js`

## CSV Requirements
- Comma‑separated header row.
- A column containing `"time"` (case‑insensitive) for auto‑plots; Compare can also use `"RPM"`/`"Engine Speed"` as X.
- Lines starting with `#` are ignored.

## Quick Start
- Open **index.html** or **compare.html** directly in a modern browser (Chrome/Edge/Safari/Firefox).
- Drag‑drop a `.csv`/`.txt` log or **Choose File**.
- **Compare**: select X, enable Y slots, adjust offsets/colors → **Generate Plot**.

### Local static server (recommended)
```bash
# Python 3
python -m http.server 8080
# or
npx http-server -p 8080
```
Visit `http://localhost:8080`.

## Troubleshooting
- **“No 'Time' column found.”** → Ensure header contains a time‑like column (e.g., `Time`, `Timestamp`).
- **Flat/empty lines** → Non‑numeric cells become `NaN` and are skipped; verify delimiters are commas.
- **Mobile rendering** → Use the compare view for fewer traces; device RAM/GPU limits Plotly point count.

## Development Notes
- `parseCSV`: filters `#` comments, enforces equal column counts, returns `{ headers, cols, timeIdx }`.
- Plot downsampling hook exists in `app.js` (`strideDownsample`); wire it if extremely large logs are used.
- Session cache keys: `csvText`, `csvName`, `csvSize`.

## Roadmap
- Optional streaming parser for very large logs.
- Saved presets (per‑vehicle), color/axis templates.
- Zoom‑linked subplots, derivative channels (d/dt, smoothing).
- PWA install + offline bundle.

## License
MIT (adjust to your needs).

---

# Using GitHub Effectively for this Project

## Core
- **Issues**: one bug/feature per issue. Use labels: `bug`, `enhancement`, `mobile`, `parser`, `ui`, `perf`.
- **Milestones**: group issues for releases (e.g., `v0.2 Compare polish`).
- **Projects (v2)**: Kanban for Backlog → In‑Progress → Done; auto‑add new issues/PRs.

## Reviews & Ownership
- **CODEOWNERS**: auto‑request reviews on `/parser.js`, `/compare.js`, `/app.js`.
  ```
  # .github/CODEOWNERS
  /parser.js   @yourteam/parser
  /compare.js  @yourteam/frontend
  /app.js      @yourteam/frontend
  ```
- **PR templates**: require repro CSV and screenshots.
  ```md
  <!-- .github/PULL_REQUEST_TEMPLATE.md -->
  ## Summary
  ## Test Plan
  - [ ] CSV attached
  - [ ] Before/After screenshots
  ## Risk
  ```
- **Issue templates** (bug/feature) with required fields (browser, device, CSV header sample).

## CI/CD with GitHub Actions
- **CI**: lint and basic type checks (ESLint + TypeScript `--noEmit` via JSDoc types if desired).
  ```yaml
  # .github/workflows/ci.yml
  name: CI
  on: [push, pull_request]
  jobs:
    lint:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/setup-node@v4
          with: { node-version: '20' }
        - run: npm i -D eslint
        - run: npx eslint .
  ```

- **Pages Deploy**: buildless static deploy from `main` → `gh-pages` (or Pages from `/`).
  ```yaml
  # .github/workflows/pages.yml
  name: Deploy Pages
  on:
    push:
      branches: [ main ]
  permissions:
    contents: read
    pages: write
    id-token: write
  jobs:
    deploy:
      environment:
        name: github-pages
        url: ${{ steps.deployment.outputs.page_url }}
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v4
        - uses: actions/configure-pages@v5
        - uses: actions/upload-pages-artifact@v3
          with: { path: '.' }
        - id: deployment
          uses: actions/deploy-pages@v4
  ```
  - Enable **Settings → Pages → Source: GitHub Actions**.
  - Result: hosted viewer at `<user>.github.io/<repo>/`.

## Automation & Security
- **Dependabot** (weekly) for CDN pinning notice + dev deps.
  ```yaml
  # .github/dependabot.yml
  version: 2
  updates:
    - package-ecosystem: "npm"
      directory: "/"
      schedule: { interval: "weekly" }
  ```
- **CodeQL** (JS): static analysis for client code.
- **Branch protection**: require passing CI + 1 review on `main`.

## Docs & Support
- **Wiki** or `/docs`: tuning guides, CSV conventions.
- **Discussions**: user Q&A, feature proposals with sample logs (scrub VINs).
- **Releases**: tag `v0.x`, attach sample CSV and changelog. Consumers can pin to a release.

## How to Work Day‑to‑Day
1. Create an **issue** per task; link PR.
2. Cut a small **PR** (≤300 lines); include CSV and screenshots.
3. CI must pass; review via CODEOWNERS.
4. Merge → Pages auto‑deploy. Test on mobile.
5. Close issue, update Project board.

---

### Snippets you can copy now
- Add labels you’ll use: `bug`, `enhancement`, `docs`, `ux`, `mobile`, `perf`, `parser`, `plotly`, `good first issue`.
- Protect `main`: require PR, passing `CI`, and review from code owners.
- Enable **Pages**. Share the URL with testers.

