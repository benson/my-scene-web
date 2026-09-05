# My Scene browser restoration — running coverage

The target is the complete set of activities and small interactions from the supplied 2003 UK disc, running as a native browser game. Original artwork, audio, scene definitions, puzzles, and weekend content are recovered from the disc. Native Windows gameplay handlers have been rewritten in JavaScript. A recovered asset is **not** evidence that its interaction works.

Check an item only after implementation and a focused verification. This list is the acceptance checklist, not a promise of exact timing or pixel-for-pixel behavior.

## Recovery

- [x] Inspect both supplied disc images and select My Scene.
- [x] Read and validate the three indexed resource archives: 11,193 entries.
- [x] Recover 2,428 images, 1,217 audio resources, and all original names.
- [x] Decode the three main BAP files and all 316 embedded BAP dictionaries.
- [x] Decode sprite rectangles, multi-part animation frames, positions, and timing.
- [x] Convert images and audio into browser formats.
- [x] Convert and integrate intro, subway, and music movies.

## Game and world

- [x] Sign-in, new/continue games, multiple profiles, safe deletion.
- [x] All 12 weekends, original tasks/clues, character rotation, ending events.
- [x] Wallet, purchases, paid jobs, repeat visits without progress loss.
- [x] Save/resume, including an unfinished activity; save export/import.
- [x] Four city areas, walking, scrolling, map travel, subway transitions.
- [x] Every authored street destination and original store opening rules.
- [x] All street characters, greetings, conversations, flirting/kiss reactions.
- [x] Street birds, incidental animations, and clickable background details.
- [x] Three apartments, intros, idle animations, doors, and music objects.
- [x] Contextual help and idle voice lines.

## Shopping

- [x] Three clothing stores, full inventory, looking/holding/modeling, clues and matching, buy/done.
- [x] Accessories: earrings, hair clips, necklaces, sunglasses; every option and character overlay.
- [x] Accessories: attribute guessing and feedback, retries, purchasing.
- [x] Makeup: every lipstick and eye-shadow option, all three faces, guessing and feedback.
- [x] Gift shop: full inventory, questions/answers, selection puzzle, purchasing.
- [x] Food shop: full inventory, questions/answers, selection puzzle, purchasing.
- [x] CD shop: full inventory, listening, humming clues, selecting and purchasing.

## Creative jobs

- [x] Clothes design: all 16 designs, garment region fills, every fabric.
- [x] Clothes design: every fastener, stamp and trim; placement, erasing and revision.
- [x] Clothes design: original briefs/validation, payment, saving and printing.
- [x] Window dressing: every clothing item, all display spots, every stamp/trim/letter.
- [x] Window dressing: moving/removing items, original briefs/validation, payment, saving and printing.
- [x] Window designs visible in the city storefront.
- [x] Music: all original briefs, reference tracks/movies, all instrument choices.
- [x] Music: synchronized mixing, sample audition, play/stop, all effect pads.
- [x] Music: matching validation, recording, playback/export, payment and persistence.

## The little things

- [x] Phone: all original messages, triggered calls, caller portraits, replay.
- [x] To-do list with original short and expanded clues and completion feedback.
- [x] Zine: all 12 articles with original paper artwork and all 28 word jumbles with input/checking.
- [x] All 12 personality quizzes, all questions/answers and score outcomes.
- [x] Camera, saved pictures, download and print.
- [x] Scrapbook: all 48 event photos, original captions and narration.
- [x] Scrapbook: girl biographies, collected boys, clothes/window creations and pictures.
- [x] Original music library/player, audio controls, credits, return to sign-in.

## Verification and delivery

- [x] All scene handlers exercised; street doors, walking and map/subway checked through browser controls.
- [x] Campaign completion checked for all 12 weekends; no artificial dead ends.
- [x] All creative activities exercised, including saving and revisiting.
- [x] Responsive display, mouse/touch/keyboard access, sound activation.
- [x] Reload/save/import/export checked; loading and failure states work.
- [x] Publish to a dedicated GitHub repository + GitHub Pages.
- [x] Verify the live shareable URL.

## Remaining original-game fidelity — audit, 5 September 2026

The checked activity list above is functional coverage, not a completed parity
checklist. These gaps are evidenced by recovered definitions and the current
JavaScript. Exact native timing and hidden behavior still need comparison with
the original running game; asset names alone do not establish an Easter egg.

- [ ] **Pedestrian encounters:** use `DctActorTrigger.GREET_DISTANCE` and
  `CHAT_DISTANCE`, character greetings and goodbye lists, and the original
  encounter sequence. Current conversations require clicks and release a
  pedestrian after a fixed timer. Character-specific greeting selection and
  avoiding immediate repeats are fixed, but that is only part of the system.
- [ ] **Street movement and idles:** honor actor start positions, delays and
  delay variation from `DctActorStreet*`; use `DctDollIdle` variations and the
  doll's authored speed. Current actors start at synthetic positions, wrap at
  the world edge, and the player uses a fixed speed and `FzIdle01` when stopped.
- [ ] **Other original cursors:** walking/edge arrows, heart hover, and creative
  tool cursor artwork are recovered but not comprehensively connected. The
  original `AniStSmallArrowIn` door cursor is now connected.
- [ ] **Context-sensitive help and idle speech:** select the authored phone,
  map, park, held-item, bought-item and creative-tool help/idle dictionaries.
  `Game.help()` currently selects broad scene-level lists, which can refer to
  controls or states that are not currently shown.
- [ ] **Sign-in choreography:** restore the authored voice/animation wait and
  interruption sequences, including the delayed flashing Help button in
  `DctSiMainIntroSeq`. The current sign-in is a simplified functional screen.
- [ ] **Small street interactions:** replace generic incidental-effect
  selection with verified object-specific sequences and sounds. Current
  `incidental()` selects effects by name or randomly and uses a generic street
  sound for many objects. Clickability alone does not establish parity.
- [ ] **Remaining interface behavior:** reproduce the original letter-slot
  interaction (`DctZineParams.LETTERWIDTH` and puzzle masks), phone controls,
  and dialog transitions. Jumbles currently use whole-word browser inputs;
  several utility screens still use adapted controls. Read-only native dialog
  text now renders on the canvas with bounded wrapping.
- [ ] **Easter eggs and original bugs:** perform an original-runtime comparison
  and record reproducible triggers before claiming coverage. No verified
  Easter-egg inventory currently exists. `DctMapSpotsDebug` and `DEBUG_ON`
  fields are development metadata, not evidence of player-accessible secrets.

Deliberate differences: the weekend-four store lookup error is corrected;
the broken sign-in deletion highlight is not reproduced; save export/import
and browser downloads/printing replace platform-specific behavior. The absent
Zine photograph reference remains unresolved on the supplied disc.

## Known source quirks (recovery details)

- The ISO has mismatched big-endian filesystem headers. 7-Zip reads/extracts the little-endian records; all RES entry boundaries and identifiers validate, all bitmaps and audio decode, and every BAP parses.
- Resource metadata stores pre-import lengths. RCB payloads may be two bytes shorter; extraction uses the actual indexed payload length.
- `AniStWdOverlay` has a rectangle two pixels beyond its stored image; the browser export clips that rectangle.
- The original sign-in delete-name highlight references a nonexistent rectangle. The browser sign-in provides its own functional deletion confirmation.
- Some embedded makeup dictionaries retain copied internal names; the main BAP references supply their correct identities. Sign-in and game credits also share a dictionary name; both are preserved separately.
- Weekend four's clothing-store lookup fields are swapped on the disc. They are normalized to match the original written clues and the stores that actually stock those clothes.
- The Zine points to an absent `AniStZinePhoto01` sprite. Its original articles and paper artwork are present; this restoration does not invent missing original photographs.

## Verification record — 5 September 2026

- `tools/check_data.mjs`: all 12 weekends, 60 tasks, 24 clothing briefs, 20 window briefs, 16 music briefs, 72 quiz questions and 48 event photos; referenced asset files exist and creative validators accept solutions and reject empty work.
- `tools/check_campaign.js`: all twelve weekends completed in the browser, including earning money, every task purchase, completion feedback, and four event pictures per weekend. Travel and answer lookup use controlled fixtures; activity controls perform the work. No browser exceptions were reported.
- `tools/check_details.js`: window fill/drag/move/erase/undo, storefront persistence, clothing region fills and decorations, payment, music mixing/mismatch/recorded changes/effect pads/playback/WAV export, saved-game export/import/reload. Exported WAV also decoded as non-silent PCM audio.
- `tools/check_extras.js`: 28 jumbles, 36 quiz outcomes, 52 calls, city travel/doors/subway, incidental characters and birds, camera/download/printing contract, biographies, credits, video/mute, 390-pixel touch viewport, startup failure and recovery. Printing was checked at the browser handoff, without sending paper to a printer.
- `tools/check_revisions.js`: the four-guess limit and retry, changing a correct shopping selection invalidates it, reopening and editing a saved design, and the PNG file signature.
- Visual inspection: sign-in, apartment, street, clothes design, window dressing, saved storefront, music mixer, and mobile layout.
- Live delivery: [bensonperry.com/my-scene-web/](https://bensonperry.com/my-scene-web/) returns HTTP 200. The published game starts a fresh profile, plays its introduction, opens the apartment and city, and resumes that city save after reload, with no browser exceptions or failed resource responses. [GitHub Pages deployment passed](https://github.com/benson/my-scene-web/actions/runs/33981820413).

Browser controls and some animations/timing are reconstructed. The original native handlers are not running, so this is verified functional coverage of the recovered game content, not a claim of exact binary or visual parity.
