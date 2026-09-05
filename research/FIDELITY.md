# Original behavior restoration and hidden developer mode

This pass uses the supplied UK disc's definitions and static inspection of its
native DLL. Desktop interaction was stopped at Benson's request. No claim of
an exhaustive original-runtime comparison is made.

## Restored behavior

| Area | Original evidence | Browser behavior |
| --- | --- | --- |
| Encounters | `DctActorTrigger`, greeting/chat distances 200/100, character greeting and goodbye lists | Proximity greetings, closer conversations, departure lines, no immediate repeat within a clip group; actors resume when speech ends or is interrupted. |
| Movement | `DctActorStreet*`, `DctActorPark`, `DctDoll*`, `DctDollIdle` | Authored start/end coordinates, rates, entry delays/variation, player speed, and weighted directional idle animations. |
| Cursors | `AniStSmallArrow*`, `AniStBigArrow*`, `AniStCurHeart`, creative inventory cursor references | Walking/edge arrows, door arrow, boy-heart hover, selected creative-tool cursor, eraser and move feedback. |
| Help | State-specific `Dct*Help*` and `Dct*Idle*` dictionaries | Phone, map, park, scrapbook, held/bought shopping items and creative tabs use their own lists. F1 works while a native dialog is open. Phone help uses the `SndZzCell*` voices. |
| Sign-in | `DctSiIntroSeq`, `DctSiMainIntroSeq`, sign-in help and idle lists | VUG/title movies, voice playback in order, Escape interruption, original Help flashes and 23-second idle interval. Browser autoplay starts muted until interaction. |
| Incidentals | Street row `TYPE` and actual effect inventories | Authored ambient animations and bird interaction remain. Static props no longer pretend to be interactive or play the unrelated map sound. |
| Jumbles | `PUZZLE_LOC`, optional `PUZZLE_ANS_LOC`, masks, `LETTERWIDTH`, tile sprites; DLL answer-position calculation | Separate source-letter and answer areas, given letters, drag/touch/keyboard movement, word validation and save/resume. Long words use their authored second-row answer coordinates. |
| Phone | `TxtZzTaskShort01..05`, phone button sprites and call triggers | Original list rows and category controls; selected messages, caller images, replay and a ringing indicator until available calls are heard. |
| Transitions | Original static dialog sprites and existing subway movies | Dialogs keep immediate openings; no additional transition properties were present in the decoded BAP nodes. Travel keeps the original movies. |

The port still uses browser accessibility/input controls and audio APIs. Details
not specified by the recovered definitions (for example native collision timing)
remain reconstructions. Known source-data defects already described in FEATURES
remain corrected, rather than deliberately reintroduced.

## Hidden developer mode — confirmed in shipped code

`MyScene.dll` SHA-256:
`d178d8a13123a8c71f5c30f0a10e42f4dab0ef867c66cc0d189f7e17aa563e19`

At image base `0x10000000`, instructions at `0x10007c48–0x10007cac`
compare incoming characters against `DEBUG`, test a modifier flag, display
`-----Debug Mode------`, and set a global mode flag. The modifier's identifier
is initialized from `CTLKEY` at `0x1004b565`. This establishes a reachable
Control+DEBUG code path; it is stronger evidence than a debug asset name.

The restored shortcuts are:

- Hold **Control** and type **DEBUG** during gameplay, outside a text field.
- **D:** original detailed developer map with 20 destinations.
- On the street, **1–9**, **0**, **O**, **P:** weekends 1–12.
- On the street, **B**, **C**, **M:** Barbie, Chelsea, Madison/Westley.
- On the street, **W/Q:** increase/decrease walking speed.
- On the street, **Z/X:** open the Zine/personality quiz.
- **M/N:** increase/decrease music volume, bounded 0–100. The native default
  is 100. M also has the street character shortcut above.

Developer mode is session-only. Its weekend changes use ordinary profile saves;
refreshing clears the mode, not the chosen weekend. Browser input fields and
unrelated browser shortcuts are excluded from these handlers.

Evidence: global key handler at `0x10007d0d–0x10007db6`; street shortcuts at
`0x10043008–0x10043392`. `tools/inspect_native_fidelity.py` reproduces the
relevant strings and disassembly without running the Windows program.

Other internal debug branches exist (including activity test hooks and actor
spawning). Their full effects have not been established and are not represented
as additional recovered Easter eggs. No extra bonus level or secret character
was substantiated.

## Web research and scope

Searches for the 2003 CD-ROM's cheats, secrets, and Easter eggs found no detailed
independently verifiable trigger list. The [My Scene Wiki game entry](https://myscene.fandom.com/wiki/My_Scene_CD-ROM)
identifies the game; the [contemporary review](https://www.edutainingkids.com/review/my-scene.html)
describes ordinary gameplay. Search results about the website's Room Makeover,
the later Goes Hollywood game, and doll lines were excluded from this disc's
feature inventory. The developer-mode restoration is based on the disc itself.

## Verification

### Interface follow-up

Cutscenes hide native video controls by default. Pointer movement reveals a
temporary Skip button; Escape skips, and Options can enable native playback
controls. Autoplay rejection offers Play. Background controls are inert during
movies, and replacing or cancelling a movie releases its handlers.

Removed the port's generic white mouse-hover rectangles; keyboard focus remains
visible. Walking arrows now use the same pavement region as walking clicks.
The original native vertical cutoff has not been established.

The earlier four-slot phone adjustment is superseded by the footage comparison
below. Phone buttons now use their authored coordinates and dimensions.
`tools/check_interface.js` checks playback, skipping/completion, autoplay recovery,
the playback-control option, phone targets and pavement cursor behavior.

### Gameplay footage comparison

Reference: Daelyria's [2003 CD-ROM longplay](https://www.youtube.com/watch?v=KLf24_7mpmA).
Inspected selected frames/sequences in a muted background browser, without
launching the original executable or controlling the desktop:

- [1:38–1:54](https://www.youtube.com/watch?v=KLf24_7mpmA&t=98s): Shopping List heading,
  expandable arrow rows, and exactly three footer icons: bag, envelope, close.
- [2:17–2:22](https://www.youtube.com/watch?v=KLf24_7mpmA&t=137s): Incoming Call heading,
  centered caller name, portrait filling the display, same three footer icons.
- [7:07–7:22](https://www.youtube.com/watch?v=KLf24_7mpmA&t=427s): message rows expand
  into a single note with a downward collapse arrow; no fourth Calls tab.
- [1:01:55](https://www.youtube.com/watch?v=KLf24_7mpmA&t=3715s): later shopping list
  corroborates the same three-icon layout.

Implemented those phone layouts with recovered sprites/text geometry, automatic
unheard-call selection, and a replay action. The browser-only call-history list
is retained under Options, outside the original phone footer.

The opening guided street/phone tutorial gap identified here was subsequently
fixed; see [FOOTAGE-REVIEW.md](FOOTAGE-REVIEW.md). The sampled footage does not establish
the precise native walking-click cutoff. This was a targeted comparison, not a
review of the entire 2h52m recording. Future reference QA should use footage,
static disc analysis or an isolated emulator, never desktop control without a
new explicit request from Benson.

- `tools/check_fidelity.js`: authored actor scheduling and speed, proximity
  encounter phases, real tile dragging, all 28 puzzles through letter input,
  all 12 puzzle saves and board geometry, seven help contexts, and real
  Control+DEBUG/map/week/character/speed keyboard controls. No page exceptions.
- Additional focused browser checks: ordered sign-in voices and Escape,
  creative cursor image, phone layout, long-word tile layout.
- Campaign/asset data validation and production build pass. One local QA asset
  request reported `ERR_NO_BUFFER_SPACE`; the exact asset subsequently returned
  HTTP 200. This was not counted as proof of a missing resource.
