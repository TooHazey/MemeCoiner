# Memewatch

Free, rules-based scanner for new and gaining memecoins/crypto. No AI, no API keys, no paid services.
Data: GeckoTerminal (new + trending pools) and CoinGecko (large-cap gainers).

## Files
- `index.html` the live dashboard (verdicts, browser notifications, sound)
- `score.js` data fetching and the scoring rules (edit thresholds here)
- `scanner.mjs` + `.github/workflows/scan.yml` background scanner that pings your phone via Discord
- `data/seen.json` remembers which signals were already sent

## Setup (about 5 minutes)
1. Create a GitHub repo and upload everything in this folder (keep the `.github` folder).
2. **Dashboard:** Settings > Pages > Deploy from branch > `main` / root. Your site appears at `https://<you>.github.io/<repo>/`.
3. **Phone alerts:** in Discord, Server Settings > Integrations > Webhooks > New Webhook > copy URL. In the repo: Settings > Secrets and variables > Actions > New secret named `DISCORD_WEBHOOK_URL`. Then Actions tab > scan > Run workflow once to test.
4. Optional repo variables: edit `MIN_SCORE` / `NETWORKS` in `scan.yml` env to tune the alert threshold and chains.

## Honest limits
- The dashboard only alerts while the tab is open (30s refresh). Always-on alerts come from the Action, and GitHub's schedule is 5 minutes at best and sometimes delayed, so "instant" is really "within a few minutes".
- The verdict is a screener (liquidity, volume, buy/sell balance, momentum, age), not a prediction. It can't detect every rug pull. Check the token's contract and holders before buying.
- iPhone browser notifications only work after "Add to Home Screen"; the Discord push is more reliable.
