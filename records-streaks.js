// LFL Streaks & Deeper Records v10.8
// Safe presentation-layer patch.
// Does not modify history data, app.js, wins, trades, manager history, or rivalries.
// Uses saved matchup-level records plus saved season roster points.

window.LFL_STREAKS_RECORDS_VERSION = "v10.8";

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

  function stageGroup(game) {
    const tier = String(game["Playoff Tier"] || "NONE");
    if (tier === "NONE") return "regular";
    if (tier === "WINNERS_BRACKET") return "championship";
    return "consolation";
  }

  function validGame(game) {
    const home = tid(game["Home Team ID"]);
    const away = tid(game["Away Team ID"]);
    const homeScore = num(game["Home Score"]);
    const awayScore = num(game["Away Score"]);

    if (
      home == null ||
      away == null ||
      homeScore == null ||
      awayScore == null
    ) {
      return false;
    }

    return String(game.Winner || "").toUpperCase() !== "UNDECIDED";
  }

  function games() {
    return (DATA?.matchups || []).filter(validGame);
  }

  function teamEvents() {
    const map = new Map();

    for (const game of games()) {
      const home = tid(game["Home Team ID"]);
      const away = tid(game["Away Team ID"]);
      const homeScore = num(game["Home Score"]);
      const awayScore = num(game["Away Score"]);

      const entries = [
        {
          id: home,
          opponentId: away,
          score: homeScore,
          opponentScore: awayScore
        },
        {
          id: away,
          opponentId: home,
          score: awayScore,
          opponentScore: homeScore
        }
      ];

      for (const entry of entries) {
        if (!map.has(entry.id)) map.set(entry.id, []);

        const result =
          entry.score > entry.opponentScore
            ? "W"
            : entry.score < entry.opponentScore
            ? "L"
            : "T";

        map.get(entry.id).push({
          teamId: entry.id,
          opponentId: entry.opponentId,
          season: Number(game.Season),
          week: Number(game.Week),
          matchupId: Number(game["Matchup ID"]),
          score: entry.score,
          opponentScore: entry.opponentScore,
          result,
          stage: stageGroup(game),
          playoffTier: String(game["Playoff Tier"] || "NONE"),
          game
        });
      }
    }

    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          a.season - b.season ||
          a.week - b.week ||
          a.matchupId - b.matchupId
      );
    }

    return map;
  }

  function rangeText(sequence) {
    if (!sequence?.length) return "";
    const first = sequence[0];
    const last = sequence[sequence.length - 1];

    if (first.season === last.season) {
      if (first.week === last.week) {
        return `${first.season} W${first.week}`;
      }
      return `${first.season} W${first.week}-W${last.week}`;
    }

    return `${first.season} W${first.week} - ${last.season} W${last.week}`;
  }

  function longestResultStreak(events, result, stage = null) {
    let best = null;

    for (const [teamId, list] of events.entries()) {
      let current = [];

      for (const event of list) {
        if (stage && event.stage !== stage) continue;

        if (event.result === result) {
          current.push(event);

          if (!best || current.length > best.length) {
            best = {
              teamId,
              length: current.length,
              sequence: current.slice()
            };
          }
        } else {
          current = [];
        }
      }
    }

    return best;
  }

  function longestConditionStreak(events, test) {
    let best = null;

    for (const [teamId, list] of events.entries()) {
      let current = [];

      for (const event of list) {
        if (test(event)) {
          current.push(event);

          if (!best || current.length > best.length) {
            best = {
              teamId,
              length: current.length,
              sequence: current.slice()
            };
          }
        } else {
          current = [];
        }
      }
    }

    return best;
  }

  function bestScoringWindow(events, size) {
    let best = null;

    for (const [teamId, list] of events.entries()) {
      if (list.length < size) continue;

      for (let i = 0; i <= list.length - size; i++) {
        const sequence = list.slice(i, i + size);
        const total = sequence.reduce((sum, x) => sum + x.score, 0);

        if (!best || total > best.total) {
          best = {
            teamId,
            size,
            total,
            average: total / size,
            sequence
          };
        }
      }
    }

    return best;
  }

  function extremeTeamGames(events) {
    const appearances = [];

    for (const [teamId, list] of events.entries()) {
      for (const event of list) appearances.push({ teamId, event });
    }

    const wins = appearances.filter(x => x.event.result === "W");
    const losses = appearances.filter(x => x.event.result === "L");

    return {
      highestWin: wins.sort((a, b) => b.event.score - a.event.score)[0],
      highestLoss: losses.sort((a, b) => b.event.score - a.event.score)[0],
      lowestWin: wins.sort((a, b) => a.event.score - b.event.score)[0]
    };
  }

  function longestRivalryWinStreak() {
    const pairMap = new Map();

    for (const game of games()) {
      const home = tid(game["Home Team ID"]);
      const away = tid(game["Away Team ID"]);
      const homeScore = num(game["Home Score"]);
      const awayScore = num(game["Away Score"]);

      const lo = Math.min(home, away);
      const hi = Math.max(home, away);
      const key = `${lo}|${hi}`;

      if (!pairMap.has(key)) pairMap.set(key, []);

      const winner =
        homeScore > awayScore ? home : awayScore > homeScore ? away : null;

      pairMap.get(key).push({
        season: Number(game.Season),
        week: Number(game.Week),
        matchupId: Number(game["Matchup ID"]),
        winner,
        game
      });
    }

    let best = null;

    for (const [key, list] of pairMap.entries()) {
      list.sort(
        (a, b) =>
          a.season - b.season ||
          a.week - b.week ||
          a.matchupId - b.matchupId
      );

      let currentWinner = null;
      let current = [];

      for (const event of list) {
        if (event.winner == null) {
          currentWinner = null;
          current = [];
          continue;
        }

        if (event.winner === currentWinner) {
          current.push(event);
        } else {
          currentWinner = event.winner;
          current = [event];
        }

        if (!best || current.length > best.length) {
          const [a, b] = key.split("|").map(Number);
          best = {
            winnerId: currentWinner,
            opponentId: currentWinner === a ? b : a,
            length: current.length,
            sequence: current.slice()
          };
        }
      }
    }

    return best;
  }

  function currentStreak(list) {
    if (!list?.length) return null;

    const last = list[list.length - 1];
    const result = last.result;
    let length = 0;

    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].result !== result) break;
      length++;
    }

    return {
      result,
      length,
      last
    };
  }

  function activeTeamIds() {
    const rows = DATA?.teams || [];
    const maxSeason = Math.max(
      ...rows.map(x => Number(x.Season)).filter(Number.isFinite)
    );

    return [
      ...new Set(
        rows
          .filter(x => Number(x.Season) === maxSeason)
          .map(x => tid(x["Team ID"]))
          .filter(x => x != null)
      )
    ];
  }

  function playerSeasonRows() {
    return (DATA?.rosters || [])
      .filter(row => {
        const points = num(row["Season Points"]);
        return points != null && String(row["Player Name"] || "").trim();
      })
      .map(row => ({
        season: Number(row.Season),
        teamId: tid(row["Team ID"]),
        team: cleanTeam(row["Team Name"]),
        owner: canonicalOwner(row["Owner(s)"]),
        player: String(row["Player Name"] || "").trim(),
        position: String(row["Lineup Slot"] || ""),
        points: num(row["Season Points"])
      }))
      .sort((a, b) => b.points - a.points);
  }

  function recordRow(label, record, detail = "") {
    if (!record) {
      return `<tr><td>${esc(label)}</td><td colspan="3">No data</td></tr>`;
    }

    return `<tr>
      <td><strong>${esc(label)}</strong></td>
      <td>${displayFranchise(record.teamId)}</td>
      <td><strong>${esc(record.length)}</strong></td>
      <td>${esc(detail || rangeText(record.sequence))}</td>
    </tr>`;
  }

  function teamGameRow(label, item) {
    if (!item) return "";

    const e = item.event;

    return `<tr>
      <td><strong>${esc(label)}</strong></td>
      <td>${displayFranchise(item.teamId)}</td>
      <td><strong>${fmt(e.score, 2)}</strong></td>
      <td>${e.season} W${e.week}</td>
      <td>${fmt(e.opponentScore, 2)}</td>
      <td>${esc(latestTeamById(e.opponentId))}</td>
    </tr>`;
  }

  function buildSection() {
    const events = teamEvents();

    const overallWin = longestResultStreak(events, "W");
    const overallLoss = longestResultStreak(events, "L");
    const regularWin = longestResultStreak(events, "W", "regular");
    const regularLoss = longestResultStreak(events, "L", "regular");
    const championshipWin = longestResultStreak(
      events,
      "W",
      "championship"
    );
    const championshipLoss = longestResultStreak(
      events,
      "L",
      "championship"
    );

    const streak150 = longestConditionStreak(
      events,
      x => x.score >= 150
    );
    const streak100 = longestConditionStreak(
      events,
      x => x.score >= 100
    );
    const streakUnder100 = longestConditionStreak(
      events,
      x => x.score < 100
    );

    const threeGame = bestScoringWindow(events, 3);
    const fiveGame = bestScoringWindow(events, 5);
    const rivalry = longestRivalryWinStreak();
    const extremes = extremeTeamGames(events);
    const playerSeasons = playerSeasonRows();
    const topPlayer = playerSeasons[0];

    const streakRows = [
      recordRow("Longest overall win streak", overallWin),
      recordRow("Longest overall losing streak", overallLoss),
      recordRow("Longest regular-season win streak", regularWin),
      recordRow("Longest regular-season losing streak", regularLoss),
      recordRow(
        "Championship-bracket win streak",
        championshipWin,
        `${rangeText(championshipWin?.sequence)} - consecutive bracket games`
      ),
      recordRow(
        "Championship-bracket losing streak",
        championshipLoss,
        `${rangeText(championshipLoss?.sequence)} - consecutive bracket games`
      )
    ];

    const thresholdRows = [
      recordRow("Consecutive 150+ games", streak150),
      recordRow("Consecutive 100+ games", streak100),
      recordRow("Consecutive games under 100", streakUnder100)
    ];

    if (rivalry) {
      thresholdRows.push(
        `<tr>
          <td><strong>Longest rivalry win streak</strong></td>
          <td>${displayFranchise(rivalry.winnerId)}</td>
          <td><strong>${rivalry.length}</strong></td>
          <td>
            vs ${esc(latestTeamById(rivalry.opponentId))}
            - ${esc(rangeText(rivalry.sequence))}
          </td>
        </tr>`
      );
    }

    const scoringRows = [threeGame, fiveGame]
      .filter(Boolean)
      .map(record => `
        <tr>
          <td><strong>${record.size}-game scoring run</strong></td>
          <td>${displayFranchise(record.teamId)}</td>
          <td><strong>${fmt(record.total, 2)}</strong></td>
          <td>${fmt(record.average, 2)}</td>
          <td>${esc(rangeText(record.sequence))}</td>
        </tr>
      `);

    const extremeRows = [
      teamGameRow("Highest-scoring win", extremes.highestWin),
      teamGameRow("Highest-scoring loss", extremes.highestLoss),
      teamGameRow("Lowest-scoring win", extremes.lowestWin)
    ].filter(Boolean);

    const currentRows = activeTeamIds()
      .map(teamId => {
        const streak = currentStreak(events.get(teamId) || []);
        return streak ? { teamId, ...streak } : null;
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.length - a.length ||
          String(a.result).localeCompare(String(b.result))
      )
      .map(x => {
        const tone =
          x.result === "W" ? "good" : x.result === "L" ? "bad" : "warn";

        return `<tr>
          <td>${displayFranchise(x.teamId)}</td>
          <td><span class="badge ${tone}">${x.result}${x.length}</span></td>
          <td>${x.last.season} W${x.last.week}</td>
        </tr>`;
      });

    const playerRows = playerSeasons.slice(0, 15).map((x, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>
          <strong>${esc(x.player)} (${esc(x.team)})</strong>
          <br><span class="muted">${esc(x.owner)}</span>
        </td>
        <td>${x.season}</td>
        <td>${esc(x.position || "-")}</td>
        <td><strong>${fmt(x.points, 2)}</strong></td>
      </tr>
    `);

    return `
      <div class="section-gap" id="streaksRecordsV108">
        <div class="card">
          <div class="card-heading-row">
            <div>
              <span class="section-eyebrow">DEEP RECORD BOOK</span>
              <h2>Streaks & Scoring Runs</h2>
            </div>
            <span class="badge good">v10.8</span>
          </div>

          <div class="metrics">
            ${metric(
              "Longest win streak",
              overallWin?.length ?? "-",
              overallWin ? latestTeamById(overallWin.teamId) : ""
            )}
            ${metric(
              "Longest losing streak",
              overallLoss?.length ?? "-",
              overallLoss ? latestTeamById(overallLoss.teamId) : ""
            )}
            ${metric(
              "Best 3-game run",
              threeGame ? fmt(threeGame.total, 1) : "-",
              threeGame ? latestTeamById(threeGame.teamId) : ""
            )}
            ${metric(
              "Rivalry win streak",
              rivalry?.length ?? "-",
              rivalry
                ? `${latestTeamById(rivalry.winnerId)} vs ${latestTeamById(
                    rivalry.opponentId
                  )}`
                : ""
            )}
          </div>
        </div>

        <div class="grid-2 section-gap">
          <div class="card">
            <h3>Winning & Losing Streaks</h3>
            <p class="muted">
              Overall streaks use every decided saved matchup.
              Championship-bracket streaks use consecutive WINNERS_BRACKET games.
            </p>
            ${table(["Record", "Franchise", "Games", "Span"], streakRows)}
          </div>

          <div class="card">
            <h3>Scoring & Rivalry Streaks</h3>
            ${table(["Record", "Franchise", "Games", "Span / Opponent"], thresholdRows)}
          </div>
        </div>

        <div class="grid-2 section-gap">
          <div class="card">
            <h3>Best Multi-Game Scoring Runs</h3>
            ${table(
              ["Run", "Franchise", "Total", "Avg", "Span"],
              scoringRows
            )}
          </div>

          <div class="card">
            <h3>Extreme Outcomes</h3>
            ${table(
              [
                "Record",
                "Franchise",
                "Score",
                "When",
                "Opponent Score",
                "Opponent"
              ],
              extremeRows
            )}
          </div>
        </div>

        <div class="grid-2 section-gap">
          <div class="card">
            <h3>End-of-2025 Active Franchise Streaks</h3>
            <p class="muted">
              Latest historical streak entering the 2026 season.
              Includes regular season and postseason/consolation results.
            </p>
            ${table(["Franchise", "Streak", "Last Game"], currentRows)}
          </div>

          <div class="card">
            <h3>Player Record Leaders</h3>

            ${
              topPlayer
                ? `<div class="identity-note">
                    <span class="badge good">Single-season record</span>
                    <div>
                      <strong>
                        ${esc(topPlayer.player)} (${esc(topPlayer.team)})
                      </strong>
                      <span class="muted">
                        ${topPlayer.season} - ${fmt(topPlayer.points, 2)} fantasy points
                      </span>
                    </div>
                  </div>`
                : ""
            }

            <div class="identity-note">
              <span class="badge warn">Single-game record</span>
              <div>
                <strong>Pending historical box-score reconstruction</strong>
                <span class="muted">
                  Weekly NFL player stats + Lakelands weekly fantasy
                  ownership/lineups will be validated against saved team scores
                  before this record is published.
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="card section-gap">
          <h3>Highest Player Single-Season Fantasy Totals</h3>
          <p class="muted">
            Team in parentheses is the player's saved ESPN fantasy roster team
            for that season.
          </p>
          ${table(["#", "Player (Fantasy Team)", "Season", "Slot", "Points"], playerRows)}
        </div>
      </div>
    `;
  }

  pages.records = function () {
    baseRecordsPage();

    const content = $("#content");
    if (!content || $("#streaksRecordsV108")) return;

    content.insertAdjacentHTML("beforeend", buildSection());

    setStatus(
      "League records + streaks + player season records loaded",
      "good"
    );
  };
})();
