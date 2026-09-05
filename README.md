# My Scene

[Play in your browser](https://bensonperry.com/my-scene-web/)

A native browser restoration of the 2003 UK My Scene CD-ROM, made for a nostalgic surprise. It uses the supplied disc's artwork, animation data, voices, music, movies, puzzles, and twelve weekends of content, with new JavaScript gameplay. No Windows executable or emulator runs in the browser.

Create a name to start. Explore by clicking the world, walking with the arrow keys, or using the map. Original in-game controls support mouse and touch; the ⋯ menu exposes additional browser controls. Your phone and to-do list hold the weekend clues; creative jobs pay for shopping. Sound begins after your first interaction.

Games save automatically in this browser. **Save & options → Save file** makes a portable backup; **Import a saved game** restores one on another device. Pictures, designs, and music recordings can be saved and exported. Browser storage is local to the device and site, so export a backup before clearing it.

## Coverage

See the [completed feature checklist](research/FEATURES.md) for the implementation, verification evidence, and source quirks. All discovered activity categories are implemented: the city and apartments, every shop, clothes design, window dressing, music mixing, calls, Zine puzzles and quizzes, camera, scrapbook, and all twelve weekend events.

This is a reconstruction, not the original Windows engine. Controls, dialogs, drawing tools, and some motion/timing are adapted for browsers. The checklist records tested behavior; it does not claim pixel-perfect or instruction-for-instruction parity with the original binary.

See the [fidelity notes and recovered developer-mode shortcuts](research/FIDELITY.md) for the latest original-behavior restoration.

## Run locally

Serve `web/` over HTTP with any static server. For example, from this directory:

```powershell
python -m http.server 4173 --bind 127.0.0.1 --directory web
```

Open `http://127.0.0.1:4173/`. There is no bundler or runtime dependency installation. GitHub Actions validates the data, builds a cache-versioned `dist/` release, and deploys it to GitHub Pages.

## Checks

```powershell
node tools/check_data.mjs
```

This checks all twelve weekends and sixty tasks, all creative briefs, all seventy-two quiz questions, the forty-eight event photos, asset paths, and valid/invalid creative solutions.

The `tools/check_*.js` files are Playwright CLI functions for browser checks. In an isolated browser session, make a fresh profile named `QA`, close its introduction, and run the campaign check. The detail and extras checks use that completed profile as a fixture; the revisions check uses the saved designs from the detail check. Travel and answer discovery use page-side fixtures; purchases, puzzle input, drawing gestures, recording, export/import, and completion use browser controls. The extras check includes an emulated touch device and a failed-request/recovery check. Tests create local QA profiles and ignored artifacts in `.local/`.

Run with the installed Playwright CLI or Codex wrapper, trimming the final JavaScript statement semicolon when passing the function:

```powershell
$Check = (Get-Content -Raw tools/check_campaign.js).Trim().TrimEnd(';')
playwright-cli --session myscene run-code $Check
```

Run `check_details.js`, `check_extras.js`, and `check_revisions.js` the same way, in that order. These scripts exercise user data; use a disposable test browser profile.

## Asset recovery

The original ISO and extracted Windows files are kept out of Git and the deployed site. For a rebuild, extract the supplied disc into `.local/disc/` (containing `MyScene/Resource/`), install Python Pillow and FFmpeg, then run:

```powershell
python tools/extract_resources.py .local/disc .local/resources
python tools/build_assets.py
python tools/build_movies.py
node tools/check_data.mjs
```

The indexed resources are decoded as data; the extraction tools do not execute the original game. `.local/disc/` and `.local/resources/` are ignored rebuild caches. The published assets retain the original creators' artwork and audio; this repository does not grant a license to those materials. Original credits are available in the game.
