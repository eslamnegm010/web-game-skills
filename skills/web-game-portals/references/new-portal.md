# Adding a portal this skill does not know

Do the research before the code. A portal integration built from memory or from another portal's habits gets rejected or, worse, silently earns nothing.

## 1. Research (official sources only)

Search for the portal's developer documentation and read the live pages: developer or partner portal, SDK reference, technical requirements, ad or monetisation policy, asset guidelines, submission guide. Prefer the portal's own docs over blog posts; note the URL and the date for every fact. If a page needs a login, ask the owner to open it or paste it. When two sources disagree, the SDK reference wins over marketing pages; when something is not documented, write "unknown" and ask the portal's support rather than guessing.

Answer every question in this profile, then save it as `references/<portal>.md` in this skill's repo:

```markdown
# <Portal>
Official: <urls>. Researched <date>. Verified by a real submission: no.

## Getting in
Open or invite-only? Review time? Exclusivity? Revenue model and payout provider, minimum payout?

## SDK
- Script URL and how it loads (tag in <head> first? async? injected by the portal?)
- Global object and init call; ids or keys needed and where they come from
- Lifecycle signals (loading start/stop, gameplay start/stop, "game ready") and which are mandatory
- Interstitial ad call, its callbacks/promise, frequency limits
- Rewarded ad call, the exact signal that means "reward granted", behaviour when unfilled
- Banners, if any
- Pause/resume or mute events sent by the site
- Saves: cloud storage API? does the SDK touch localStorage?
- Accounts: username, auth events
- Behaviour outside the portal (local file, other domain): throws, no-ops, or a test mode?

## Technical rules
Size and file-count limits, load-time expectations, external requests (fonts, CDNs, analytics) allowed?,
iframe and sandbox restrictions, required orientations and devices, forbidden UI (rotate prompts, links out, own ads, own login).

## Ad rules
Where ads are allowed and forbidden, cooldowns, rewarded rules.

## Assets
Every image and video size and format the form asks for, text rules, length limits.

## Submission
Upload format (zip, folder, URL), form fields, QA or preview tool, review process.

## Unknowns
What the docs did not answer.
```

## 2. Decide with the owner

Tell the owner, before writing code: what the portal requires that the game does not do yet, anything that conflicts with another portal (exclusivity, ad rules), and what could not be found. Exclusivity and payout terms are the owner's decision.

## 3. Integrate

1. `~/.claude/skills/web-game-portals/add-platform.sh <portal> <SdkGlobal>` creates `src/platform/<portal>.js` from the skeleton, registers it in `index.js`, adds `build:<portal>` and an empty `<head>` entry in `vite.js`.
2. Fill the adapter from the profile. The rules in the skeleton's header are not optional: `init()` never throws and times out; every SDK call is guarded; `hooks.adStart()` only when an ad is really shown and `hooks.adEnd()` exactly once; `rewardedAd()` true only on the SDK's own "granted" signal. Leave out what the portal does not have: the web platform answers.
3. If the portal wants tags in `<head>`, fill its entry in `src/platform/vite.js`; delete the entry if it wants none.
4. Portal-specific needs that are not SDK calls (no external fonts, no rotate prompt, a different first screen) go behind `platform.name === '<portal>'` checks or build-time `import.meta.env.VITE_PLATFORM`, never in shared game logic by default.

## 4. Test

1. Write `fakes/<portal>-sdk.js` in the `web-game-qa` skill from the SDK reference: the same global and method shapes, every call recorded in `window.__sdk.calls`, a switch for failed ads.
2. Copy the CrazyGames SDK suite to `tools/e2e/sdk.<portal>.e2e.mjs` and adapt the checks to this portal's signals.
3. `npm run build:<portal>`, run the suite, then test in the portal's own preview or sandbox tool. A fake SDK proves the game's side only.

## 5. Record

After the real submission, set "Verified by a real submission: yes (date)" in the reference, add what the form and the reviewers actually asked, move the adapter into `templates/platform/<portal>.js` and the fake SDK into `web-game-qa/fakes/`, and commit. The next game then gets this portal with one command.
