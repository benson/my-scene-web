# Gameplay comparison — 5 September 2026

Scope: targeted scenes in [Daelyria's longplay](https://www.youtube.com/watch?v=KLf24_7mpmA),
viewed muted in a background browser, plus its timestamped automatic transcript.
Initially compared against source at commit `2f8bd6c`; the fixes below are now implemented.
The recording is a reference, not proof that every regional disc behaves alike.

## Confirmed presentation and flow gaps

| Area | Reference | Current port / remaining work |
| --- | --- | --- |
| Sign-in | [0:30–0:41](https://www.youtube.com/watch?v=KLf24_7mpmA&t=30s): phone list, scroll arrows, selection followed by Continue. | `web/app.mjs` displays only five names, clicking one loads immediately, and Continue loads `profiles[0]`. Original list scrolling/selection and default-screen presentation remain to implement. |
| Music completion | [12:47–12:53](https://www.youtube.com/watch?v=KLf24_7mpmA&t=767s): matching success leads into freestyle. | `web/creative.mjs` pays but leaves the current mode unchanged. Effects are independently available. Restore the staged transition and appropriate controls. |
| Scrapbook page controls | [7:58–8:01](https://www.youtube.com/watch?v=KLf24_7mpmA&t=478s): Save, Print, Help appear beside the page. | `g.scrapbook` in `web/native-ui.mjs` does not wire these main-page controls. Individual-image export/print exists; full-page actions and Help still need matching. Footage confirms presentation, not the OS print-dialog outcome. |
| Window-job completion | [37:40–37:51](https://www.youtube.com/watch?v=KLf24_7mpmA&t=2260s): congratulations over the design, followed by street gameplay. | `web/creative.mjs` instead opens an added “Fabulous work!” modal with its own next-brief flow. Exact exit trigger requires a closer continuous comparison, but the added result-screen presentation differs. |
| Weekend recap | [25:55–26:09](https://www.youtube.com/watch?v=KLf24_7mpmA&t=1555s): recap imagery leads into the album page. | `g.eventPhoto` in `web/extras.mjs` reuses the printable photo viewer and requires Next through four pictures before advancing. Restore a distinct recap/album transition; exact frame timing is not measured here. |

The table records the pre-fix findings. All five are now implemented, together
with the opening Parkside street/phone tutorial. New sign-in controls use the
authored list limits and confirmation dialogs. Music matching leads to
freestyle, with recording/pads gated to that stage. The recorded take is saved
to the music library and replayed through the studio Play button. Main-page
scrapbook Save, Print and Help work. Creative completion plays the original
voiceover over the design before returning outside and advancing to a clean
brief. Recaps use a separate narrated montage followed by the album; closing
the album advances the weekend. Tutorial/recap state persists in saves.

Further inspection at [2:50:54–2:51:14](https://www.youtube.com/watch?v=KLf24_7mpmA&t=10254s)
showed the final album followed by scrolling credits. The added completion
dialog has been replaced with original credit text, artwork and music.
Credit scroll speed and exact native job-exit timing remain reconstructed.

At Benson's request, videos also start unmuted unless game sound was explicitly
muted. Browser autoplay restrictions reveal Play instead of silently muting.

## Economy conflict resolved

At [8:43–9:17](https://www.youtube.com/watch?v=KLf24_7mpmA&t=523s), the clothing
shop displays $40 and the transcript describes insufficient funds at $30.
The supplied UK disc's `DctStoreCost` assigns clothing stores $10, but native
code overrides it: `0x10036d6b` compares wallet global `0x1006f300` with `0x28`
(40), and the nearby failure branch plays `NoMon`. Wallet reset at
`0x10012870` writes 40; weekend advance calls it at `0x1000f016`, before
incrementing the week. Other shop gates compare against 10.
`tools/inspect_native_fidelity.py` reproduces the relevant disassembly without
executing the DLL.

The port now charges $40 for clothing and $10 for other purchases, starts with
$40, and resets the wallet to $40 each weekend. Help and purchase labels agree.

## Verification of these fixes

- `check_interface.js`: playback/end/skip, autoplay fallback, unmuted default
  with suspended game audio, explicit mute, phone controls and pavement cursor.
- `check_story.js`: sign-in scrolling/selection/delete cancellation, tutorial
  sequence, price gates/deductions, montage-to-album transition, full-page
  save/print contracts and exactly-once weekend advance.
- `check_story_audio.js`: real recording and library persistence, studio
  replay, voice cues, narration-gated montage, Escape skip and credits.
- `check_campaign.js`: all 12 weekends and 60 tasks passed with corrected
  prices, consecutive jobs, and album transitions. Each weekend ended with $10.
  This campaign check stubs narration; real audio is covered separately.
- The above checks reported no browser exceptions. Visual inspection covered
  scrolled/selected sign-in names, the album, montage, and credits.
- Printing was verified at the browser handoff without printing paper.

## Areas reviewed without a new demonstrated gap

- Window-dressing selection at 34:45–34:48 broadly agrees with the current
  fashions/stamps/trims and hanger-slot organization. That does not verify every
  drag behavior or job validator.
- Clothing selection/modeling instructions at 8:43–8:52 broadly agree with
  selecting clothing and clicking the character to model it.

No reviewed sequence establishes the precise upper/lower walking-click boundary.
No claim is made that the entire recording, all activities, or every weekend has
been compared.
