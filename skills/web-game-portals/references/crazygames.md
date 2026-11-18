# CrazyGames

Official: https://docs.crazygames.com/ (requirements: `/requirements/intro/`, ads: `/requirements/ads/`, technical: `/requirements/technical/`, covers: `/requirements/game-covers/`, SDK: `/sdk/intro/`). The notes below come from hands-on Basic Launch experience.

## The process

1. **Submit as Basic Launch**: free, open to everyone, no exclusivity. Manual review, a few days to about two weeks, answer by email. **Do not press "Submit new version" while a version is under review.**
2. **Basic Launch** is a test period: 7 days and 500 plays, 21 days at most. **No ads and no money.** Updates in this phase are accepted automatically.
3. CrazyGames scores **conversion** (players who stay at least 1 minute), **average playtime** and **day-1 retention**, separately for **desktop and mobile**, as gauges with steps. In one observed run, passing took 9 of 15 points per device.
4. Picked → **Full Launch**: full SDK and QA, ads on, revenue share. Not picked: improve and ask for another Basic Launch if offered; with most numbers low it can only return as a new game with large changes.
5. Money: monthly through Tipalti once earnings reach 100 EUR. The revenue share is not published. An optional two-month web exclusivity raises it.

## What to watch

- **Desktop vs mobile conversion separately**: the two devices usually fail for different reasons. A mobile conversion far below desktop almost always means a first-screen blocker (an orientation wall, a slow first frame, a tap target that does not respond).
- **CTR from impressions**: the cover is doing this work; if plays are low but conversion is fine, fix the cover before touching the game.
- **The funnel**: visited → loading → playing → 1 minute → 10 minutes. The biggest drop tells you where the problem is: loading (build size/startup), playing→1 min (onboarding), 1→10 min (the game itself).
- **Gauge steps**: note the next step on each gauge; small, targeted fixes (first-round difficulty, load order, cover) move one gauge at a time.

Lessons:

- **Never block play on orientation**: a "rotate your phone" wall can cut mobile conversion drastically. Start in any orientation and show a tip instead.
- Desktop first visit: one click must land in play (Full Launch asks for one click at most).
- New players need easy first rounds, a visible record to beat, and a reward promised for tomorrow (D1).
- Load time counts until the first `gameplayStart`: a lobby shown before play inflates the measured load time enormously — go straight into play.
- The cover is the first metric. New covers are often the largest single improvement of a launch.
- Versions uploaded on consecutive days cannot be told apart in the metrics.
- An automatic rejection email can be procedural: ask the portal before reacting to one.

## Technical requirements

- 250 MB and 1,500 files in total; initial download 50 MB at most, **20 MB to appear on the mobile homepage**; gameplay within 20 s (good games: under 10 s). Relative paths only.
- Chrome and Edge must work (a bad Safari build gets Safari disabled). Smooth on a 4 GB Chromebook. Mouse and keyboard on desktop, touch on mobile, desktop landscape.
- `user-select: none` on the body; on iOS resume the `AudioContext` on a user gesture; works fullscreen in the CrazyGames app with safe areas.
- Full Launch: SDK v3 (`https://sdk.crazygames.com/crazygames-sdk-v3.js`, `await CrazyGames.SDK.init()`), `gameplayStart`/`gameplayStop` (never the same one twice in a row), `loadingStart`/`loadingStop`, **the Data module for saves**, the User module if the game has accounts, and the site's mute (`sdk.game.settings.muteAudio` plus its change listener) must silence the game.
- No external ads, no external login. A Terms/Privacy notice only if the game collects data beyond the SDK.
- The SDK throws in the `disabled` environment (the game opened outside CrazyGames): wrap every call and fall back to the web platform.

Multiplayer games in Basic Launch must also: show the CrazyGames username in-game (up to 20 characters), support Instant Multiplayer (a player arriving from a friend's party goes straight into a private room: `sdk.game.isInstantMultiplayer`), provide the invite link (`sdk.game.inviteLink`, `updateRoom`, `leftRoom`), handle an invite accepted while the game is open (`addJoinRoomListener`), and honour `disableChat` if there is a chat. Do not keep a room code in the page URL: a refresh inside CrazyGames then tries to join a closed room; use the SDK's invite parameters.

## Ads

- SDK ads only; never during play; never chained; never from a menu, settings or shop button.
- **Midgame:** at logical points (level change, after death, "play again"). Pause and block the UI until `adFinished` or `adError`; mute only when `adStarted` fires; on `adError` continue normally. The SDK allows **one per 3 minutes** and ignores earlier requests.
- **Rewarded:** a special offer, never required to finish. Show a timer or hide the button when unavailable; not on a gameplay screen; a same-size "no thanks"; a video icon; **always an alternative without the ad** (in-game currency); show what was received; **no reward on `adError`**. Between levels use a midgame **or** a rewarded continue, never both. "Out of lives" ads not on every death.
- **Banners:** only on screens open at least 5 s, never in play, two at most, never over the UI.
- **Adblock:** never block or punish; hide ad buttons and say why without a popup.
- Error codes that mean no ads for the whole session: `adsDisabled`, `adblock`. Others (`unfilled`, `adCooldown`) are per request.

## The upload form

**Checklist before:** loads under 20 s; tested on mobile; default language English; the first minute shows what to do; **someone other than the developer played it from start to end**; code, art and sound are your own.

**Step 1, Upload**

| Field | Value |
| --- | --- |
| Basic / Full | Basic (first time) |
| Game name | Exactly the name shown in the game |
| Game engine | HTML5 |
| Upload files | **Select folder** with the unzipped build (the zip is unpacked and uploaded file by file) |
| Does your game save progress? | Yes, using the Data Module from the CrazyGames SDK |
| Supports mobile devices | Tick if it does |
| Mobile orientation | BOTH when the game works in both (changes only with a new build) |
| Online multiplayer / lobby size | As the game is |
| Supports CrazyGames muting audio through SDK | Tick (after `onMute` is wired) |

**Step 2, QA (the Preview tool)**

- The list of SDK functions on the right marks only what happened **in the last run**: do everything in one run.
- Go straight into play when the first screen appears (load time runs until the first gameplay start).
- Press the speaker button under the game: the game must go silent.
- Multiplayer: open a room, copy the invite link, then in "Invite parameters simulation" enter `{"room":"ABCD"}` and press "Call join listener"; try Instant Multiplayer from QA Settings with Relaunch, then turn it off again.
- **Relaunch does not re-measure load time; a browser refresh (Cmd+R) does.**
- A new build during QA: Continue → Cancel on the QA Results page → Delete all files → upload again.
- Self-answered questions: first gameplay start correct, gameplay requirements, runs on all CrazyGames domains, browsers, mobile (scan the QR code with a phone first), no external ads, no external login, Terms/Privacy N/A unless you collect data.

**Step 3, Details**

- Category; **exactly 5 tags** from their list (genre words like Multiplayer are added by CrazyGames, and many obvious tags do not exist: pick in the form).
- Description and controls (desktop and mobile) from `LISTING.md`; tools used (for example Three.js, JavaScript, Vite).
- App store links and the marketing URL can stay empty.
- The 3 covers ("Show label zone" shows the corner the portal's label covers) and the 2 preview videos.
- "Works well in fullscreen".

**Step 4, Submit:** Terms, the age rating questionnaire (quick — answer for your game's actual content), Submit for approval.

## Store assets

- Covers: 1920x1080, 800x1200, 800x800; no border, no text but the game's name, no store logos.
- Preview videos: 15-20 s, silent, real gameplay, landscape 1920x1080 **and** portrait 1080x1620, 50 MB at most, open on the cover, no black frames, no cursor, no "Play now" text.

## Payouts

Billing → Manage Payment Details opens Tipalti: phone check → address → payment method → tax forms. Not needed for review. A bank wire is possible; Tipalti's wire fee was about 25 USD per payment, plus intermediary bank fees. The address must match the bank statement. **Confirm with the bank before typing anything:** the account's currency, the exact spelling of the name in Latin letters, the SWIFT code (head office or branch), incoming fees, and any papers the bank wants.

## Promotion

Send people to the **CrazyGames page**, not to your own site: early plays count towards the 500, and your own site shows no ads. Short clips, indie Discord servers, devlogs. For your own events (tutorial done, death, retry) CrazyGames lists analytics partners in its docs.
