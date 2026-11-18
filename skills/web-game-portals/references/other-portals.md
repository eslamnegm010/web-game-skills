# Other portals and channels

Field notes on portals that have no adapter here yet: use `new-portal.md` before integrating any of them, and replace these notes with a full reference when you do.

| Portal | How to get in | Notes |
| --- | --- | --- |
| **Poki** | A form and manual review; a closed beta | Prefers web exclusivity (mobile stores and Steam allowed). Its SDK forbids any other ads. Answer can take about four weeks: don't turn on another portal's exclusivity before it arrives. |
| **Coolmath Games** | Developer form (developers.coolmathgames.com) | Family-friendly content; non-exclusive licences exist. |
| **Famobi, FreezeNova, TwoPlayerGames, Armor Games, Lagged** | A pitch by email: a short description, screenshots, specs, a playable link | Non-exclusive licensing deals. |
| **itch.io** | Open | Good for feedback and community; check payout support for the owner's country before counting on revenue. |
| **Newgrounds** | Open | Audience and feedback only. |

A pitch email needs: one sentence on the hook, a playable link that starts in play, 3-5 screenshots as public URLs, engine and build size, supported devices and languages, and what kind of deal is wanted.

Order that made sense: CrazyGames Basic Launch first (fast real metrics, no exclusivity), use those numbers in pitches, then SDK portals one at a time. Each portal build is its own `VITE_PLATFORM` and its own entry in `docs/store/SUBMISSIONS.md`.
