// LFL Filters & Records Explorer v11.0
// Safe presentation-layer patch.
// Does not modify source history data or prior feature patches.
// Uses only decided matchup-level history already loaded into DATA.matchups.

window.LFL_RECORDS_EXPLORER_VERSION = "v11.0";

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
    const homeId = tid(game["Home Team ID"]);
    const awayId = tid(game["Away Team ID"]);
    const homeScore = num(game["Home Score"]);
    const awayScore = num(game["Away Score"]);

    return (
      homeId != null &&
      awayId != null &&
      homeScore != null &&
      awayScore != null &&
      String(game.Winner || "").toUpperCase() !== "UNDECIDED"
    );
  }

  function stageGroup(game) {
    const tier = String(game["Playoff Tier"] || "NONE");
    if (tier === "NONE") return "regular";
    if (tier === "WINNERS_BRACKET") return "championship";
    return "other-postseason";
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

  function allGames() {
    return (DATA?.matchups || []).filter(validGame);
  }

  function franchiseOptions() {
    return franchiseStats()
      .slice()
      .sort((a, b) =>
        a.currentTeam.localeCompare(b.currentTeam)
      );
  }

  function gamePerspective(game, focusId) {
    const homeId = tid(game["Home Team ID"]);
    const awayId = tid(game["Away Team ID"]);
    const homeScore = num(game["Home Score"]);
    const awayScore = num(game["Away Score"]);

    if (focusId == null) {
      return {
        focusId: null,
        focusTeam: "",
        focusOwner: "",
        opponentId: null,
        opponentTeam: "",
        opponentOwner: "",
        score: Math.max(homeScore, awayScore),
        opponentScore: Math.min(homeScore, awayScore),
        result: "",
        winnerId:
          homeScore > awayScore ? homeId : awayScore > homeScore ? awayId : null
      };
    }

    const isHome = homeId === focusId;
    if (!isHome && awayId !== focusId) return null;

    const score = isHome ? homeScore : awayScore;
    const opponentScore = isHome ? awayScore : homeScore;
    const opponentId = isHome ? awayId : homeId;

    return {
      focusId,
      focusTeam: cleanTeam(
        isHome ? game["Home Team"] : game["Away Team"]
      ),
      focusOwner: canonicalOwner(
        isHome ? game["Home Owner"] : game["Away Owner"]
      ),
      opponentId,
      opponentTeam: cleanTeam(
        isHome ? game["Away Team"] : game["Home Team"]
      ),
      opponentOwner: canonicalOwner(
        isHome ? game["Away Owner"] : game["Home Owner"]
      ),
      score,
      opponentScore,
      result:
        score > opponentScore ? "W" : score < opponentScore ? "L" : "T",
      winnerId:
        homeScore > awayScore ? homeId : awayScore > homeScore ? awayId : null
    };
  }

  function margin(game) {
    return Math.abs(
      num(game["Home Score"]) - num(game["Away Score"])
    );
  }

  function combinedPoints(game) {
    return num(game["Home Score"]) + num(game["Away Score"]);
  }

  function gameKey(game) {
    return `${Number(game.Season)}|${Number(game["Matchup ID"])}`;
  }

  function getLens() {
    return $("#recordsExplorerLens")?.value || "all";
  }

  function lensMatches(game, perspective, lens) {
    const m = margin(game);

    if (lens === "all") return true;
    if (lens === "highest-scores") {
      if (perspective?.focusId != null) return true;
      return true;
    }
    if (lens === "biggest-blowouts") return true;
    if (lens === "closest-games") return true;
    if (lens === "championship") return stageGroup(game) === "championship";
    if (lens === "high-scoring-losses") {
      return perspective?.focusId != null && perspective.result === "L";
    }
    if (lens === "closest-wins") {
      return perspective?.focusId != null && perspective.result === "W";
    }
    if (lens === "closest-losses") {
      return perspective?.focusId != null && perspective.result === "L";
    }

    return true;
  }

  function sortRows(rows, sortMode, lens, focusId) {
    const copy = rows.slice();

    const defaultLensSort = () => {
      if (lens === "highest-scores") {
        return copy.sort((a, b) => {
          const av =
            focusId != null
              ? a.perspective.score
              : Math.max(num(a.game["Home Score"]), num(a.game["Away Score"]));
          const bv =
            focusId != null
              ? b.perspective.score
              : Math.max(num(b.game["Home Score"]), num(b.game["Away Score"]));
          return bv - av || b.game.Season - a.game.Season;
        });
      }

      if (lens === "biggest-blowouts") {
        return copy.sort(
          (a, b) =>
            margin(b.game) - margin(a.game) ||
            b.game.Season - a.game.Season
        );
      }

      if (
        lens === "closest-games" ||
        lens === "closest-wins" ||
        lens === "closest-losses"
      ) {
        return copy.sort(
          (a, b) =>
            margin(a.game) - margin(b.game) ||
            b.game.Season - a.game.Season
        );
      }

      if (lens === "high-scoring-losses") {
        return copy.sort(
          (a, b) =>
            b.perspective.score - a.perspective.score ||
            margin(a.game) - margin(b.game)
        );
      }

      return copy.sort(
        (a, b) =>
          Number(b.game.Season) - Number(a.game.Season) ||
          Number(b.game.Week) - Number(a.game.Week) ||
          Number(b.game["Matchup ID"]) - Number(a.game["Matchup ID"])
      );
    };

    if (sortMode === "lens") return defaultLensSort();

    if (sortMode === "newest") {
      return copy.sort(
        (a, b) =>
          Number(b.game.Season) - Number(a.game.Season) ||
          Number(b.game.Week) - Number(a.game.Week)
      );
    }

    if (sortMode === "oldest") {
      return copy.sort(
        (a, b) =>
          Number(a.game.Season) - Number(b.game.Season) ||
          Number(a.game.Week) - Number(b.game.Week)
      );
    }

    if (sortMode === "score-high") {
      return copy.sort((a, b) => {
        const av =
          focusId != null
            ? a.perspective.score
            : Math.max(num(a.game["Home Score"]), num(a.game["Away Score"]));
        const bv =
          focusId != null
            ? b.perspective.score
            : Math.max(num(b.game["Home Score"]), num(b.game["Away Score"]));
        return bv - av;
      });
    }

    if (sortMode === "margin-high") {
      return copy.sort((a, b) => margin(b.game) - margin(a.game));
    }

    if (sortMode === "margin-low") {
      return copy.sort((a, b) => margin(a.game) - margin(b.game));
    }

    if (sortMode === "combined-high") {
      return copy.sort(
        (a, b) => combinedPoints(b.game) - combinedPoints(a.game)
      );
    }

    return defaultLensSort();
  }

  function detailPanel(game) {
    const homeScore = num(game["Home Score"]);
    const awayScore = num(game["Away Score"]);
    const homeId = tid(game["Home Team ID"]);
    const awayId = tid(game["Away Team ID"]);

    const winner =
      homeScore > awayScore
        ? cleanTeam(game["Home Team"])
        : awayScore > homeScore
        ? cleanTeam(game["Away Team"])
        : "Tie";

    return `
      <div class="card mini-card section-gap">
        <div class="card-heading-row">
          <div>
            <span class="section-eyebrow">
              ${esc(game.Season)} - WEEK ${esc(game.Week)}
            </span>
            <h3>${esc(stageLabel(game))}</h3>
          </div>
          <span class="badge">Matchup ${esc(game["Matchup ID"])}</span>
        </div>

        <div class="rivalry-summary">
          ${metric(
            cleanTeam(game["Home Team"]),
            fmt(homeScore, 2),
            `${canonicalOwner(game["Home Owner"])} - Home`
          )}
          ${metric(
            cleanTeam(game["Away Team"]),
            fmt(awayScore, 2),
            `${canonicalOwner(game["Away Owner"])} - Away`
          )}
          ${metric(
            "Winner",
            winner,
            `${fmt(margin(game), 2)} point margin`
          )}
          ${metric(
            "Combined points",
            fmt(combinedPoints(game), 2),
            `${latestTeamById(homeId)} vs ${latestTeamById(awayId)}`
          )}
        </div>

        <p class="muted">
          Matchup-level history only. Weekly player box scores will plug into
          this detail view after the historical lineup reconstruction phase.
        </p>
      </div>
    `;
  }

  function buildShell() {
    const franchises = franchiseOptions();
    const seasons = [
      ...new Set(allGames().map(g => Number(g.Season)))
    ].sort((a, b) => b - a);

    const teamOptions = franchises
      .map(
        f =>
          `<option value="${f.id}">
            ${esc(f.currentTeam)} - ${esc(f.currentManager)}
          </option>`
      )
      .join("");

    const opponentOptions = franchises
      .map(
        f =>
          `<option value="${f.id}">
            ${esc(f.currentTeam)}
          </option>`
      )
      .join("");

    const seasonOptions = seasons
      .map(y => `<option value="${y}">${y}</option>`)
      .join("");

    return `
      <div class="card section-gap" id="recordsExplorerV110">
        <div class="card-heading-row">
          <div>
            <span class="section-eyebrow">SEARCH THE ARCHIVE</span>
            <h2>Records Explorer</h2>
          </div>
          <span class="badge good">v11.0</span>
        </div>

        <p class="muted">
          Filter every decided saved matchup by franchise, opponent, season,
          stage, result, score and margin. Select a franchise to switch the
          table into that team's perspective.
        </p>

        <div class="controls section-gap">
          <label>
            Record View
            <select id="recordsExplorerLens">
              <option value="all">All Games</option>
              <option value="highest-scores">Highest Scores</option>
              <option value="biggest-blowouts">Biggest Blowouts</option>
              <option value="closest-games">Closest Games</option>
              <option value="championship">Championship Bracket</option>
              <option value="high-scoring-losses">Highest-Scoring Losses</option>
              <option value="closest-wins">Closest Wins</option>
              <option value="closest-losses">Closest Losses</option>
            </select>
          </label>

          <label>
            Franchise
            <select id="recordsExplorerTeam">
              <option value="">All franchises</option>
              ${teamOptions}
            </select>
          </label>

          <label>
            Opponent
            <select id="recordsExplorerOpponent">
              <option value="">All opponents</option>
              ${opponentOptions}
            </select>
          </label>

          <label>
            Season
            <select id="recordsExplorerSeason">
              <option value="">All seasons</option>
              ${seasonOptions}
            </select>
          </label>

          <label>
            Stage
            <select id="recordsExplorerStage">
              <option value="">All stages</option>
              <option value="regular">Regular Season</option>
              <option value="championship">Championship Bracket</option>
              <option value="other-postseason">Other Postseason</option>
            </select>
          </label>

          <label>
            Result
            <select id="recordsExplorerResult">
              <option value="">All results</option>
              <option value="W">Wins</option>
              <option value="L">Losses</option>
              <option value="T">Ties</option>
            </select>
          </label>

          <label>
            Minimum Score
            <select id="recordsExplorerMinScore">
              <option value="">Any score</option>
              <option value="100">100+</option>
              <option value="110">110+</option>
              <option value="120">120+</option>
              <option value="130">130+</option>
              <option value="140">140+</option>
              <option value="150">150+</option>
            </select>
          </label>

          <label>
            Margin
            <select id="recordsExplorerMargin">
              <option value="">Any margin</option>
              <option value="3">3 or fewer</option>
              <option value="5">5 or fewer</option>
              <option value="10">10 or fewer</option>
              <option value="gt10">More than 10</option>
            </select>
          </label>

          <label>
            Sort
            <select id="recordsExplorerSort">
              <option value="lens">Best for selected view</option>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="score-high">Highest score</option>
              <option value="margin-high">Largest margin</option>
              <option value="margin-low">Smallest margin</option>
              <option value="combined-high">Highest combined points</option>
            </select>
          </label>
        </div>

        <div class="section-gap">
          <button class="badge" id="recordsExplorerReset">Reset filters</button>
        </div>

        <div id="recordsExplorerSummary"></div>
        <div id="recordsExplorerTable" class="section-gap"></div>
        <div id="recordsExplorerDetail"></div>
      </div>
    `;
  }

  function collectFilteredRows() {
    const games = allGames();
    const focusId = Number($("#recordsExplorerTeam")?.value) || null;
    const opponentId =
      Number($("#recordsExplorerOpponent")?.value) || null;
    const season =
      Number($("#recordsExplorerSeason")?.value) || null;
    const stage = $("#recordsExplorerStage")?.value || "";
    const result = $("#recordsExplorerResult")?.value || "";
    const minScore =
      Number($("#recordsExplorerMinScore")?.value) || null;
    const marginFilter = $("#recordsExplorerMargin")?.value || "";
    const lens = getLens();
    const sortMode = $("#recordsExplorerSort")?.value || "lens";

    let rows = games
      .map(game => ({
        game,
        perspective: gamePerspective(game, focusId)
      }))
      .filter(row => {
        const { game, perspective } = row;

        if (focusId != null && !perspective) return false;

        if (opponentId != null) {
          if (focusId != null) {
            if (perspective.opponentId !== opponentId) return false;
          } else {
            const homeId = tid(game["Home Team ID"]);
            const awayId = tid(game["Away Team ID"]);
            if (homeId !== opponentId && awayId !== opponentId) return false;
          }
        }

        if (season != null && Number(game.Season) !== season) return false;

        if (stage && stageGroup(game) !== stage) return false;

        if (result) {
          if (focusId == null) return false;
          if (perspective.result !== result) return false;
        }

        if (minScore != null) {
          if (focusId != null) {
            if (perspective.score < minScore) return false;
          } else {
            const high = Math.max(
              num(game["Home Score"]),
              num(game["Away Score"])
            );
            if (high < minScore) return false;
          }
        }

        const m = margin(game);

        if (marginFilter) {
          if (marginFilter === "gt10") {
            if (m <= 10) return false;
          } else if (m > Number(marginFilter)) {
            return false;
          }
        }

        if (!lensMatches(game, perspective, lens)) return false;

        return true;
      });

    rows = sortRows(rows, sortMode, lens, focusId);

    return {
      rows,
      focusId,
      opponentId,
      season,
      stage,
      result,
      minScore,
      marginFilter,
      lens
    };
  }

  function summaryHtml(filtered) {
    const { rows, focusId } = filtered;

    if (!rows.length) {
      return `<div class="empty">No games match those filters.</div>`;
    }

    if (focusId != null) {
      let wins = 0;
      let losses = 0;
      let ties = 0;

      for (const row of rows) {
        if (row.perspective.result === "W") wins++;
        else if (row.perspective.result === "L") losses++;
        else ties++;
      }

      const avgScore =
        rows.reduce(
          (sum, row) => sum + row.perspective.score,
          0
        ) / rows.length;

      const avgOpponent =
        rows.reduce(
          (sum, row) => sum + row.perspective.opponentScore,
          0
        ) / rows.length;

      const avgMargin =
        rows.reduce(
          (sum, row) => sum + margin(row.game),
          0
        ) / rows.length;

      return `
        <div class="rivalry-summary">
          ${metric("Games", rows.length, latestTeamById(focusId))}
          ${metric("W-L-T", `${wins}-${losses}-${ties}`)}
          ${metric(
            "Avg score",
            fmt(avgScore, 2),
            `${fmt(avgOpponent, 2)} opponent avg`
          )}
          ${metric("Avg margin", fmt(avgMargin, 2))}
        </div>
      `;
    }

    const avgCombined =
      rows.reduce(
        (sum, row) => sum + combinedPoints(row.game),
        0
      ) / rows.length;

    const avgMargin =
      rows.reduce(
        (sum, row) => sum + margin(row.game),
        0
      ) / rows.length;

    const championship = rows.filter(
      row => stageGroup(row.game) === "championship"
    ).length;

    const highest = Math.max(
      ...rows.map(row =>
        Math.max(
          num(row.game["Home Score"]),
          num(row.game["Away Score"])
        )
      )
    );

    return `
      <div class="rivalry-summary">
        ${metric("Games", rows.length)}
        ${metric("Avg combined points", fmt(avgCombined, 2))}
        ${metric("Avg margin", fmt(avgMargin, 2))}
        ${metric(
          "Highest team score",
          fmt(highest, 2),
          `${championship} championship-bracket games`
        )}
      </div>
    `;
  }

  function resultBadge(result) {
    const tone =
      result === "W" ? "good" : result === "L" ? "bad" : "warn";
    return `<span class="badge ${tone}">${esc(result)}</span>`;
  }

  function tableHtml(filtered) {
    const { rows, focusId, lens } = filtered;
    const shown = rows.slice(0, 100);

    if (!shown.length) {
      return `<div class="empty">No games match those filters.</div>`;
    }

    if (focusId != null) {
      const body = shown.map(row => {
        const { game, perspective } = row;

        return `<tr>
          <td>${game.Season}</td>
          <td>${game.Week}</td>
          <td>${esc(stageLabel(game))}</td>
          <td>
            <strong>${esc(
              perspective.opponentTeam ||
                latestTeamById(perspective.opponentId)
            )}</strong>
            <br><span class="muted">${esc(
              perspective.opponentOwner || ""
            )}</span>
          </td>
          <td><strong>${fmt(perspective.score, 2)}</strong></td>
          <td>${fmt(perspective.opponentScore, 2)}</td>
          <td>${resultBadge(perspective.result)}</td>
          <td>${fmt(margin(game), 2)}</td>
          <td>
            <button
              class="badge records-explorer-detail"
              data-game-key="${esc(gameKey(game))}">
              View
            </button>
          </td>
        </tr>`;
      });

      return `
        ${
          rows.length > 100
            ? `<p class="muted">Showing first 100 of ${rows.length} matching games.</p>`
            : ""
        }
        ${table(
          [
            "Season",
            "Week",
            "Stage",
            "Opponent",
            latestTeamById(focusId),
            "Opponent Score",
            "Result",
            "Margin",
            "Details"
          ],
          body
        )}
      `;
    }

    const body = shown.map(row => {
      const { game } = row;
      const homeScore = num(game["Home Score"]);
      const awayScore = num(game["Away Score"]);

      const winner =
        homeScore > awayScore
          ? cleanTeam(game["Home Team"])
          : awayScore > homeScore
          ? cleanTeam(game["Away Team"])
          : "Tie";

      return `<tr>
        <td>${game.Season}</td>
        <td>${game.Week}</td>
        <td>${esc(stageLabel(game))}</td>
        <td>
          <strong>${esc(cleanTeam(game["Away Team"]))}</strong>
          <br><span class="muted">${esc(
            canonicalOwner(game["Away Owner"])
          )}</span>
        </td>
        <td><strong>${fmt(awayScore, 2)}</strong></td>
        <td>
          <strong>${esc(cleanTeam(game["Home Team"]))}</strong>
          <br><span class="muted">${esc(
            canonicalOwner(game["Home Owner"])
          )}</span>
        </td>
        <td><strong>${fmt(homeScore, 2)}</strong></td>
        <td>${fmt(margin(game), 2)}</td>
        <td>${esc(winner)}</td>
        <td>
          <button
            class="badge records-explorer-detail"
            data-game-key="${esc(gameKey(game))}">
            View
          </button>
        </td>
      </tr>`;
    });

    const lensNote =
      lens === "all"
        ? ""
        : `<p class="muted">Sorted for the selected record view.</p>`;

    return `
      ${lensNote}
      ${
        rows.length > 100
          ? `<p class="muted">Showing first 100 of ${rows.length} matching games.</p>`
          : ""
      }
      ${table(
        [
          "Season",
          "Week",
          "Stage",
          "Away",
          "Away Score",
          "Home",
          "Home Score",
          "Margin",
          "Winner",
          "Details"
        ],
        body
      )}
    `;
  }

  function syncControls() {
    const focusId = Number($("#recordsExplorerTeam")?.value) || null;
    const resultControl = $("#recordsExplorerResult");
    const lensControl = $("#recordsExplorerLens");

    if (resultControl) {
      resultControl.disabled = focusId == null;
      if (focusId == null) resultControl.value = "";
    }

    if (lensControl && focusId == null) {
      if (
        [
          "high-scoring-losses",
          "closest-wins",
          "closest-losses"
        ].includes(lensControl.value)
      ) {
        lensControl.value = "all";
      }
    }
  }

  function bindDetails(rows) {
    document
      .querySelectorAll(
        "#recordsExplorerTable .records-explorer-detail"
      )
      .forEach(button => {
        button.addEventListener("click", () => {
          const key = button.dataset.gameKey;
          const match = rows.find(
            row => gameKey(row.game) === key
          );
          const detail = $("#recordsExplorerDetail");

          if (!match || !detail) return;

          detail.innerHTML = detailPanel(match.game);
          detail.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
          });
        });
      });
  }

  function renderExplorer() {
    syncControls();

    const filtered = collectFilteredRows();
    const summary = $("#recordsExplorerSummary");
    const tableArea = $("#recordsExplorerTable");
    const detail = $("#recordsExplorerDetail");

    if (!summary || !tableArea || !detail) return;

    summary.innerHTML = summaryHtml(filtered);
    tableArea.innerHTML = tableHtml(filtered);
    detail.innerHTML = "";

    bindDetails(filtered.rows.slice(0, 100));
  }

  function resetExplorer() {
    const ids = [
      "recordsExplorerLens",
      "recordsExplorerTeam",
      "recordsExplorerOpponent",
      "recordsExplorerSeason",
      "recordsExplorerStage",
      "recordsExplorerResult",
      "recordsExplorerMinScore",
      "recordsExplorerMargin",
      "recordsExplorerSort"
    ];

    for (const id of ids) {
      const el = $(`#${id}`);
      if (!el) continue;

      if (id === "recordsExplorerLens") el.value = "all";
      else if (id === "recordsExplorerSort") el.value = "lens";
      else el.value = "";
    }

    renderExplorer();
  }

  function bindExplorer() {
    const ids = [
      "recordsExplorerLens",
      "recordsExplorerTeam",
      "recordsExplorerOpponent",
      "recordsExplorerSeason",
      "recordsExplorerStage",
      "recordsExplorerResult",
      "recordsExplorerMinScore",
      "recordsExplorerMargin",
      "recordsExplorerSort"
    ];

    for (const id of ids) {
      $(`#${id}`)?.addEventListener("change", renderExplorer);
    }

    $("#recordsExplorerReset")?.addEventListener(
      "click",
      resetExplorer
    );
  }

  pages.records = function () {
    baseRecordsPage();

    const content = $("#content");
    if (!content || $("#recordsExplorerV110")) return;

    const streaks = $("#streaksRecordsV108");

    if (streaks) {
      streaks.insertAdjacentHTML("beforebegin", buildShell());
    } else {
      content.insertAdjacentHTML("beforeend", buildShell());
    }

    bindExplorer();
    renderExplorer();

    setStatus(
      "Records explorer + deep records + pressure analytics loaded",
      "good"
    );
  };
})();
