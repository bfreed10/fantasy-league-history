// LFL Manager Participation History v10.6
// Safe presentation-layer patch.
// Does not modify history data, franchise totals, trade analytics, or the wins fix.
// Matthew Gordon participation:
//   2013-2019 = shared participation on Team ID 13
//   2020-2025 = independent Team ID 14
// Shared-era games can appear on both managers' personal resumes,
// but franchise/league totals remain counted only once by Team ID.

window.LFL_MANAGER_HISTORY_VERSION = "v10.6";

(function () {
  const baseManagersPage = pages.managers;

  function seasonInRange(value, start, end) {
    const y = Number(value);
    return Number.isFinite(y) && y >= start && y <= end;
  }

  function recordFor(teamIdValue, startSeason, endSeason) {
    const targetId = Number(teamIdValue);
    const out = {
      wins: 0,
      losses: 0,
      ties: 0,
      regWins: 0,
      regLosses: 0,
      regTies: 0,
      playoffWins: 0,
      playoffLosses: 0,
      playoffTies: 0,
      seasons: new Set()
    };

    for (const row of DATA?.teams || []) {
      if (
        Number(row["Team ID"]) !== targetId ||
        !seasonInRange(row.Season, startSeason, endSeason)
      ) {
        continue;
      }

      out.seasons.add(Number(row.Season));
      out.regWins += Number(row.Wins || 0);
      out.regLosses += Number(row.Losses || 0);
      out.regTies += Number(row.Ties || 0);
    }

    for (const game of DATA?.matchups || []) {
      if (!seasonInRange(game.Season, startSeason, endSeason)) continue;

      const homeId = Number(game["Home Team ID"]);
      const awayId = Number(game["Away Team ID"]);

      if (homeId !== targetId && awayId !== targetId) continue;

      const result = String(game.Winner || "").toUpperCase();
      if (!result || result === "UNDECIDED") continue;

      const isHome = homeId === targetId;
      const playoff =
        String(game["Playoff Tier"] || "") === "WINNERS_BRACKET";

      if (result === "TIE") {
        out.ties++;
        if (playoff) out.playoffTies++;
      } else if (
        (result === "HOME" && isHome) ||
        (result === "AWAY" && !isHome)
      ) {
        out.wins++;
        if (playoff) out.playoffWins++;
      } else if (result === "HOME" || result === "AWAY") {
        out.losses++;
        if (playoff) out.playoffLosses++;
      }
    }

    const games = out.wins + out.losses + out.ties;
    out.winPct = games ? out.wins / games : 0;
    out.seasonCount = out.seasons.size;
    return out;
  }

  function titleCountFor(teamIdValue, startSeason, endSeason) {
    const targetId = Number(teamIdValue);
    let total = 0;

    for (const champion of DATA?.champions || []) {
      const year = Number(champion.season);
      if (
        year >= startSeason &&
        year <= endSeason &&
        championTeamId(champion) === targetId
      ) {
        total++;
      }
    }

    return total;
  }

  function combineRecords(a, b) {
    const out = {};
    for (const key of [
      "wins",
      "losses",
      "ties",
      "regWins",
      "regLosses",
      "regTies",
      "playoffWins",
      "playoffLosses",
      "playoffTies"
    ]) {
      out[key] = Number(a[key] || 0) + Number(b[key] || 0);
    }

    out.seasonCount =
      Number(a.seasonCount || 0) + Number(b.seasonCount || 0);

    const games = out.wins + out.losses + out.ties;
    out.winPct = games ? out.wins / games : 0;
    return out;
  }

  function recordText(r) {
    return `${r.wins}-${r.losses}-${r.ties}`;
  }

  function playoffText(r) {
    return `${r.playoffWins}-${r.playoffLosses}` +
      (r.playoffTies ? `-${r.playoffTies}` : "");
  }

  function buildManagerParticipation() {
    const matthewShared = recordFor(13, 2013, 2019);
    const matthewIndependent = recordFor(14, 2020, 2025);
    const matthew = combineRecords(matthewShared, matthewIndependent);

    const spencer = recordFor(13, 2013, 2025);

    const matthewSharedTitles = titleCountFor(13, 2013, 2019);
    const matthewIndependentTitles = titleCountFor(14, 2020, 2025);
    const matthewTitles =
      matthewSharedTitles + matthewIndependentTitles;
    const spencerTitles = titleCountFor(13, 2013, 2025);

    return {
      matthewShared,
      matthewIndependent,
      matthew,
      spencer,
      matthewSharedTitles,
      matthewIndependentTitles,
      matthewTitles,
      spencerTitles
    };
  }

  function replaceExistingMatthewCard(model) {
    const heading = [...document.querySelectorAll("#content h2")]
      .find(
        (node) =>
          node.textContent.trim() === "Matthew / Spenger History"
      );

    if (!heading) return;

    const card = heading.closest(".card");
    if (!card) return;

    const m = model.matthew;

    card.innerHTML = `
      <h2>Matthew Gordon / Spencer Friedman</h2>
      <div class="identity-note">
        <span class="badge good">13 seasons participating</span>
        <div>
          <strong>Matthew Gordon</strong>
          <span class="muted">
            2013-2019: shared participation on Spencer Friedman's
            Team ID 13 franchise. 2020-2025: independent Team ID 14.
          </span>
        </div>
      </div>
      <div class="feature-list">
        <div class="feature">
          <strong>Participation record</strong>
          <span class="muted">${recordText(m)} overall</span>
        </div>
        <div class="feature">
          <strong>Regular-season record</strong>
          <span class="muted">
            ${m.regWins}-${m.regLosses}-${m.regTies}
          </span>
        </div>
        <div class="feature">
          <strong>Participation title seasons</strong>
          <span class="muted">
            ${model.matthewTitles}
            (${model.matthewSharedTitles} shared +
            ${model.matthewIndependentTitles} independent)
          </span>
        </div>
      </div>
      <p class="muted">
        Shared 2013-2019 results appear on Matthew's personal
        participation resume and Spencer's personal resume. They are
        not added a second time to franchise or league leaderboards.
      </p>
    `;
  }

  function participationDetailHtml(model) {
    const shared = model.matthewShared;
    const independent = model.matthewIndependent;
    const total = model.matthew;
    const spencer = model.spencer;

    const rows = [
      `<tr>
        <td><strong>Matthew Gordon</strong></td>
        <td>2013-2019 shared</td>
        <td>Team ID 13</td>
        <td>${shared.seasonCount}</td>
        <td><strong>${recordText(shared)}</strong></td>
        <td>${shared.regWins}-${shared.regLosses}-${shared.regTies}</td>
        <td>${playoffText(shared)}</td>
        <td>${model.matthewSharedTitles}</td>
      </tr>`,
      `<tr>
        <td><strong>Matthew Gordon</strong></td>
        <td>2020-2025 independent</td>
        <td>Team ID 14</td>
        <td>${independent.seasonCount}</td>
        <td><strong>${recordText(independent)}</strong></td>
        <td>${independent.regWins}-${independent.regLosses}-${independent.regTies}</td>
        <td>${playoffText(independent)}</td>
        <td>${model.matthewIndependentTitles}</td>
      </tr>`,
      `<tr>
        <td><strong>Matthew Gordon</strong></td>
        <td><strong>Participation total</strong></td>
        <td>Shared + independent</td>
        <td><strong>${total.seasonCount}</strong></td>
        <td><strong>${recordText(total)}</strong></td>
        <td><strong>${total.regWins}-${total.regLosses}-${total.regTies}</strong></td>
        <td><strong>${playoffText(total)}</strong></td>
        <td><strong>${model.matthewTitles}</strong></td>
      </tr>`,
      `<tr>
        <td><strong>Spencer Friedman</strong></td>
        <td>2013-2025 franchise manager</td>
        <td>Team ID 13</td>
        <td>${spencer.seasonCount}</td>
        <td><strong>${recordText(spencer)}</strong></td>
        <td>${spencer.regWins}-${spencer.regLosses}-${spencer.regTies}</td>
        <td>${playoffText(spencer)}</td>
        <td>${model.spencerTitles}</td>
      </tr>`
    ];

    return `
      <div class="card section-gap" id="managerParticipationHistory">
        <div class="card-heading-row">
          <div>
            <span class="section-eyebrow">MANAGER HISTORY</span>
            <h2>Participation vs Franchise Record</h2>
          </div>
          <span class="badge good">No double-counting</span>
        </div>
        <p class="muted">
          Franchise leaderboards remain keyed to ESPN Team ID.
          This separate manager layer allows shared participation
          to appear on personal resumes without changing league totals.
        </p>
        ${table(
          [
            "Manager",
            "Era",
            "Franchise",
            "Seasons",
            "Overall W-L-T",
            "Reg W-L-T",
            "Champ. Bracket W-L",
            "Title Credit"
          ],
          rows
        )}
      </div>
    `;
  }

  pages.managers = function () {
    baseManagersPage();

    const content = $("#content");
    if (!content || $("#managerParticipationHistory")) return;

    const model = buildManagerParticipation();
    replaceExistingMatthewCard(model);
    content.insertAdjacentHTML(
      "beforeend",
      participationDetailHtml(model)
    );

    setStatus(
      "Franchise totals + manager participation history loaded",
      "good"
    );
  };
})();
