# Repairs from the native parity audit

The 18 confirmed items in [PARITY-AUDIT.md](PARITY-AUDIT.md) are implemented.
The audit's separate unresolved questions are still research questions; this
release does not claim exhaustive native-runtime or frame-perfect parity.

## Shopping rules and presentation (01–04, 10–13, 17–18)

Gift and food shops display the original three candidates, shuffled among the
authored box positions. The player chooses **one** item and can ask three new
questions. Previously asked questions remain readable; unasked questions become
disabled. Native selected/hover/disabled artwork and text colors are used.
Wrong purchases play the original rejection and return outside. Correct
purchases charge $10 and play the original response before leaving. Re-entry
starts a fresh question round.

This is derived from the native implementation, not a guess about the name
`ANSWERS`: selection writes a candidate index at `0x1003b895`; the Buy handler
compares that index with zero at `0x1003b971–0x1003b97c`. Candidate identity is
loaded from `ANSWERS` by the loop index at `0x1003c57e–0x1003c594`, while box
placement is shuffled separately. The question handler at
`0x1003d610–0x1003d6df` preserves access to already-asked questions after the
limit. Gift and food use the same parameterized handler.

Clothing Buy now has four chances. Trying on or modeling clothes consumes none;
trying to buy two items gives `TwoItems01` without consuming a chance. Wrong
single-item purchases consume a chance and play the authored feedback. The
fourth failure plays the keeper's closing response and exits. Correct purchases
play the girl's response followed by the keeper. These branches are in
`0x100397c0–0x10039b41`; the original $40 gate runs before validation.

Accessories and makeup now use the original shelf coordinates and size, without
the added canvas category icons. **Buy performs the guess and purchase in one
action** during a task; Guess is the practice control. Four failures play the
original final response and exit; re-entry provides a fresh failed round.
Native success at `0x10040020–0x100400b2` charges $10 during a task and uses
`CorrectGuess` for practice. The completed-voice handler exits at `0x1003e8f6`.
The canvas and accessible controls follow the same rule.

The keeper's greeting uses the category's `INTRO_FX` (or `Intro`), with
`ReturnStoreIntro` after task completion. The native predicate is task status
(`0x10012bb0`), not a generic visit counter. The CD store likewise uses `Intro01`
and the humming/instruction sequence while the task is pending, then
`RtnIntroCD` after completion (`0x1003460a–0x1003463f`). Its ambient resource is
corrected to `SndCsAmbience01`. Gift/food explicitly use the keeper's native
`Intro`; stale `Dg...` metadata is no longer used as an effect name.

Insufficient funds play each shop's native `NoMon` voice and return outside.
The original price-tag art appears during the corresponding greeting/refusal.
Prices remain $40 for clothing and $10 for the other purchases.

## Narration, Help and cues (05–09, 14–16)

Clothes and window design play their full native `Intro` on first entry.
Returning to the same brief uses `ReturnIntro`/`RtnIntroWork`; a new brief uses
the available character-specific `Comment...` effect. The native code loads
the brief dictionary into the object at `0x10024779–0x100247a5` and compares
that dictionary identity in the intro branch at `0x10024ad3–0x10024bbf`.
The long `Intro` assets contain the lesson: appending every shorter `Intro01`
through `Intro05` Help excerpt would repeat it.

Music now has first-entry, returning, matching-feedback, freestyle-entry and
recording-completion dialogue. A successful match plays the girl's response,
the host's payment dialogue and then the freestyle lesson in order. Returning
to freestyle uses the girl's `Pt02Intro01`; completing a recording plays the
host's original take-home response before leaving.

The first Zine pickup plays `PickUpZine`. Scrapbook entry and photo/design tabs
play their original guidance. The existing About Me narration is retained—the
audit's broad statement that *all* scrapbook narration was missing was too
broad. First-use and last-brief state persist in saves; older profiles without
these added fields are supported.

Music Help/idle follows matching versus freestyle state, independently of
whether audio is playing. Apartment Help/idle follows the visited apartment's
authored dictionary and voice, including Barbie's MP3 player guidance.

The cue parser handles the eight music `On/Off` light cues and the shorter
post-it highlight form. The red lights are now actually drawn, in addition to
the green lights. Real playback checks verify their 2.4- and 6.2-second cues.
Stopped narration clears the light overrides.

Queued narration stops when another spoken request, scene load or profile
supersedes it. An old scene load can no longer replace a newly opened shop's
controls: asynchronous scene preparation and the street cursor thumbnail now
honor the active load token. This race was reproduced while testing immediate
failure/re-entry.

## Verification

- `tools/check_parity.js`: fixed candidates, question states, correct/wrong
  purchases, four-chance rules, one-action Buy, failure/re-entry, insufficient
  funds, first/return/new-brief dialogue, Zine/scrapbook narration, and resolution
  of all exercised sound requests.
- `tools/check_parity_audio.js`: actual Web Audio decoding, ordered music
  narration, interruption, both Help contexts, three active girls visiting all
  three apartments, normal-speed cue timing and post-it cue parsing. Long
  lessons are accelerated for sequencing checks; cue checks are not.
- `tools/check_campaign.js`: twelve weekends, sixty task purchases, correct
  prices and earnings, completion photos and progression. Gift/food fixtures
  now choose one native-correct candidate, and accessory/makeup fixtures use
  one Buy action. Voices are stubbed here; real playback is covered separately.
- Visual review: original-coordinate accessory and makeup shelves, gift
  candidates and questions. `npm run check`, `npm run build`, and the focused
  JavaScript syntax/diff checks validate the release.

The tests use disposable browser profiles and controlled travel/answer
fixtures. They do not execute the original native game or prove every native
branch. Static DLL checks are reproducible with
`python tools/inspect_native_fidelity.py`; all original desktop execution
remained disabled as requested.
