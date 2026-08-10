// LFL All-Time Wins Fix v10.5
// This file does not modify history.json.
// It overrides only franchiseStats() after app.js loads.
// Overall W-L-T = every decided matchup in the historical archive.

window.LFL_WINS_FIX_VERSION = "v10.5-clean";

franchiseStats = function () {
  const map = new Map();

  for (const x of DATA?.teams || []) {
    const id = teamId(x["Team ID"]);
    if (id == null) continue;

    if (!map.has(id)) {
      map.set(id, {
        id,
        rows: [],
        seasons: new Set(),
        wins: 0,
        losses: 0,
        ties: 0,
        regWins: 0,
        regLosses: 0,
        regTies: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        finishTotal: 0,
        finishCount: 0,
        top3: 0,
        bestFinish: null,
        titles: 0,
        playoffSeasons: new Set()
      });
    }

    const f = map.get(id);
    const finish = Number(x["Final Rank"]);

    f.rows.push(x);
    f.seasons.add(Number(x.Season));

    // Preserve ESPN regular-season standings separately.
    f.regWins += Number(x.Wins || 0);
    f.regLosses += Number(x.Losses || 0);
    f.regTies += Number(x.Ties || 0);

    f.pointsFor += Number(x["Points For"] || 0);
    f.pointsAgainst += Number(x["Points Against"] || 0);

    if (Number.isFinite(finish) && finish > 0) {
      f.finishTotal += finish;
      f.finishCount++;
      if (finish <= 3) f.top3++;
      f.bestFinish = f.bestFinish == null
        ? finish
        : Math.min(f.bestFinish, finish);
    }
  }

  // Keep championship counts exactly as before.
  for (const c of DATA?.champions || []) {
    const id = championTeamId(c);
    if (id != null && map.has(id)) {
      map.get(id).titles++;
    }
  }

  // Rebuild overall W-L-T from every decided matchup.
  for (const g of DATA?.matchups || []) {
    const home = teamId(g["Home Team ID"]);
    const away = teamId(g["Away Team ID"]);

    if (
      home == null ||
      away == null ||
      !map.has(home) ||
      !map.has(away)
    ) {
      continue;
    }

    const result = String(g.Winner || "").toUpperCase();

    if (!result || result === "UNDECIDED") continue;

    const hf = map.get(home);
    const af = map.get(away);

    if (result === "HOME") {
      hf.wins++;
      af.losses++;
    } else if (result === "AWAY") {
      af.wins++;
      hf.losses++;
    } else if (result === "TIE") {
      hf.ties++;
      af.ties++;
    } else {
      continue;
    }

    if (String(g["Playoff Tier"] || "") === "WINNERS_BRACKET") {
      hf.playoffSeasons.add(Number(g.Season));
      af.playoffSeasons.add(Number(g.Season));
    }
  }

  return [...map.values()]
    .map((f) => {
      f.rows.sort((a, b) => Number(a.Season) - Number(b.Season));

      const last = f.rows.at(-1);
      const games = f.wins + f.losses + f.ties;
      const seasons = f.seasons.size;

      const aliases = [
        ...new Set(
          f.rows
            .map((x) => cleanTeam(x["Team Name"]))
            .filter(Boolean)
        )
      ];

      const managers = [
        ...new Set(
          f.rows
            .map((x) => canonicalOwner(x["Owner(s)"]))
            .filter(Boolean)
        )
      ];

      return {
        ...f,
        seasons,
        currentTeam:
          cleanTeam(last?.["Team Name"]) || `Team ${f.id}`,
        currentManager:
          canonicalOwner(last?.["Owner(s)"]),
        aliases,
        managers,
        firstSeason: Number(f.rows[0]?.Season),
        lastSeason: Number(last?.Season),
        winPct: games ? f.wins / games : 0,
        avgFinish:
          f.finishCount ? f.finishTotal / f.finishCount : null,
        avgPointsPerSeason:
          seasons ? f.pointsFor / seasons : 0,
        playoffApps: f.playoffSeasons.size
      };
    })
    .sort(
      (a, b) =>
        b.wins - a.wins ||
        b.titles - a.titles ||
        b.pointsFor - a.pointsFor
    );
};
