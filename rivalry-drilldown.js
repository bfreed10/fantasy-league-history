// LFL Rivalry Game Explorer v10.7
// Safe presentation-layer patch.
// Does not modify history data, app.js, wins, trades, or manager history.
// Uses only saved historical matchup-level data already in DATA.matchups.

window.LFL_RIVALRY_DRILLDOWN_VERSION = "v10.7";

(function () {
  const baseRivalriesPage = pages.rivalries;

  const STAGE_LABELS = {
    NONE: "Regular Season",
    WINNERS_BRACKET: "Championship Bracket",
    WINNERS_CONSOLATION_LADDER: "Winners Consolation",
    LOSERS_CONSOLATION_LADDER: "Losers Consolation"
  };

  function stageLabel(value) {
    const key = String(value || "NONE");
    return STAGE_LABELS[key] ||
      key.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  }

  function stageGroup(value) {
    const key = String(value || "NONE");
    if (key === "NONE") return "regular";
    if (key === "WINNERS_BRACKET") return "championship";
    return "consolation";
  }

  function validTeamId(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function validGame(game) {
    const home = validTeamId(game["Home Team ID"]);
    const away = validTeamId(game["Away Team ID"]);
    if (home == null || away == null) return false;

    const hs = Number(game["Home Score"]);
    const as = Number(game["Away Score"]);
    if (!Number.isFinite(hs) || !Number.isFinite(as)) return false;

    const winner = String(game.Winner || "").toUpperCase();
    return winner !== "UNDECIDED";
  }

  function gameKey(game) {
    return `${Number(game.Season)}|${Number(game["Matchup ID"])}`;
  }

  function containsTeam(game, id) {
    if (id == null) return true;
    return (
      validTeamId(game["Home Team ID"]) === id ||
      validTeamId(game["Away Team ID"]) === id
    );
  }

  function headToHead(game, a, b) {
    return containsTeam(game, a) && containsTeam(game, b);
  }

  function resultFor(game, id) {
    const home = validTeamId(game["Home Team ID"]);
    const away = validTeamId(game["Away Team ID"]);
    const hs = Number(game["Home Score"]);
    const as = Number(game["Away Score"]);

    if (hs === as) return "T";

    const winnerId = hs > as ? home : away;
    return winnerId === id ? "W" : "L";
  }

  function scoreFor(game, id) {
    return validTeamId(game["Home Team ID"]) === id
      ? Number(game["Home Score"])
      : Number(game["Away Score"]);
  }

  function opponentFor(game, id) {
    const home = validTeamId(game["Home Team ID"]);
    const isHome = home === id;
    return {
      id: isHome
        ? validTeamId(game["Away Team ID"])
        : validTeamId(game["Home Team ID"]),
      team: cleanTeam(
        isHome ? game["Away Team"] : game["Home Team"]
      ),
      owner: canonicalOwner(
        isHome ? game["Away Owner"] : game["Home Owner"]
      ),
      score: Number(
        isHome ? game["Away Score"] : game["Home Score"]
      )
    };
  }

  function allSavedGames() {
    return (DATA?.matchups || [])
      .filter(validGame)
      .slice()
      .sort(
        (a, b) =>
          Number(b.Season) - Number(a.Season) ||
          Number(b.Week) - Number(a.Week) ||
          Number(b["Matchup ID"]) - Number(a["Matchup ID"])
      );
  }

  function seriesRecord(games, a, b) {
    let aWins = 0;
    let bWins = 0;
    let ties = 0;

    for (const game of games) {
      const r = resultFor(game, a);
      if (r === "W") aWins++;
      else if (r === "L") bWins++;
      else ties++;
    }

    return { aWins, bWins, ties };
  }

  function stageBadge(game) {
    const group = stageGroup(game["Playoff Tier"]);
    const cls =
      group === "championship"
        ? "warn"
        : group === "regular"
        ? ""
        : "good";

    return `<span class="badge ${cls}">${esc(stageLabel(game["Playoff Tier"]))}</span>`;
  }

  function resultBadge(result) {
    const cls = result === "W" ? "good" : result === "L" ? "bad" : "warn";
    return `<span class="badge ${cls}">${result}</span>`;
  }

  function addExplorerShell() {
    const content = $("#content");
    if (!content || $("#rivalryGameExplorer")) return;

    content.insertAdjacentHTML(
      "beforeend",
      `
      <div class="card section-gap" id="rivalryGameExplorer">
        <div class="card-heading-row">
          <div>
            <span class="section-eyebrow">GAME ARCHIVE</span>
            <h2>Rivalry Game Explorer</h2>
          </div>
          <span class="badge good">Matchup-level history</span>
        </div>
        <p class="muted">
          Select one franchise above to browse its full game history,
          or select two franchises to drill into the exact head-to-head series.
        </p>
        <div id="rivalryExplorerBody"></div>
      </div>
      `
    );
  }

  function detailPanel(game) {
    const homeScore = Number(game["Home Score"]);
    const awayScore = Number(game["Away Score"]);
    const margin = Math.abs(homeScore - awayScore);

    let winnerText = "Tie";
    if (homeScore > awayScore) winnerText = cleanTeam(game["Home Team"]);
    if (awayScore > homeScore) winnerText = cleanTeam(game["Away Team"]);

    const homeResult =
      homeScore === awayScore ? "T" : homeScore > awayScore ? "W" : "L";
    const awayResult =
      homeScore === awayScore ? "T" : awayScore > homeScore ? "W" : "L";

    return `
      <div class="card mini-card section-gap">
        <div class="card-heading-row">
          <div>
            <span class="section-eyebrow">
              ${esc(game.Season)} - WEEK ${esc(game.Week)}
            </span>
            <h3>${esc(stageLabel(game["Playoff Tier"]))}</h3>
          </div>
          <span class="badge">Matchup ${esc(game["Matchup ID"])}</span>
        </div>

        <div class="rivalry-summary">
          ${metric(
            cleanTeam(game["Home Team"]),
            fmt(homeScore, 2),
            `${canonicalOwner(game["Home Owner"])} - ${homeResult}`
          )}
          ${metric(
            cleanTeam(game["Away Team"]),
            fmt(awayScore, 2),
            `${canonicalOwner(game["Away Owner"])} - ${awayResult}`
          )}
          ${metric("Winner", winnerText, `${fmt(margin, 2)} point margin`)}
          ${metric("Stage", stageLabel(game["Playoff Tier"]))}
        </div>

        <p class="muted">
          This is the complete saved ESPN matchup-level record for this game.
          The historical archive does not contain reliable weekly player
          lineup scores, so player-by-player scoring is intentionally not
          invented here.
        </p>
      </div>
    `;
  }

  function bindDetails(games) {
    document
      .querySelectorAll("#rivalryExplorerBody [data-game-key]")
      .forEach(button => {
        button.addEventListener("click", () => {
          const key = button.dataset.gameKey;
          const game = games.find(g => gameKey(g) === key);
          const panel = $("#rivalryGameDetail");
          if (!game || !panel) return;

          panel.innerHTML = detailPanel(game);
          panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
      });
  }

  function renderTwoTeamExplorer(a, b, games) {
    const body = $("#rivalryExplorerBody");
    if (!body) return;

    const headToHeadGames = games.filter(g => headToHead(g, a, b));

    if (!headToHeadGames.length) {
      body.innerHTML =
        '<div class="empty">No decided saved games between these franchises.</div>';
      return;
    }

    const record = seriesRecord(headToHeadGames, a, b);
    const aName = latestTeamById(a);
    const bName = latestTeamById(b);

    const years = [
      ...new Set(headToHeadGames.map(g => Number(g.Season)))
    ].sort((x, y) => y - x);

    const closest = [...headToHeadGames].sort(
      (x, y) => Number(x.Margin || 0) - Number(y.Margin || 0)
    )[0];

    const championshipGames = headToHeadGames.filter(
      g => stageGroup(g["Playoff Tier"]) === "championship"
    ).length;

    const postseasonGames = headToHeadGames.filter(
      g => stageGroup(g["Playoff Tier"]) !== "regular"
    ).length;

    body.innerHTML = `
      <div class="rivalry-summary">
        ${metric(
          "Series",
          `${record.aWins}-${record.bWins}-${record.ties}`,
          `${aName} vs ${bName}`
        )}
        ${metric(
          "Saved meetings",
          headToHeadGames.length,
          `${postseasonGames} postseason`
        )}
        ${metric(
          "Championship bracket",
          championshipGames,
          "WINNERS_BRACKET"
        )}
        ${metric(
          "Closest game",
          fmt(Number(closest?.Margin || 0), 2),
          closest ? `${closest.Season} W${closest.Week}` : ""
        )}
      </div>

      <div class="controls section-gap">
        <label>
          Season
          <select id="rivalryGameSeason">
            <option value="">All seasons</option>
            ${years.map(y => `<option value="${y}">${y}</option>`).join("")}
          </select>
        </label>
        <label>
          Stage
          <select id="rivalryGameStage">
            <option value="">All stages</option>
            <option value="regular">Regular Season</option>
            <option value="championship">Championship Bracket</option>
            <option value="consolation">Other Postseason</option>
          </select>
        </label>
      </div>

      <div id="rivalryGameTable"></div>
      <div id="rivalryGameDetail"></div>
    `;

    const drawTable = () => {
      const season = Number($("#rivalryGameSeason")?.value) || null;
      const stage = $("#rivalryGameStage")?.value || "";

      const shown = headToHeadGames.filter(game => {
        if (season && Number(game.Season) !== season) return false;
        if (stage && stageGroup(game["Playoff Tier"]) !== stage) return false;
        return true;
      });

      const rows = shown.map(game => {
        const aScore = scoreFor(game, a);
        const bScore = scoreFor(game, b);
        const result = resultFor(game, a);

        return `<tr>
          <td>${esc(game.Season)}</td>
          <td>${esc(game.Week)}</td>
          <td>${stageBadge(game)}</td>
          <td><strong>${fmt(aScore, 2)}</strong></td>
          <td><strong>${fmt(bScore, 2)}</strong></td>
          <td>${resultBadge(result)}</td>
          <td>${fmt(Number(game.Margin || 0), 2)}</td>
          <td>${esc(game["Matchup ID"])}</td>
          <td>
            <button class="badge rivalry-detail-btn"
              data-game-key="${esc(gameKey(game))}">View</button>
          </td>
        </tr>`;
      });

      $("#rivalryGameTable").innerHTML = shown.length
        ? table(
            [
              "Season",
              "Week",
              "Stage",
              aName,
              bName,
              `${aName} Result`,
              "Margin",
              "Matchup ID",
              "Details"
            ],
            rows
          )
        : '<div class="empty">No games match those filters.</div>';

      $("#rivalryGameDetail").innerHTML = "";
      bindDetails(shown);
    };

    $("#rivalryGameSeason").addEventListener("change", drawTable);
    $("#rivalryGameStage").addEventListener("change", drawTable);
    drawTable();
  }

  function renderOneTeamExplorer(focus, games) {
    const body = $("#rivalryExplorerBody");
    if (!body) return;

    const teamGames = games.filter(g => containsTeam(g, focus));

    if (!teamGames.length) {
      body.innerHTML =
        '<div class="empty">No decided saved games for this franchise.</div>';
      return;
    }

    const name = latestTeamById(focus);
    const years = [
      ...new Set(teamGames.map(g => Number(g.Season)))
    ].sort((x, y) => y - x);

    let wins = 0;
    let losses = 0;
    let ties = 0;

    for (const game of teamGames) {
      const result = resultFor(game, focus);
      if (result === "W") wins++;
      else if (result === "L") losses++;
      else ties++;
    }

    const postseasonGames = teamGames.filter(
      g => stageGroup(g["Playoff Tier"]) !== "regular"
    ).length;

    const closest = [...teamGames].sort(
      (x, y) => Number(x.Margin || 0) - Number(y.Margin || 0)
    )[0];

    body.innerHTML = `
      <div class="rivalry-summary">
        ${metric("Overall games", teamGames.length, name)}
        ${metric("Overall W-L-T", `${wins}-${losses}-${ties}`)}
        ${metric("Postseason games", postseasonGames)}
        ${metric(
          "Closest game",
          fmt(Number(closest?.Margin || 0), 2),
          closest ? `${closest.Season} W${closest.Week}` : ""
        )}
      </div>

      <div class="controls section-gap">
        <label>
          Season
          <select id="rivalryGameSeason">
            <option value="">All seasons</option>
            ${years.map(y => `<option value="${y}">${y}</option>`).join("")}
          </select>
        </label>
        <label>
          Stage
          <select id="rivalryGameStage">
            <option value="">All stages</option>
            <option value="regular">Regular Season</option>
            <option value="championship">Championship Bracket</option>
            <option value="consolation">Other Postseason</option>
          </select>
        </label>
      </div>

      <div id="rivalryGameTable"></div>
      <div id="rivalryGameDetail"></div>
    `;

    const drawTable = () => {
      const season = Number($("#rivalryGameSeason")?.value) || null;
      const stage = $("#rivalryGameStage")?.value || "";

      const shown = teamGames.filter(game => {
        if (season && Number(game.Season) !== season) return false;
        if (stage && stageGroup(game["Playoff Tier"]) !== stage) return false;
        return true;
      });

      const rows = shown.map(game => {
        const opponent = opponentFor(game, focus);
        const teamScore = scoreFor(game, focus);
        const result = resultFor(game, focus);

        return `<tr>
          <td>${esc(game.Season)}</td>
          <td>${esc(game.Week)}</td>
          <td>${stageBadge(game)}</td>
          <td>
            <strong>${esc(opponent.team || latestTeamById(opponent.id))}</strong>
            <br><span class="muted">${esc(opponent.owner)}</span>
          </td>
          <td><strong>${fmt(teamScore, 2)}</strong></td>
          <td>${fmt(opponent.score, 2)}</td>
          <td>${resultBadge(result)}</td>
          <td>${fmt(Number(game.Margin || 0), 2)}</td>
          <td>
            <button class="badge rivalry-detail-btn"
              data-game-key="${esc(gameKey(game))}">View</button>
          </td>
        </tr>`;
      });

      $("#rivalryGameTable").innerHTML = shown.length
        ? table(
            [
              "Season",
              "Week",
              "Stage",
              "Opponent",
              name,
              "Opponent Score",
              "Result",
              "Margin",
              "Details"
            ],
            rows
          )
        : '<div class="empty">No games match those filters.</div>';

      $("#rivalryGameDetail").innerHTML = "";
      bindDetails(shown);
    };

    $("#rivalryGameSeason").addEventListener("change", drawTable);
    $("#rivalryGameStage").addEventListener("change", drawTable);
    drawTable();
  }

  function renderExplorer() {
    const body = $("#rivalryExplorerBody");
    if (!body) return;

    const a = Number($("#rivalA")?.value) || null;
    const b = Number($("#rivalB")?.value) || null;
    const games = allSavedGames();

    if (a && b && a === b) {
      body.innerHTML =
        '<div class="empty">Choose two different franchises above.</div>';
      return;
    }

    if (a && b) {
      renderTwoTeamExplorer(a, b, games);
      return;
    }

    const focus = a || b;
    if (focus) {
      renderOneTeamExplorer(focus, games);
      return;
    }

    body.innerHTML = `
      <div class="empty">
        Choose one team above for its full historical game log,
        or choose two teams for a head-to-head rivalry drilldown.
      </div>
    `;
  }

  pages.rivalries = function () {
    baseRivalriesPage();
    addExplorerShell();

    $("#rivalA")?.addEventListener("change", renderExplorer);
    $("#rivalB")?.addEventListener("change", renderExplorer);

    renderExplorer();

    setStatus(
      "Rivalries + historical game explorer loaded",
      "good"
    );
  };
})();
