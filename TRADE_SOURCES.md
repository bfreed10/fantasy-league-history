# Live projections and league scoring

ESPN estimates use the league-scored values returned by ESPN. The website now also exposes the complete live scoring rules and a scoring fingerprint in `/api/trade-values` under `valuationScoring`. Rules are fetched again on each request, so scoring changes invalidate older pre-scored external feeds.

Yahoo, Sleeper and CBS projection feeds are still unconnected. Sleeper's documented player endpoint supplies metadata and platform-ID mappings, not a projection feed. Yahoo developer authorization does not by itself establish access to projection data. Working permitted feed/API access is the remaining prerequisite. Yahoo access application: https://sports.yahoo.com/developer/access/. That application is not proof that Yahoo projections are available through the API.

## Server connection

In Vercel project Environment Variables, set HTTPS feed URLs:

- `TRADE_YAHOO_FEED_URL`
- `TRADE_SLEEPER_FEED_URL`
- `TRADE_CBS_FEED_URL`

After changing environment variables, redeploy. The site requests the configured feeds when Trade Hub or Data Health opens. Each feed must contain current data and must be maintained by its actual provider/exporter. ESPN credentials are never forwarded to feed servers. As a fallback, authorized feed snapshots can live under `sources.Yahoo`, `sources.Sleeper` and `sources.CBS` in `data/trade_projection_feeds.json`.

## Accepted formats

All feeds require current `season`, `week`, `updatedAt` (within seven days), `horizon: "ros_weekly"` and a `players` array mapped by `espnId`. ADP, dynasty rankings, season totals, weekly-only values and trade-chart scores must not be relabeled as rest-of-season weekly estimates.

**Already scored under the complete league rules:**

```json
{
  "season": 2026,
  "week": 4,
  "updatedAt": "2026-09-29T20:00:00Z",
  "horizon": "ros_weekly",
  "format": "league_points",
  "scoringHash": "COPY_THE_CURRENT_FULL_HASH_FROM_API",
  "players": [{"espnId": 12345, "value": 14.5}]
}
```

Only use this format when the source/exporter actually applied every league scoring rule. The matching hash is an assertion of scoring compatibility, not a substitute for doing the calculation.

**Raw projected statistics:** use `format: "espn_stat_ids"`. Each player must provide `position` and `weeks: [{"week": 4, "stats": {"ESPN_STAT_ID": 0}}]` for every week from the current week through `valuationScoring.endWeek`, including explicit zero weeks for byes. Provider adapters must map statistics to ESPN stat IDs and supply all nonzero-scoring categories. Missing categories, ambiguous IDs or incomplete weeks exclude that player.

The server calculates each week's points using current ESPN coefficients and position overrides, then averages the remaining weeks. Bonus and bucket categories require projected event counts/probabilities; thresholding average projected yardage is not a valid substitute. Raw conversion is allowed only after calculated scoring matches at least three nonzero ESPN samples. Nondecimal scoring is not inferred: it requires a complete pre-scored feed. Negative-score restrictions are honored.

## Automatic checks

`.github/workflows/projection-health.yml` checks sources daily at 10:17 UTC and after successful production deployments, with a manual Run workflow option. It requests the live endpoint (which refreshes configured feeds), checks availability/scoring, writes an Actions summary and saves a 30-day report artifact. It does not invent missing projections or create provider access.

The workflow discovers the production URL from GitHub deployment records. If discovery fails, set repository Actions variable `PROJECTION_SITE_URL` to the public production URL. Provider feed URLs remain Vercel server variables. GitHub schedules may be delayed or disabled after prolonged inactivity; check the Actions page periodically. Authentication or provider changes may require maintenance.

Yahoo OAuth account connection/token renewal must be supplied by the actual provider adapter; this repository does not currently implement a Yahoo projection adapter. CBS/Sleeper projection access also remains unverified. The blend uses equal weights only among valid estimates available for each player; missing/stale/mismatched feeds contribute no weight.

## Verification

Open Trade Hub → League scoring verification and Player estimate breakdown, plus Data Health → Freshness & Coverage. Inspect actual source counts, scoring calibration, timestamps and exclusion reasons.

Run `node tests/league-scoring.test.cjs`, `node tests/valuation.test.cjs`, `node tests/live-expansion.test.cjs`, `node tests/records-draft.test.cjs`, and `node tests/expandable-lists.test.cjs`.
