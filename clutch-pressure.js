// LFL Clutch & Pressure Analytics v10.9
// Safe presentation-layer patch.
// Does not modify source history data or prior feature patches.
// Uses decided matchup history plus season standings for opponent context.

window.LFL_CLUTCH_PRESSURE_VERSION = "v10.9";

(function () {
  const baseRecordsPage = pages.records;

  function num(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function tid(value) {
    const n = num(value);
    return n == null ? null : n;
  }

  function validGame(game) {
    const home = tid(game["Home Team ID"]);
    const away = tid(game["Away Team ID"]);
    const homeScore = num(game["Home Score"]);
    const awayScore = num(game["Away Score"]);

    return (
      home != null &&
      away != null &&
      homeScore != null &&
      awayScore != null &&
      String(game.Winner || "").toUpperCase() !== "UNDECIDED"
    );
  }

  function isChampionshipBracket(game) {
    return String(game["Playoff Tier"] || "") === "WINNERS_BRACKET";
  }

  function stageLabel(game) {
    const tier = String(game["Playoff Tier"] || "NONE");

    if (tier === "NONE") return "Regular Season";
    if (tier === "WINNERS_BRACKET") return "Championship Bracket";
    if (tier === "WINNERS_CONSOLATION_LADDER") return "Winners Consolation";
    if (tier === "LOSERS_CONSOLATION_LADDER") return "Losers Consolation";

    return tier
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, c => c.toUpperCase());
  }

  function seasonStandingsMap() {
    const map = new Map();

    for (const row of DATA?.teams || []) {
      const season = Number(row.Season);
      const teamId = tid(row["Team ID"]);

      if (!Number.isFinite(season) || teamId == null) continue;

      map.set(`${season}|${teamId}`, {
        wins: Number(row.Wins || 0),
        losses: Number(row.Losses || 0),
        ties: Number(row.Ties || 0)
      });
    }

    return map;
  }

  function allTeamEvents() {
    const map = new Map();

    for (const game of (DATA?.matchups || []).filter(validGame)) {
      const homeId = tid(game["Home Team ID"]);
      const awayId = tid(game["Away Team ID"]);
      const homeScore = num(game["Home Score"]);
      const awayScore = num(game["Away Score"]);

      const entries = [
        {
          teamId: homeId,
          opponentId: awayId,
          teamName: cleanTeam(game["Home Team"]),
          teamOwner: canonicalOwner(game["Home Owner"]),
          opponentName: cleanTeam(game["Away Team"]),
          opponentOwner: canonicalOwner(game["Away Owner"]),
          score: homeScore,
          opponentScore: awayScore
        },
        {
          teamId: awayId,
          opponentId: homeId,
          teamName: cleanTeam(game["Away Team"]),
          teamOwner: canonicalOwner(game["Away Owner"]),
          opponentName: cleanTeam(game["Home Team"]),
          opponentOwner: canonicalOwner(game["Home Owner"]),
          score: awayScore,
          opponentScore: homeScore
        }
      ];

      for (const entry of entries) {
        if (!map.has(entry.teamId)) map.set(entry.teamId, []);

        const result =
          entry.score > entry.opponentScore
            ? "W"
            : entry.score < entry.opponentScore
            ? "L"
            : "T";

        map.get(entry.teamId).push({
          ...entry,
          result,
          margin: Math.abs(entry.score - entry.opponentScore),
          season: Number(game.Season),
          week: Number(game.Week),
          matchupId: Number(game["Matchup ID"]),
          championship: isChampionshipBracket(game),
          stage: stageLabel(game),
          game
        });
      }
    }

    for (const events of map.values()) {
      events.sort(
        (a, b) =>
          a.season - b.season ||
          a.week - b.week ||
          a.matchupId - b.matchupId
      );
    }

    return map;
  }

  function summarize(events) {
    const wins = events.filter(x => x.result === "W").length;
    const losses = events.filter(x => x.result === "L").length;
    const ties = events.filter(x => x.result === "T").length;
    const games = events.length;
    const pct = games ? (wins + ties * 0.5) / games : null;

    return { wins, losses, ties, games, pct };
  }

  function recordText(summary) {
    if (!summary?.games) return "-";
    return `${summary.wins}-${summary.losses}-${summary.ties}`;
  }

  function recordPctText(summary) {
    return summary?.pct == null ? "-" : `${(summary.pct * 100).toFixed(1)}%`;
  }

  function pointsPerGame(events) {
    if (!events.length) return null;
    return events.reduce((sum, x) => sum + x.score, 0) / events.length;
  }

  function eventWhen(event) {
    return `${event.season} W${event.week}`;
  }

  function eventScoreText(event) {
    return `${fmt(event.score, 2)}-${fmt(event.opponentScore, 2)}`;
  }

  function activeLatestTeamIds() {
    const rows = DATA?.teams || [];
    const seasons = rows
      .map(x => Number(x.Season))
      .filter(Number.isFinite);

    const maxSeason = seasons.length ? Math.max(...seasons) : null;
    if (maxSeason == null) return new Set();

    return new Set(
      rows
        .filter(x => Number(x.Season) === maxSeason)
        .map(x => tid(x["Team ID"]))
        .filter(x => x != null)
    );
  }

  function pressureRows() {
    const standings = seasonStandingsMap();
    const eventsByTeam = allTeamEvents();
    const activeIds = activeLatestTeamIds();
    const rows = [];

    for (const [teamId, events] of eventsByTeam.entries()) {
      const close3 = events.filter(x => x.margin <= 3);
      const close5 = events.filter(x => x.margin <= 5);
      const close10 = events.filter(x => x.margin <= 10);
      const championship = events.filter(x => x.championship);

      const winningOpponents = events.filter(event => {
        const record = standings.get(
          `${event.season}|${event.opponentId}`
        );

        return record && record.wins > record.losses;
      });

      const score130 = events.filter(x => x.score >= 130);
      const score140 = events.filter(x => x.score >= 140);
      const score150 = events.filter(x => x.score >= 150);

      const close3Record = summarize(close3);
      const close5Record = summarize(close5);
      const close10Record = summarize(close10);
      const championshipRecord = summarize(championship);
      const winningOppRecord = summarize(winningOpponents);
      const score130Record = summarize(score130);
      const score140Record = summarize(score140);
      const score150Record = summarize(score150);

      const playoffSeasons = new Set(
        championship.map(x => x.season)
      ).size;

      const bestPlayoff = championship.length
        ? championship
            .slice()
            .sort((a, b) => b.score - a.score)[0]
        : null;

      const worstPlayoff = championship.length
        ? championship
            .slice()
            .sort((a, b) => a.score - b.score)[0]
        : null;

      const qualifiesForRating =
        close10Record.games >= 10 &&
        championshipRecord.games >= 2 &&
        winningOppRecord.games >= 15;

      const pressureRating = qualifiesForRating
        ? 100 *
          (
            0.45 * close10Record.pct +
            0.40 * championshipRecord.pct +
            0.15 * winningOppRecord.pct
          )
        : null;

      rows.push({
        teamId,
        active: activeIds.has(teamId),
        events,
        close3,
        close5,
        close10,
        championship,
        winningOpponents,
        score130,
        score140,
        score150,
        close3Record,
        close5Record,
        close10Record,
        championshipRecord,
        winningOppRecord,
        score130Record,
        score140Record,
        score150Record,
        playoffSeasons,
        playoffPPG: pointsPerGame(championship),
        bestPlayoff,
        worstPlayoff,
        pressureRating
      });
    }

    return rows;
  }

  function qualifiedBest(rows, selector, minimumGames) {
    return rows
      .filter(row => {
        const value = selector(row);
        return (
          value &&
          value.games >= minimumGames &&
          value.pct != null
        );
      })
      .slice()
      .sort((a, b) => {
        const av = selector(a);
        const bv = selector(b);

        return (
          bv.pct - av.pct ||
          bv.wins - av.wins ||
          bv.games - av.games
        );
      })[0];
  }

  function pressureAwards(rows) {
    const mostClutch = rows
      .filter(x => x.pressureRating != null)
      .slice()
      .sort(
        (a, b) =>
          b.pressureRating - a.pressureRating ||
          b.championshipRecord.wins - a.championshipRecord.wins
      )[0];

    const playoffMerchant = qualifiedBest(
      rows,
      x => x.championshipRecord,
      6
    );

    const giantKiller = qualifiedBest(
      rows,
      x => x.winningOppRecord,
      25
    );

    const escapeArtist = rows
      .slice()
      .sort(
        (a, b) =>
          b.close5Record.wins - a.close5Record.wins ||
          b.close5Record.pct - a.close5Record.pct
      )[0];

    const heartbreakKing = rows
      .slice()
      .sort(
        (a, b) =>
          b.close5Record.losses - a.close5Record.losses ||
          a.close5Record.pct - b.close5Record.pct
      )[0];

    return {
      mostClutch,
      playoffMerchant,
      giantKiller,
      escapeArtist,
      heartbreakKing
    };
  }

  function awardCard(label, row, value, detail, tone = "good") {
    if (!row) return "";

    return `
      <div class="card">
        <span class="badge ${tone}">${esc(label)}</span>
        <h3 class="section-gap">${esc(latestTeamById(row.teamId))}</h3>
        <p class="muted">${esc(latestManagerById(row.teamId))}</p>
        <div class="metric section-gap">
          <strong>${esc(value)}</strong>
          <span class="muted">${esc(detail)}</span>
        </div>
      </div>
    `;
  }

  function gameRow(event, mode) {
    if (!event) return "";

    const resultTone =
      event.result === "W"
        ? "good"
        : event.result === "L"
        ? "bad"
        : "warn";

    return `<tr>
      <td>${displayFranchise(event.teamId)}</td>
      <td>
        <strong>${fmt(event.score, 2)}</strong>
        <span class="muted"> vs ${fmt(event.opponentScore, 2)}</span>
      </td>
      <td>${fmt(event.margin, 2)}</td>
      <td>
        ${esc(event.opponentName || latestTeamById(event.opponentId))}
        <br><span class="muted">${esc(event.opponentOwner || "")}</span>
      </td>
      <td>${eventWhen(event)}</td>
      <td>${esc(event.stage)}</td>
      <td><span class="badge ${resultTone}">${esc(mode || event.result)}</span></td>
    </tr>`;
  }

  function buildPressureSection() {
    const rows = pressureRows();
    const awards = pressureAwards(rows);

    const ratingRows = rows
      .filter(x => x.pressureRating != null)
      .slice()
      .sort(
        (a, b) =>
          b.pressureRating - a.pressureRating ||
          b.championshipRecord.wins - a.championshipRecord.wins
      )
      .map((row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${displayFranchise(row.teamId)}</td>
          <td><strong>${fmt(row.pressureRating, 1)}</strong></td>
          <td>
            ${recordText(row.close10Record)}
            <span class="muted"> (${recordPctText(row.close10Record)})</span>
          </td>
          <td>
            ${recordText(row.championshipRecord)}
            <span class="muted"> (${recordPctText(row.championshipRecord)})</span>
          </td>
          <td>
            ${recordText(row.winningOppRecord)}
            <span class="muted"> (${recordPctText(row.winningOppRecord)})</span>
          </td>
        </tr>
      `);

    const closeRows = rows
      .slice()
      .sort(
        (a, b) =>
          b.close5Record.pct - a.close5Record.pct ||
          b.close5Record.wins - a.close5Record.wins
      )
      .map(row => `
        <tr>
          <td>${displayFranchise(row.teamId)}</td>
          <td>
            ${recordText(row.close3Record)}
            <span class="muted"> ${recordPctText(row.close3Record)}</span>
          </td>
          <td>
            ${recordText(row.close5Record)}
            <span class="muted"> ${recordPctText(row.close5Record)}</span>
          </td>
          <td>
            ${recordText(row.close10Record)}
            <span class="muted"> ${recordPctText(row.close10Record)}</span>
          </td>
        </tr>
      `);

    const playoffRows = rows
      .slice()
      .sort(
        (a, b) =>
          b.championshipRecord.wins - a.championshipRecord.wins ||
          b.championshipRecord.pct - a.championshipRecord.pct ||
          b.playoffSeasons - a.playoffSeasons
      )
      .map(row => `
        <tr>
          <td>${displayFranchise(row.teamId)}</td>
          <td>${row.playoffSeasons}</td>
          <td>
            ${recordText(row.championshipRecord)}
            <span class="muted"> ${recordPctText(row.championshipRecord)}</span>
          </td>
          <td>${row.playoffPPG == null ? "-" : fmt(row.playoffPPG, 2)}</td>
          <td>
            ${
              row.bestPlayoff
                ? `<strong>${fmt(row.bestPlayoff.score, 2)}</strong>
                   <span class="muted"> ${eventWhen(row.bestPlayoff)}</span>`
                : "-"
            }
          </td>
          <td>
            ${
              row.worstPlayoff
                ? `<strong>${fmt(row.worstPlayoff.score, 2)}</strong>
                   <span class="muted"> ${eventWhen(row.worstPlayoff)}</span>`
                : "-"
            }
          </td>
        </tr>
      `);

    const thresholdRows = rows
      .slice()
      .sort(
        (a, b) =>
          b.score150Record.wins - a.score150Record.wins ||
          b.score140Record.wins - a.score140Record.wins ||
          b.score130Record.wins - a.score130Record.wins
      )
      .map(row => `
        <tr>
          <td>${displayFranchise(row.teamId)}</td>
          <td>
            ${recordText(row.score130Record)}
            <span class="muted"> ${recordPctText(row.score130Record)}</span>
          </td>
          <td>
            ${recordText(row.score140Record)}
            <span class="muted"> ${recordPctText(row.score140Record)}</span>
          </td>
          <td>
            ${recordText(row.score150Record)}
            <span class="muted"> ${recordPctText(row.score150Record)}</span>
          </td>
        </tr>
      `);

    const allEvents = rows.flatMap(row => row.events);

    const closestWins = allEvents
      .filter(x => x.result === "W")
      .slice()
      .sort(
        (a, b) =>
          a.margin - b.margin ||
          b.score - a.score ||
          b.season - a.season
      )
      .slice(0, 10);

    const closestLosses = allEvents
      .filter(x => x.result === "L")
      .slice()
      .sort(
        (a, b) =>
          a.margin - b.margin ||
          b.score - a.score ||
          b.season - a.season
      )
      .slice(0, 10);

    const highestScoringLosses = allEvents
      .filter(x => x.result === "L")
      .slice()
      .sort(
        (a, b) =>
          b.score - a.score ||
          a.margin - b.margin ||
          b.season - a.season
      )
      .slice(0, 10);

    const playoffEvents = allEvents
      .filter(x => x.championship);

    const bestPlayoffGames = playoffEvents
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const mostPlayoffWins = rows
      .slice()
      .sort(
        (a, b) =>
          b.championshipRecord.wins - a.championshipRecord.wins ||
          b.championshipRecord.pct - a.championshipRecord.pct
      )[0];

    const mostPlayoffApps = rows
      .slice()
      .sort(
        (a, b) =>
          b.playoffSeasons - a.playoffSeasons ||
          b.championshipRecord.wins - a.championshipRecord.wins
      )[0];

    return `
      <div class="section-gap" id="clutchPressureV109">
        <div class="card">
          <div class="card-heading-row">
            <div>
              <span class="section-eyebrow">PRESSURE LAB</span>
              <h2>Clutch & Pressure Analytics</h2>
            </div>
            <span class="badge good">v10.9</span>
          </div>

          <p class="muted">
            Pressure Rating = 45% record in games decided by 10 points or fewer
            + 40% championship-bracket record
            + 15% record against opponents that finished that season with more wins than losses.
            Ties count as half a win. Rating requires at least 10 close games,
            2 championship-bracket games, and 15 games against winning-season opponents.
          </p>

          <div class="metrics section-gap">
            ${metric(
              "Most playoff wins",
              mostPlayoffWins?.championshipRecord.wins ?? "-",
              mostPlayoffWins ? latestTeamById(mostPlayoffWins.teamId) : ""
            )}
            ${metric(
              "Most bracket appearances",
              mostPlayoffApps?.playoffSeasons ?? "-",
              mostPlayoffApps ? latestTeamById(mostPlayoffApps.teamId) : ""
            )}
            ${metric(
              "Best pressure rating",
              awards.mostClutch
                ? fmt(awards.mostClutch.pressureRating, 1)
                : "-",
              awards.mostClutch
                ? latestTeamById(awards.mostClutch.teamId)
                : ""
            )}
            ${metric(
              "Best playoff win rate",
              awards.playoffMerchant
                ? recordPctText(awards.playoffMerchant.championshipRecord)
                : "-",
              awards.playoffMerchant
                ? latestTeamById(awards.playoffMerchant.teamId)
                : ""
            )}
          </div>
        </div>

        <div class="grid-3 section-gap">
          ${awardCard(
            "Most Clutch",
            awards.mostClutch,
            awards.mostClutch
              ? `${fmt(awards.mostClutch.pressureRating, 1)} Pressure Rating`
              : "-",
            "Best qualified blend of close-game, championship-bracket, and winning-opponent results."
          )}

          ${awardCard(
            "Playoff Merchant",
            awards.playoffMerchant,
            awards.playoffMerchant
              ? `${recordPctText(awards.playoffMerchant.championshipRecord)} bracket win rate`
              : "-",
            awards.playoffMerchant
              ? `${recordText(awards.playoffMerchant.championshipRecord)} across ${awards.playoffMerchant.championshipRecord.games} championship-bracket games`
              : "",
            "warn"
          )}

          ${awardCard(
            "Giant Killer",
            awards.giantKiller,
            awards.giantKiller
              ? `${recordPctText(awards.giantKiller.winningOppRecord)} win rate`
              : "-",
            awards.giantKiller
              ? `${recordText(awards.giantKiller.winningOppRecord)} against winning-season opponents`
              : ""
          )}

          ${awardCard(
            "Escape Artist",
            awards.escapeArtist,
            awards.escapeArtist
              ? `${awards.escapeArtist.close5Record.wins} close wins`
              : "-",
            "Most wins in games decided by 5 points or fewer."
          )}

          ${awardCard(
            "Heartbreak King",
            awards.heartbreakKing,
            awards.heartbreakKing
              ? `${awards.heartbreakKing.close5Record.losses} close losses`
              : "-",
            "Most losses in games decided by 5 points or fewer.",
            "bad"
          )}
        </div>

        <div class="card section-gap">
          <h3>Pressure Rating Leaderboard</h3>
          ${table(
            [
              "#",
              "Franchise",
              "Rating",
              "<=10 Record",
              "Championship Bracket",
              "vs Winning-Season Teams"
            ],
            ratingRows
          )}
        </div>

        <div class="grid-2 section-gap">
          <div class="card">
            <h3>Close-Game Records</h3>
            <p class="muted">
              Record and win percentage at three different margin thresholds.
            </p>
            ${table(
              ["Franchise", "<=3", "<=5", "<=10"],
              closeRows
            )}
          </div>

          <div class="card">
            <h3>High-Scoring Game Records</h3>
            <p class="muted">
              W-L-T when the franchise itself scored at least the listed point total.
            </p>
            ${table(
              ["Franchise", "130+", "140+", "150+"],
              thresholdRows
            )}
          </div>
        </div>

        <div class="card section-gap">
          <h3>Championship-Bracket Resume</h3>
          <p class="muted">
            Only saved WINNERS_BRACKET games are counted here.
            Consolation games are excluded.
          </p>
          ${table(
            [
              "Franchise",
              "Apps",
              "W-L-T",
              "Points/Game",
              "Best Score",
              "Worst Score"
            ],
            playoffRows
          )}
        </div>

        <div class="grid-2 section-gap">
          <div class="card">
            <h3>Escape Artist - Closest Wins</h3>
            ${table(
              [
                "Franchise",
                "Score",
                "Margin",
                "Opponent",
                "When",
                "Stage",
                "Result"
              ],
              closestWins.map(x => gameRow(x, "Escape"))
            )}
          </div>

          <div class="card">
            <h3>Heartbreakers - Closest Losses</h3>
            ${table(
              [
                "Franchise",
                "Score",
                "Margin",
                "Opponent",
                "When",
                "Stage",
                "Result"
              ],
              closestLosses.map(x => gameRow(x, "Heartbreak"))
            )}
          </div>
        </div>

        <div class="grid-2 section-gap">
          <div class="card">
            <h3>Highest-Scoring Losses</h3>
            <p class="muted">
              The most painful losses where a strong fantasy score still was not enough.
            </p>
            ${table(
              [
                "Franchise",
                "Score",
                "Margin",
                "Opponent",
                "When",
                "Stage",
                "Result"
              ],
              highestScoringLosses.map(x => gameRow(x, "Loss"))
            )}
          </div>

          <div class="card">
            <h3>Best Championship-Bracket Scores</h3>
            ${table(
              [
                "Franchise",
                "Score",
                "Margin",
                "Opponent",
                "When",
                "Stage",
                "Result"
              ],
              bestPlayoffGames.map(x => gameRow(x, "Playoff"))
            )}
          </div>
        </div>
      </div>
    `;
  }

  pages.records = function () {
    baseRecordsPage();

    const content = $("#content");
    if (!content || $("#clutchPressureV109")) return;

    content.insertAdjacentHTML("beforeend", buildPressureSection());

    setStatus(
      "Records + streaks + clutch pressure analytics loaded",
      "good"
    );
  };
})();
