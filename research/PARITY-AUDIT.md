# Native parity audit — 5 September 2026

Baseline: `23c220d`. **The port is playable through all twelve weekends, but is
not a carbon copy of the original.** Earlier campaign tests proved completion
under the port's rules; they did not prove those rules match the native game.
This audit adds evidence and a repair checklist. It does not change gameplay.

**Repair update:** the 18 confirmed items below are now implemented. See
[PARITY-FIXES.md](PARITY-FIXES.md) for native branch evidence, implementation
details, corrections to the audit's initial assumptions, and verification.
The table is retained as the original baseline finding list.

## Method and evidence

- Read the recovered ISO resource dictionaries, sprites, sound effects and cues.
- Inspected selected x86 DLL branches without executing the original game.
- Compared targeted scenes in [Daelyria's longplay](https://www.youtube.com/watch?v=KLf24_7mpmA),
  muted in a background browser, and searched its automatic transcript. The
  transcript helps locate sequences; it is not exact dialogue or frame evidence.
- Ran controlled port entry probes for twelve scene handlers across twelve
  weekends. These bypass travel/unlocks and stub sound playback to capture
  requested resources. They do not prove real-time audio, gestures, or native
  reachability. Of 144 attempts, 143 produced observations; the remaining attempt
  was the closed week-two music studio. Its exception is **not** evidence of a
  normal-play defect.
- Static inventory: 2,428 images, 1,217 audio files, 2,690 sprites, 316 dictionaries,
  21 scene/resource containers and 1,223 effects with sound. All 4,644 enumerated
  static sound checks resolve. Actual runtime entry probes nevertheless exposed
  different, invalid sound requests. Asset presence is not implementation.

Reproduction:

```text
node tools/audit_parity.mjs
python tools/inspect_native_fidelity.py
```

The Python script requires the locally extracted DLL and `pefile`/`capstone`;
it never launches the DLL. Run `tools/audit_runtime.js` four times through the
repository's Playwright CLI `run-code` in a disposable browser against the port.
Each run visits three weekends. The resulting `window.parityAudit` is captured
in [parity-runtime.json](parity-runtime.json); static results are in
[parity-audit-data.json](parity-audit-data.json). Clear the disposable browser
afterward: these fixtures create a profile and deliberately replace sound/render
methods. Do not run them in a player's session.

## Confirmed repair checklist

P1 changes game rules or removes original interaction/narrative sequences.
P2 changes presentation, feedback or context routing. Each item below was open
at the audit baseline and is addressed by the repair update above.

| ID | Priority | Difference and evidence | Acceptance criterion |
| --- | --- | --- | --- |
| 01 | P1 | **Gift/food selection is the wrong game.** `web/shops.mjs:403` opens a full-catalog picker and requires three purchases. The original presents three candidates and asks the player to buy **one**. Gift footage at [5:59–6:59](https://www.youtube.com/watch?v=KLf24_7mpmA&t=359s) and food at [16:43](https://www.youtube.com/watch?v=KLf24_7mpmA&t=1003s). The `ANSWERS` list is being treated as three required answers. | Display the native candidate set; select and buy one candidate. Derive the correct-answer rule from native logic before changing validators and campaign fixtures. |
| 02 | P1 | **The three-question limit is absent.** Original gift questions become unavailable after three choices in the sequence above. `ask()` stores question indices but never limits them, and every question remains clickable. | Match enabled, selected and disabled question states; a fourth new question cannot reveal another clue. Establish reset behavior on re-entry. |
| 03 | P1 | **Wrong gift purchases do not eject the player.** Native wrong bag at [6:09–6:18](https://www.youtube.com/watch?v=KLf24_7mpmA&t=369s) produces rejection and a return outside. The port plays `KickOut01`, displays added text and stays inside. Food shares this implementation, but its exact rejection sequence still needs its own reference. | Reproduce the observed gift rejection/exit/re-entry sequence; independently validate food's equivalent branch. |
| 04 | P1 | **Clothing has unlimited chances.** Native introduction at [8:42–8:55](https://www.youtube.com/watch?v=KLf24_7mpmA&t=522s) describes four chances. `clothing()` has no attempt counter or failure limit. | Establish which native action consumes a chance, then implement four attempts, feedback, final failure and re-entry. Do not assume every try-on consumes one. |
| 05 | P1 | **Clothes-design entry/return teaching is missing.** Runtime entry logs contain no voice requests. `VocCdVO` contains original introduction effects; the DLL explicitly selects `ReturnIntro` at `0x10024ba7`. Generic Help does not replace the entry sequence. | Match first entry, return with work pending and return after completion, including post-it instructions and cue timing. |
| 06 | P1 | **Window-design entry/return teaching is missing.** Runtime entry logs contain no voice requests. Native `RtnIntroWork` is selected at `0x10047bb9`. | Implement the corresponding native first/return branches and instruction sequence for each character. |
| 07 | P1 | **Music dialogue does not follow activity stage.** Every entry requests `Pt01Intro`, even when returning to freestyle. Host `ReturnIntro01` and character `Pt02Intro01`, `PosFeedback`/`NegFeedback` effects have no corresponding stage routing. Original character response at [12:40](https://www.youtube.com/watch?v=KLf24_7mpmA&t=760s), host transition at 12:47 and saved-track completion at [13:54](https://www.youtube.com/watch?v=KLf24_7mpmA&t=834s) are not all reproduced. | Validate first matching lesson, return, wrong/right mix, freestyle lesson and final recording/completion as separate ordered sequences. |
| 08 | P1 | **First Zine pickup guidance is absent.** Footage at [2:31](https://www.youtube.com/watch?v=KLf24_7mpmA&t=151s) gives the clue tutorial. Native code references `PickUpZine`; the active `g.zine` override has no such trigger. | Trigger the original first-use guidance once under the native condition and persist that condition. |
| 09 | P1 | **Scrapbook narration is missing on entry and tab changes.** The active `g.scrapbook` only speaks through Help or individual photo playback. Footage at [7:56–8:04](https://www.youtube.com/watch?v=KLf24_7mpmA&t=476s) and [26:11](https://www.youtube.com/watch?v=KLf24_7mpmA&t=1571s) has scrapbook/design/about guidance. `ScrpBkIntro`, `ClickDesTab`, `ClickPhotoTab`, and `AboutMe` are recovered. | Restore native entry/tab narration with the correct person, interruption and replay rules. |
| 10 | P2 | **Gift and food greetings silently fail.** Runtime entry requests such as `AniGtStoreKeeperVO` + `DgGtBarPt01Intro02` and `AniFdStoreKeeperVO` + `DgFdBarPt01Intro02` do not resolve. The recovered keeper effects use names such as `Intro`, `Intro01`, `Intro02`. `content.INTROFX` is not a working direct effect name. | Reconstruct native effect selection; all open-shop first/return greetings request existing clips and play in the proper order. Do not blindly rename every request to one generic intro. |
| 11 | P2 | **Accessory/makeup keeper greetings are never requested.** Entry probes show only ambient audio. Original accessory introduction is at [17:08–17:28](https://www.youtube.com/watch?v=KLf24_7mpmA&t=1028s); later makeup return dialogue is located at 2:38:24 in the transcript. | Restore first/return/category-specific greeting branches and their original completion behavior. |
| 12 | P2 | **CD-store entry omits the automatic clue sequence.** Port entry has no voiced intro/humming; humming requires a manual action. Original sequence is audible in the transcript at 2:36:46–2:37:09, including the introductory remark, tune and buy instructions. | Match automatic entry playback and the native manual replay control without overlapping clips. |
| 13 | P2 | **CD ambience requests a nonexistent resource.** Runtime asks for `SndCsAmbient`; recovered resource is `SndCsAmbience01`. | Correct the mapping and verify loop playback, mute and exit cleanup. |
| 14 | P2 | **Music Help uses whether audio is playing as the stage.** `helpContext()` chooses `DctMmHelpMix` from `g.sound.sources.length`, not matching/freestyle state. Playing a beginner sample changes the lesson; stopping freestyle changes it back. | Help/idle use activity stage independently of playback, including resumed games. |
| 15 | P2 | **Apartment Help uses the active girl rather than the visited apartment.** `helpContext()` derives the dictionary and voice from `g.pre`, disregarding the apartment identity and its authored `HELP_DICT`. This also omits the intended Barbie MP3-specific help route. | Resolve Help/idle from the visited apartment and native state; test all girls visiting all apartments. The apartment-entry `AptIntro` itself is already implemented. |
| 16 | P2 | **Some meaningful audio-synchronized cues are ignored.** Parser handles `Highlight/Flash/Down`, but the music lesson has eight `On/Off` light cues at 2,400/6,200 ms. The clothes-designer `PostIt` cue also uses a shorter format. | Support valid authored cue forms and verify the lights/post-it change at the clip-relative times and clear on interruption. Do not manufacture targets for stale source cues. |
| 17 | P2 | **Insufficient-money response is an added modal.** The original clothing refusal at [18:33–18:39](https://www.youtube.com/watch?v=KLf24_7mpmA&t=1113s) uses native `NoMon` dialogue and returns outside. The shared purchase gate only displays web text. | Match voice, timing and exit behavior per store; preserve the already-correct $40 clothing/$10 other pricing. |
| 18 | P2 | **Accessory/makeup shelves and category controls are reconstructed.** `accessories()` scales shelf art into a uniform grid and adds small category icons at the top. Original accessory frames around [17:10–17:50](https://www.youtube.com/watch?v=KLf24_7mpmA&t=1030s) show a different authored layout. | Reproduce native shelf placement, scale, category progression, control labels and hit regions at 800×600. Independently reference makeup before treating both layouts as identical. |

## Native questions that must remain open

These are risks or incomplete comparisons, not additional proven defects.

- **Resolved in the repair:** gift/food candidate zero is correct; screen
  placement is shuffled independently. See the new native branch evidence.
  The original question was: native candidate-box setup is located around
  `0x1003c582`; the answer ordering/randomization and correctness branch are not
  yet decoded. Do not assume `ANSWERS[0]` is correct from the field name alone.
- **Resolved in the repair:** the four-failure sequence exits; the in-place
  “Try again” has been removed. The original question was: the port offers it after
  four wrong guesses. The transcript at 2:38:46–2:38:52 suggests an original
  closing-for-lunch exit and re-entry. Confirm the visual transition and native
  attempt/reset branch before implementing it. The four-guess counter alone is
  insufficient evidence of parity.
- **Message tutorial and voice mapping:** first message guidance appears at
  7:04–7:08. The first weekend has three text messages but only one
  `PHONE_MSG_VO`. The port indexes these arrays together and can attach the jeans
  call to the first text. Determine whether voice messages are a separate native
  channel; do not presume positional alignment.
- **Post-it/job and crush guidance:** original transcript locates job guidance
  at 19:44 and a boy encounter at 8:29. Verify the full trigger and sequence,
  including native scrapbook crush selection versus the port's collected-boy
  gallery. Presence of a voice effect alone does not establish a required event.
- **Creative feedback branches:** current design completion uses only
  `FeedbackGood`/`Good`; other `OK` and character-specific feedback exists. Recover
  validation branches and sequence timing before selecting extra effects.
- **Weeks 7–10 street conversations:** `ChatW07Thru10...` voice effects exist, but
  current street chat uses generic greetings. Native reachability is unproven;
  dynamic names mean absence of DLL string literals is not proof of non-use.
- **Music catalog:** four `SndCsCdLoopBar01..04` resources are outside the port's
  selectable library. They may be background loops, not missing purchasable CDs.
- **Exact timing/geometry:** street walking boundaries, audio interruption,
  original hit rectangles, sign-in list offset, montage timing and credit speed
  still require measured reference comparisons. A visually similar frame does
  not prove the same interaction rules.
- **Save semantics:** the port's JSON persistence is functional, but native
  first-use flags, attempt resets, task/call ordering and mid-dialog resume
  behavior have not been comprehensively matched.

## Coverage and verified positives

| Surface | Evidence covered | Still required for 1:1 acceptance |
| --- | --- | --- |
| Sign-in / intro | Earlier visual and functional checks, original movies and list behavior | Exact geometry, first/return/idle interruption matrix |
| Street / common UI | Earlier walking/phone/map work; current call/resource inventory | Native boundaries, timed actors, conditional story conversations |
| Three apartments | Authored entry audio exists; library/scrapbook controls work | Cross-apartment Help, first-use and crush behavior |
| Clothes / accessories / makeup | Direct handlers across twelve weeks; selected original footage | Four-chance rules, reset/exit branches, original layout and dialogue |
| Gift / food / CDs | Entry request tracing and targeted original sequences | Correct native selection rules and automatic audio sequences |
| Clothes design / window design / music | All weekly brief metadata; existing validators; native return references | Full lesson and feedback state machines, native validation comparisons |
| Zine / quiz / scrapbook | Original data, implemented controls, quiz DLL comparison | First-use narration, message mapping, native page behavior |
| Recap / credits / print | Earlier montage/album/credits and browser export checks | Frame timing, native print layout equivalence |
| Resource containers | All 21 recovered scene/container names inventoried | `ScZzCommon` and `zCD_Resources` are shared resources, not extra playable levels; `ScPrPrint640/800` are print surfaces |

The native quiz adds answer scores, selects BAD below **5**, OKAY below **9**,
and GOOD otherwise (`0x10006462–0x100064b9`). The current thresholds match; this
is not a missing feature. The wallet reset and $40 clothing gate were verified
in the previous pass and remain correct. Eleven weekly intro animations plus
the week-one movie, all twelve task sets, and 48 event photos are represented.

The 110 unhandled cue records must not be reported as 110 broken animations:
101 are copied `BtnBtBack_Flash` references with no corresponding target. Nine
records concern the meaningful post-it and music-light formats above.

## Repair and acceptance order

1. Decode and implement the native shopping state machines (01–04), then rewrite
   campaign expectations from the original rules. Existing three-item fixtures
   would otherwise certify the same wrong behavior again.
2. Build explicit first-entry, returning, failed, completed and first-use voice
   states (05–13), with resolved-resource assertions on actual runtime requests.
3. Correct Help/cues/refusal/layout (14–18), then compare each interaction at
   original resolution, including failed actions and re-entry.
4. Close the native questions with evidence. Run all twelve weekends using the
   corrected rules, covering each character and each store variant. Validate
   save/reload at each state boundary and audio interruption independently.

No defensible percentage of “1:1 complete” follows from this audit. Full
completion tests and exhaustive asset extraction are useful, but neither is a
substitute for matching the original state transitions. The original game was
not launched on the desktop during this audit.
