// LFL Player Records Data Fix v11.2
// Corrects player-season records without changing historical team/franchise data.
// Builds a deduplicated player-season union from the draft archive + saved roster snapshots.
// IMPORTANT: saved season points are player season totals; they are not attributed to one LFL
// franchise when draft and roster-snapshot evidence shows different teams.

window.LFL_PLAYER_RECORDS_FIX_VERSION = "v11.2";

(function () {
  if (!window.pages || typeof pages.records !== "function") return;

  const baseRecordsPage = pages.records;
  const POSITION_BY_ID = {
    1: "QB",
    2: "RB",
    3: "WR",
    4: "TE",
    5: "K",
    16: "D/ST"
  };

  function num(value) {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function html(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function points(value) {
    const n = num(value);
    return n == null ? "-" : n.toLocaleString(undefined, {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 1,
      maximumFractionDigits: 2
    });
  }

  function keyFor(row) {
    const season = num(row?.Season);
    const playerId = num(row?.["Player ID"] ?? row?.PlayerId);
    const playerName = text(row?.["Player Name"] ?? row?.Player);
    if (season == null) return null;
    if (playerId != null) return `${season}|id:${playerId}`;
    if (playerName) return `${season}|name:${playerName.toLowerCase()}`;
    return null;
  }

  function draftRows() {
    const analytics = DATA?.draftAnalytics?.picks;
    if (Array.isArray(analytics) && analytics.length) return analytics;
    return Array.isArray(DATA?.draft) ? DATA.draft : [];
  }

  function rosterRows() {
    return Array.isArray(DATA?.rosters) ? DATA.rosters : [];
  }

  function draftPoints(row) {
    return num(
      row?.ActualPoints ??
      row?.["Actual Season Points (partial)"] ??
      row?.["Season Points"]
    );
  }

  function rosterPoints(row) {
    return num(row?.["Season Points"]);
  }

  function rosterPosition(row) {
    const direct = text(row?.Position);
    if (direct) return direct;

    const byId = POSITION_BY_ID[num(row?.["Position ID"])];
    if (byId) return byId;

    const slot = text(row?.["Lineup Slot"]);
    if (["QB", "RB", "WR", "TE", "K", "D/ST"].includes(slot)) return slot;
    return "";
  }

  function buildPlayerSeasons() {
    const drafts = new Map();
    const rosters = new Map();

    for (const row of draftRows()) {
      const key = keyFor(row);
      if (key) drafts.set(key, row);
    }

    for (const row of rosterRows()) {
      const key = keyFor(row);
      if (key) rosters.set(key, row);
    }

    const allKeys = new Set([...drafts.keys(), ...rosters.keys()]);
    const rows = [];

    for (const key of allKeys) {
      const draft = drafts.get(key) || null;
      const roster = rosters.get(key) || null;

      const dPts = draftPoints(draft);
      const rPts = rosterPoints(roster);
      const savedPoints = dPts != null ? dPts : rPts;
      if (savedPoints == null) continue;

      const season = num(draft?.Season ?? roster?.Season);
      const playerId = num(
        draft?.["Player ID"] ??
        roster?.["Player ID"] ??
        draft?.PlayerId ??
        roster?.PlayerId
      );
      const player = text(
        draft?.["Player Name"] ??
        roster?.["Player Name"] ??
        draft?.Player ??
        roster?.Player
      );

      if (season == null || !player) continue;

      const draftTeamId = num(draft?.["Team ID"]);
      const rosterTeamId = num(roster?.["Team ID"]);
      const draftTeam = text(draft?.["Team Name"]);
      const rosterTeam = text(roster?.["Team Name"]);
      const position = text(draft?.Position) || rosterPosition(roster) || "-";

      let status = "roster-only";
      let statusLabel = "Roster snapshot only";
      let displayTeam = rosterTeam ? `Roster snapshot: ${rosterTeam}` : "Roster snapshot only";
      let detail = rosterTeam
        ? `Not found in draft archive - Saved roster snapshot: ${rosterTeam}`
        : "Not found in draft archive";

      if (draft && roster) {
        if (
          draftTeamId != null &&
          rosterTeamId != null &&
          draftTeamId !== rosterTeamId
        ) {
          status = "changed";
          statusLabel = "Different draft / snapshot teams";
          displayTeam = "Multiple LFL Teams";
          detail = `Drafted: ${draftTeam || `Team ${draftTeamId}`} - Saved roster snapshot: ${rosterTeam || `Team ${rosterTeamId}`}`;
        } else {
          status = "same-snapshot";
          statusLabel = "Draft + snapshot same";
          displayTeam = rosterTeam || draftTeam || "Same saved team";
          detail = `Draft team and saved roster snapshot both show ${displayTeam}. This does not prove every season point was earned for that LFL team.`;
        }
      } else if (draft) {
        status = "draft-only";
        statusLabel = "Draft only";
        displayTeam = draftTeam ? `Drafted by ${draftTeam}` : "Draft archive only";
        detail = draftTeam
          ? `Drafted: ${draftTeam} - Player is not present in the saved roster snapshot for that season`
          : "Player is in the draft archive but not the saved roster snapshot";
      }

      const sources = [];
      if (dPts != null) sources.push("draft");
      if (rPts != null) sources.push("roster");
      const sourceLabel =
        sources.length === 2
          ? (Math.abs(dPts - rPts) < 0.001 ? "Draft + roster agree" : "Draft preferred; roster differs")
          : sources[0] === "draft"
          ? "Draft archive"
          : "Roster snapshot";

      rows.push({
        key,
        season,
        playerId,
        player,
        position,
        savedPoints,
        draftTeamId,
        draftTeam,
        rosterTeamId,
        rosterTeam,
        status,
        statusLabel,
        displayTeam,
        detail,
        sourceLabel
      });
    }

    rows.sort(
      (a, b) =>
        b.savedPoints - a.savedPoints ||
        b.season - a.season ||
        a.player.localeCompare(b.player)
    );

    return rows;
  }

  function cardByHeading(root, heading) {
    return [...root.querySelectorAll(".card")].find(card => {
      const h3 = card.querySelector("h3");
      return h3 && h3.textContent.trim() === heading;
    }) || null;
  }

  function statusBadge(row) {
    const tone =
      row.status === "changed"
        ? "warn"
        : row.status === "draft-only"
        ? "warn"
        : row.status === "roster-only"
        ? "warn"
        : "good";
    return `<span class="badge ${tone}">${html(row.statusLabel)}</span>`;
  }

  function leaderboardRow(row, rank) {
    return `
      <tr>
        <td>${rank}</td>
        <td>
          <strong>${html(row.player)} (${html(row.displayTeam)})</strong>
          <br><span class="muted">${html(row.detail)}</span>
        </td>
        <td>${row.season}</td>
        <td>${html(row.position)}</td>
        <td><strong>${points(row.savedPoints)}</strong></td>
        <td>${statusBadge(row)}<br><span class="muted">${html(row.sourceLabel)}</span></td>
      </tr>
    `;
  }

  function summaryHtml(rows) {
    const top = rows[0] || null;
    const changed = rows.filter(x => x.status === "changed").length;
    const draftOnly = rows.filter(x => x.status === "draft-only").length;
    const rosterOnly = rows.filter(x => x.status === "roster-only").length;

    return `
      <h3>Player Record Leaders</h3>
      ${
        top
          ? `<div class="identity-note">
              <span class="badge good">Corrected single-season record</span>
              <div>
                <strong>${html(top.player)} (${html(top.displayTeam)})</strong>
                <span class="muted">${top.season} - ${points(top.savedPoints)} saved ESPN season points</span>
              </div>
            </div>`
          : ""
      }

      <div class="identity-note">
        <span class="badge warn">Attribution rule</span>
        <div>
          <strong>Season points are player totals, not automatically one franchise's earned points.</strong>
          <span class="muted">
            If draft and saved roster-snapshot teams differ, the player is labeled
            "Multiple LFL Teams" instead of assigning the entire season total to one manager.
          </span>
        </div>
      </div>

      <div class="identity-note">
        <span class="badge warn">Single-game record</span>
        <div>
          <strong>Pending historical box-score reconstruction</strong>
          <span class="muted">
            Weekly ownership, starters/bench, projections and actual player points will be
            published only after they can be validated against saved fantasy team scores.
          </span>
        </div>
      </div>

      <div class="metrics section-gap">
        <div class="metric"><span>Unique player-seasons</span><strong>${rows.length.toLocaleString()}</strong></div>
        <div class="metric"><span>Draft-only restored</span><strong>${draftOnly.toLocaleString()}</strong></div>
        <div class="metric"><span>Different draft/snapshot teams</span><strong>${changed.toLocaleString()}</strong></div>
        <div class="metric"><span>Roster-snapshot only</span><strong>${rosterOnly.toLocaleString()}</strong></div>
      </div>
    `;
  }

  function explorerHtml(rows) {
    const seasons = [...new Set(rows.map(x => x.season))].sort((a, b) => b - a);
    const positions = [...new Set(rows.map(x => x.position).filter(x => x && x !== "-"))].sort();

    return `
      <h3>Corrected Player Single-Season Fantasy Totals</h3>
      <p class="muted">
        Deduplicated union of the draft archive and saved ESPN roster snapshots.
        This restores drafted players who disappeared from the saved roster snapshot and
        avoids assigning a full player season to one LFL team when the evidence shows multiple teams.
      </p>

      <div class="controls" id="playerRecordControlsV112">
        <label>Search
          <input id="playerRecordSearchV112" type="search" placeholder="Player name">
        </label>

        <label>Season
          <select id="playerRecordSeasonV112">
            <option value="">All</option>
            ${seasons.map(y => `<option value="${y}">${y}</option>`).join("")}
          </select>
        </label>

        <label>Position
          <select id="playerRecordPositionV112">
            <option value="">All</option>
            ${positions.map(p => `<option value="${html(p)}">${html(p)}</option>`).join("")}
          </select>
        </label>

        <label>Data status
          <select id="playerRecordStatusV112">
            <option value="">All</option>
            <option value="same-snapshot">Draft + snapshot same</option>
            <option value="changed">Different draft / snapshot teams</option>
            <option value="draft-only">Draft only</option>
            <option value="roster-only">Roster snapshot only</option>
          </select>
        </label>

        <label>Show
          <select id="playerRecordLimitV112">
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      <div id="playerRecordTableV112"></div>

      <div class="identity-note section-gap">
        <span class="badge good">What this fixes</span>
        <div>
          <strong>Drafted players missing from roster snapshots are back in the player record pool.</strong>
          <span class="muted">
            The draft archive is used for drafted-player season points; roster snapshots add
            undrafted/waiver players when available. Matching season/player records are stored once.
          </span>
        </div>
      </div>
    `;
  }

  function renderTable(rows) {
    const panel = document.querySelector("#playerRecordTableV112");
    if (!panel) return;

    const search = text(document.querySelector("#playerRecordSearchV112")?.value).toLowerCase();
    const season = num(document.querySelector("#playerRecordSeasonV112")?.value);
    const position = text(document.querySelector("#playerRecordPositionV112")?.value);
    const status = text(document.querySelector("#playerRecordStatusV112")?.value);
    const limitRaw = text(document.querySelector("#playerRecordLimitV112")?.value);

    let filtered = rows.filter(row => {
      if (search && !row.player.toLowerCase().includes(search)) return false;
      if (season != null && row.season !== season) return false;
      if (position && row.position !== position) return false;
      if (status && row.status !== status) return false;
      return true;
    });

    const total = filtered.length;
    const limit = limitRaw === "all" ? total : (num(limitRaw) || 25);
    filtered = filtered.slice(0, limit);

    panel.innerHTML = `
      <p class="muted">
        Showing ${filtered.length.toLocaleString()} of ${total.toLocaleString()} matching player-seasons.
        Sorted by saved season points.
      </p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player (LFL attribution)</th>
              <th>Season</th>
              <th>Pos</th>
              <th>Saved Season Pts</th>
              <th>Data Status</th>
            </tr>
          </thead>
          <tbody>
            ${
              filtered.length
                ? filtered.map((row, i) => leaderboardRow(row, i + 1)).join("")
                : `<tr><td colspan="6">No matching player-seasons.</td></tr>`
            }
          </tbody>
        </table>
      </div>
    `;
  }

  function attachControls(rows) {
    [
      "#playerRecordSearchV112",
      "#playerRecordSeasonV112",
      "#playerRecordPositionV112",
      "#playerRecordStatusV112",
      "#playerRecordLimitV112"
    ].forEach(selector => {
      const el = document.querySelector(selector);
      if (!el) return;
      el.addEventListener(el.tagName === "INPUT" ? "input" : "change", () => renderTable(rows));
    });
  }

  function applyFix() {
    const rows = buildPlayerSeasons();
    if (!rows.length) return;

    const root = document.querySelector("#streaksRecordsV108");
    if (!root) return;

    const leaders = cardByHeading(root, "Player Record Leaders");
    if (leaders) {
      leaders.id = "playerRecordLeadersV112";
      leaders.innerHTML = summaryHtml(rows);
    }

    const oldTotals = cardByHeading(root, "Highest Player Single-Season Fantasy Totals");
    if (oldTotals) {
      oldTotals.id = "playerSeasonRecordsV112";
      oldTotals.innerHTML = explorerHtml(rows);
      renderTable(rows);
      attachControls(rows);
    }

    if (typeof window.setStatus === "function") {
      setStatus("Player season records corrected from draft + roster sources", "good");
    }
  }

  pages.records = function () {
    baseRecordsPage();
    applyFix();
  };
})();
