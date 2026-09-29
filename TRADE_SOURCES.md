# Trade projection sources

ESPN league estimates work automatically using existing ESPN_S2 and SWID server credentials. Sleeper's documented public player endpoint provides player-ID mappings and injury metadata; this is not a Sleeper projection feed.

The valuation engine is ready for Yahoo, Sleeper and CBS projection feeds. None is presented as connected until an actual feed passes validation. Each contributing source is visible per player in Trade Hub and in Data Health.

Provide normalized JSON via the server environment variables TRADE_YAHOO_FEED_URL, TRADE_SLEEPER_FEED_URL, TRADE_CBS_FEED_URL. URLs must be HTTPS. Requests do not forward ESPN credentials. Alternatively, put authorized data in data/trade_projection_feeds.json under sources.Yahoo, sources.Sleeper or sources.CBS.

Feed example (replace dates, season, week and values with real source data):

```json
{
  "season": 2026,
  "week": 4,
  "updatedAt": "2026-09-29T19:00:00Z",
  "horizon": "ros_weekly",
  "scoring": {"ppr": 1, "passTd": 4},
  "players": [{"espnId": 12345, "value": 14.5}]
}
```

`value` must represent the player's average weekly rest-of-season fantasy estimate under the specified scoring. Season totals, weekly-only estimates, ADP and trade-chart points are not interchangeable. Do not relabel these as ros_weekly. Player IDs must be mapped to ESPN IDs; ambiguous duplicates are excluded.

Feeds must match the current ESPN season and week, PPR/4-point passing-TD scoring, common ROS weekly horizon, and be updated within seven days. The engine takes an equal-weight average of sources that have a valid estimate for each player. Unavailable sources do not contribute zero or imaginary values.

Yahoo API access requires an authorized developer application. Its league/stat API is not automatically a projection feed. CBS and Sleeper projection access must be verified separately; current code does not scrape their web pages or undocumented projection endpoints. A permitted exporter/provider can publish normalized feeds at the configured URLs; the website fetches them when Trade Hub opens. This repository does not currently include that exporter.

Production checking: open Data Health and Trade Hub. Confirm actual source player counts and timestamps, then inspect Player estimate breakdown. Current Draft Lab additionally requests ESPN player-pool history and reports partial/fallback coverage if ESPN does not return the requested history.

Validation commands:

- node tests/valuation.test.cjs
- node tests/live-expansion.test.cjs
- node tests/records-draft.test.cjs
- node tests/expandable-lists.test.cjs
