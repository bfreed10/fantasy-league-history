// LFL Injury Room Audit Rebuild v11.4
// Safer presentation-layer injury model built from the archived injuryAnalytics rows.
// Does NOT modify the source history JSON.
//
// Corrections:
// 1) "Not Injury Related" / rest / personal-only report rows cannot create injury misses.
// 2) Reserve/IR-supported absences with a real injury/health type can reclassify otherwise
//    unknown missed games as injury/health-supported misses.
// 3) A truncated eligible-game tail is extended to the normal fantasy-season NFL game
//    window only when the archived row ends exactly at a reserve-supported injury and
//    contains no suspension/unknown gap. This fixes obvious season-ending IR truncation
//    without applying a blanket full-season assumption to free agents/traded players.
// 4) Low-confidence rows stay visible in Data Health but are clearly labeled.
// 5) Career/season rankings are rebuilt from the audited player-season rows.
//
// "Supported Injury Misses" is still an availability metric for drafted LFL players.
// It is NOT weekly LFL points lost. Weekly fantasy ownership/lineups are a later reconstruction.

window.LFL_INJURY_ROOM_AUDIT_VERSION = "v11.4";

(function () {
  if (!window.pages || typeof pages.injuries !== "function") return;

  const NON_INJURY_MARKERS = [
    "not injury related",
    "resting player",
    "personal matter",
    "load management",
    "coach's decision",
    "rest"
  ];

  function num(value) {
    if (value == null || value === "") return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function text(value) {
    return String(value == null ? "" : value).trim();
  }

  function safe(value) {
    return text(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function format(value, digits = 0) {
    const n = num(value);
    if (n == null) return "-";
    return n.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function signedValue(value) {
    const n = num(value);
    if (n == null) return "-";
    return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
  }

  function toneForValue(value) {
    const n = num(value);
    if (n == null) return "";
    if (n >= 35) return "good";
    if (n <= -35) return "bad";
    return "";
  }

  function normalFantasyEligible(row) {
    const endWeek = num(row?.FantasyEndWeek);
    return endWeek == null ? null : Math.max(0, endWeek - 1);
  }

  function physicalOrHealthEvidence(row) {
    const types = Array.isArray(row?.InjuryTypes) ? row.InjuryTypes : [];
    if (!types.length) return false;

    return types.some(type => {
      const s = text(type).toLowerCase();
      if (!s) return false;
      return !NON_INJURY_MARKERS.some(marker => s.includes(marker));
    });
  }

  function reserveStatus(row) {
    const statuses = new Set(
      (Array.isArray(row?.RosterStatuses) ? row.RosterStatuses : [])
        .map(x => text(x).toUpperCase())
    );
    return statuses.has("RES") || statuses.has("RSR");
  }

  function suspensionStatus(row) {
    const statuses = new Set(
      (Array.isArray(row?.RosterStatuses) ? row.RosterStatuses : [])
        .map(x => text(x).toUpperCase())
    );
    return statuses.has("SUS");
  }

  function auditRow(row) {
    const baseline = normalFantasyEligible(row) ?? 0;
    const originalEligible = Math.max(0, num(row?.EligibleFantasySeasonGames) ?? 0);
    const gamesPlayed = Math.max(0, num(row?.GamesPlayed) ?? 0);
    const originalInjury = Math.max(0, num(row?.InjuryGamesMissed) ?? 0);
    const originalSuspension = Math.max(0, num(row?.SuspensionGamesMissed) ?? 0);
    const originalOther = Math.max(0, num(row?.OtherOrUnknownGamesMissed) ?? 0);

    const hasPhysical = physicalOrHealthEvidence(row);
    const hasReserve = reserveStatus(row);
    const hasSuspension = suspensionStatus(row);

    let adjustedEligible = Math.max(originalEligible, gamesPlayed);
    let tailExtended = false;

    // Conservative season-ending IR tail repair:
    // only extend when the archived eligible window is shorter than the normal
    // fantasy-season NFL window, has no unknown/suspension gap, is reserve-supported,
    // has a real injury/health type, and every archived eligible game is already
    // accounted for by games played + injury misses.
    if (
      originalEligible > 0 &&
      originalEligible < baseline &&
      originalOther === 0 &&
      originalSuspension === 0 &&
      hasReserve &&
      hasPhysical &&
      originalEligible === gamesPlayed + originalInjury &&
      (gamesPlayed > 0 || originalInjury > 0)
    ) {
      adjustedEligible = Math.max(adjustedEligible, baseline);
      tailExtended = adjustedEligible > originalEligible;
    }

    const totalMissed = Math.max(0, adjustedEligible - gamesPlayed);

    let suspensionMissed = Math.min(originalSuspension, totalMissed);
    let supportedInjuryMissed = Math.min(
      hasPhysical ? originalInjury : 0,
      Math.max(0, totalMissed - suspensionMissed)
    );

    // If the only archived evidence says non-injury and the roster status is SUS,
    // move observed missed games to suspension rather than injury.
    if (hasSuspension && !hasPhysical) {
      suspensionMissed = Math.max(suspensionMissed, totalMissed);
      supportedInjuryMissed = 0;
    }

    let remaining = Math.max(
      0,
      totalMissed - supportedInjuryMissed - suspensionMissed
    );

    let reserveReclassified = 0;
    if (hasReserve && hasPhysical && remaining > 0) {
      reserveReclassified = remaining;
      supportedInjuryMissed += remaining;
      remaining = 0;
    }

    const otherOrUnknown = remaining;
    const reconstructedMissed = Math.max(
      0,
      supportedInjuryMissed - (hasPhysical ? originalInjury : 0)
    );

    let auditQuality = "High";
    const reasons = [];

    if (originalEligible === 0 || text(row?.DataQuality) === "Low") {
      auditQuality = "Low";
      reasons.push("source participation / eligibility coverage is low");
    } else if (
      tailExtended ||
      reserveReclassified > 0 ||
      text(row?.DataQuality) === "Medium"
    ) {
      auditQuality = "Medium";
    }

    if (tailExtended) reasons.push("season-ending reserve tail reconstructed");
    if (reserveReclassified > 0) reasons.push("reserve-supported unknown misses reclassified");

    const nonInjuryCorrection = !hasPhysical && originalInjury > 0;
    if (nonInjuryCorrection) {
      if (auditQuality === "High") auditQuality = "Medium";
      reasons.push("non-injury report label removed from injury total");
    }

    if (!reasons.length) reasons.push("archived injury / participation row used directly");

    return {
      ...row,
      OriginalEligibleFantasySeasonGames: originalEligible,
      AdjustedEligibleFantasySeasonGames: adjustedEligible,
      SupportedInjuryGamesMissed: supportedInjuryMissed,
      ExplicitInjuryGamesMissed: hasPhysical ? originalInjury : 0,
      ReconstructedInjuryGamesMissed: reconstructedMissed,
      AuditedSuspensionGamesMissed: suspensionMissed,
      AuditedOtherOrUnknownGamesMissed: otherOrUnknown,
      AuditedGamesMissed: totalMissed,
      HasPhysicalOrHealthEvidence: hasPhysical,
      TailExtended: tailExtended,
      ReserveReclassified: reserveReclassified,
      NonInjuryCorrection: nonInjuryCorrection,
      AuditQuality: auditQuality,
      AuditReasons: reasons
    };
  }

  function buildRows() {
    return (DATA?.injuryAnalytics?.players || []).map(auditRow);
  }

  function aggregateCareers(rows) {
    const map = new Map();

    for (const row of rows) {
      const playerId = num(row.PlayerId);
      const key =
        playerId != null
          ? `id:${playerId}`
          : `name:${text(row.Player).toLowerCase()}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          PlayerId: playerId,
          Player: text(row.Player) || "Unknown",
          Position: text(row.Position),
          seasons: new Set(),
          affectedSeasons: new Set(),
          firstSeason: null,
          lastSeason: null,
          eligible: 0,
          played: 0,
          injury: 0,
          explicit: 0,
          reconstructed: 0,
          suspension: 0,
          other: 0,
          high: 0,
          medium: 0,
          low: 0
        });
      }

      const x = map.get(key);
      const season = num(row.Season);

      if (season != null) {
        x.seasons.add(season);
        x.firstSeason = x.firstSeason == null ? season : Math.min(x.firstSeason, season);
        x.lastSeason = x.lastSeason == null ? season : Math.max(x.lastSeason, season);
        if ((row.SupportedInjuryGamesMissed || 0) > 0) x.affectedSeasons.add(season);
      }

      x.eligible += num(row.AdjustedEligibleFantasySeasonGames) || 0;
      x.played += num(row.GamesPlayed) || 0;
      x.injury += num(row.SupportedInjuryGamesMissed) || 0;
      x.explicit += num(row.ExplicitInjuryGamesMissed) || 0;
      x.reconstructed += num(row.ReconstructedInjuryGamesMissed) || 0;
      x.suspension += num(row.AuditedSuspensionGamesMissed) || 0;
      x.other += num(row.AuditedOtherOrUnknownGamesMissed) || 0;

      if (row.AuditQuality === "High") x.high++;
      else if (row.AuditQuality === "Low") x.low++;
      else x.medium++;

      if (text(row.Position)) x.Position = text(row.Position);
      if (text(row.Player)) x.Player = text(row.Player);
    }

    return [...map.values()]
      .map(x => ({
        ...x,
        DraftedSeasons: x.seasons.size,
        SeasonsWithInjuryMiss: x.affectedSeasons.size,
        AvgInjuryPerDraftedSeason: x.seasons.size ? x.injury / x.seasons.size : 0
      }))
      .sort(
        (a, b) =>
          b.injury - a.injury ||
          b.SeasonsWithInjuryMiss - a.SeasonsWithInjuryMiss ||
          a.Player.localeCompare(b.Player)
      );
  }

  function qualityBadge(quality) {
    const tone =
      quality === "High" ? "good" : quality === "Low" ? "bad" : "warn";
    return `<span class="badge ${tone}">${safe(quality)}</span>`;
  }

  function metricBox(label, value, detail = "") {
    return `
      <div class="metric">
        <small>${safe(label)}</small>
        <strong>${safe(value)}</strong>
        ${detail ? `<span class="muted">${safe(detail)}</span>` : ""}
      </div>
    `;
  }

  function tableHtml(headers, rows) {
    return `
      <div class="table-wrap">
        <table class="table">
          <thead><tr>${headers.map(h => `<th>${safe(h)}</th>`).join("")}</tr></thead>
          <tbody>${rows.join("")}</tbody>
        </table>
      </div>
    `;
  }

  function playerCell(row) {
    const details = [
      text(row.Position),
      row.OverallPick ? `Pick ${row.OverallPick}` : "",
      text(row.DraftedByTeam)
    ].filter(Boolean);

    return `
      <strong>${safe(row.Player)}</strong>
      ${details.length ? `<br><span class="muted">${safe(details.join(" - "))}</span>` : ""}
    `;
  }

  function sourceNote(row) {
    const reconstructed = num(row.ReconstructedInjuryGamesMissed) || 0;
    if (reconstructed > 0) {
      return `<span class="muted">${reconstructed} reserve-supported reconstructed</span>`;
    }
    return `<span class="muted">archived weekly evidence</span>`;
  }

  function renderCareer(panel, careers) {
    const rows = careers.slice(0, 100).map((x, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>
          <strong>${safe(x.Player)}</strong>
          <br><span class="muted">${safe(x.Position || "")} - drafted ${x.DraftedSeasons} season${x.DraftedSeasons === 1 ? "" : "s"}</span>
        </td>
        <td>
          <strong>${format(x.injury)}</strong>
          ${x.reconstructed ? `<br><span class="muted">${format(x.reconstructed)} reconstructed</span>` : ""}
        </td>
        <td>${x.SeasonsWithInjuryMiss}</td>
        <td>${format(x.played)}/${format(x.eligible)}</td>
        <td>${format(x.explicit)}</td>
        <td>${format(x.suspension)}</td>
        <td>${format(x.other)}</td>
        <td>
          ${x.low ? `<span class="badge warn">Mixed</span>` : x.medium ? `<span class="badge warn">Audited</span>` : `<span class="badge good">High</span>`}
          <br><span class="muted">${x.high} H / ${x.medium} M / ${x.low} L seasons</span>
        </td>
      </tr>
    `);

    panel.innerHTML = `
      <div class="card">
        <h2>Career Supported Injury / Health Games Missed</h2>
        <p class="muted">
          Includes only seasons in which the player was drafted in the LFL.
          The main total combines explicit archived injury misses with conservative
          reserve/IR-supported reconstruction. Suspensions and unresolved absences stay separate.
        </p>
        ${tableHtml(
          [
            "#",
            "Player",
            "Supported Missed",
            "Affected Seasons",
            "Played / Eligible",
            "Explicit",
            "Susp.",
            "Other / Unknown",
            "Confidence"
          ],
          rows
        )}
      </div>
    `;
  }

  function renderSeason(panel, rows) {
    const seasons = [...new Set(rows.map(x => num(x.Season)).filter(x => x != null))]
      .sort((a, b) => b - a);

    panel.innerHTML = `
      <div class="controls">
        <label>Season
          <select id="injuryAuditSeason">
            ${seasons.map(y => `<option value="${y}">${y}</option>`).join("")}
          </select>
        </label>
        <label>Quality
          <select id="injuryAuditQuality">
            <option value="">All</option>
            <option value="High">High only</option>
            <option value="Medium">Medium only</option>
            <option value="Low">Low only</option>
          </select>
        </label>
        <label>Search
          <input id="injuryAuditSearch" type="search" placeholder="Player">
        </label>
      </div>
      <div id="injuryAuditSeasonPanel"></div>
    `;

    const draw = () => {
      const season = num(document.querySelector("#injuryAuditSeason")?.value);
      const quality = text(document.querySelector("#injuryAuditQuality")?.value);
      const query = text(document.querySelector("#injuryAuditSearch")?.value).toLowerCase();

      const filtered = rows
        .filter(x => season == null || num(x.Season) === season)
        .filter(x => !quality || x.AuditQuality === quality)
        .filter(x => !query || text(x.Player).toLowerCase().includes(query))
        .sort(
          (a, b) =>
            (b.SupportedInjuryGamesMissed || 0) - (a.SupportedInjuryGamesMissed || 0) ||
            (b.AuditedGamesMissed || 0) - (a.AuditedGamesMissed || 0) ||
            (a.OverallPick || 999) - (b.OverallPick || 999)
        );

      const body = filtered.map(x => `
        <tr>
          <td>${playerCell(x)}</td>
          <td>${format(x.GamesPlayed)}/${format(x.AdjustedEligibleFantasySeasonGames)}</td>
          <td>
            <strong>${format(x.SupportedInjuryGamesMissed)}</strong>
            ${sourceNote(x)}
          </td>
          <td>${format(x.AuditedSuspensionGamesMissed)}</td>
          <td>${format(x.AuditedOtherOrUnknownGamesMissed)}</td>
          <td>${safe((x.InjuryTypes || []).join(", ") || "-")}</td>
          <td>
            ${qualityBadge(x.AuditQuality)}
            <br><span class="muted">${safe((x.AuditReasons || []).join("; "))}</span>
          </td>
        </tr>
      `);

      const target = document.querySelector("#injuryAuditSeasonPanel");
      if (target) {
        target.innerHTML = `
          <div class="card">
            <h2>${season} Audited Player Availability</h2>
            <p class="muted">${filtered.length} mapped drafted player-seasons shown.</p>
            ${tableHtml(
              [
                "Player",
                "Played / Eligible",
                "Supported Injury / Health Missed",
                "Susp.",
                "Other / Unknown",
                "Reported Injury Types",
                "Audit Quality"
              ],
              body
            )}
          </div>
        `;
      }
    };

    document.querySelector("#injuryAuditSeason")?.addEventListener("change", draw);
    document.querySelector("#injuryAuditQuality")?.addEventListener("change", draw);
    document.querySelector("#injuryAuditSearch")?.addEventListener("input", draw);
    draw();
  }

  function renderImpact(panel, rows) {
    const injuryBusts = rows
      .filter(x =>
        (x.SupportedInjuryGamesMissed || 0) >= 2 &&
        num(x.DraftValue) != null &&
        num(x.DraftValue) < 0 &&
        x.AuditQuality !== "Low"
      )
      .sort(
        (a, b) =>
          (a.DraftValue || 0) - (b.DraftValue || 0) ||
          (b.SupportedInjuryGamesMissed || 0) - (a.SupportedInjuryGamesMissed || 0)
      )
      .slice(0, 40);

    const healthyValue = rows
      .filter(x =>
        x.AuditQuality === "High" &&
        (x.SupportedInjuryGamesMissed || 0) === 0 &&
        (x.AuditedOtherOrUnknownGamesMissed || 0) === 0 &&
        (x.AuditedSuspensionGamesMissed || 0) === 0 &&
        num(x.GamesPlayed) != null &&
        num(x.AdjustedEligibleFantasySeasonGames) != null &&
        num(x.GamesPlayed) >= num(x.AdjustedEligibleFantasySeasonGames) &&
        num(x.DraftValue) != null &&
        num(x.DraftValue) > 0
      )
      .sort((a, b) => (b.DraftValue || 0) - (a.DraftValue || 0))
      .slice(0, 40);

    const bustRows = injuryBusts.map((x, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${x.Season}</td>
        <td>${playerCell(x)}</td>
        <td><strong>${format(x.SupportedInjuryGamesMissed)}</strong></td>
        <td>${format(x.GamesPlayed)}/${format(x.AdjustedEligibleFantasySeasonGames)}</td>
        <td>${format(x.ActualPoints, 1)}</td>
        <td>${format(x.ExpectedSlotPoints, 1)}</td>
        <td class="${toneForValue(x.DraftValue)}"><strong>${signedValue(x.DraftValue)}</strong></td>
        <td>${qualityBadge(x.AuditQuality)}</td>
      </tr>
    `);

    const healthyRows = healthyValue.map((x, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${x.Season}</td>
        <td>${playerCell(x)}</td>
        <td>${format(x.GamesPlayed)}/${format(x.AdjustedEligibleFantasySeasonGames)}</td>
        <td class="${toneForValue(x.DraftValue)}"><strong>${signedValue(x.DraftValue)}</strong></td>
      </tr>
    `);

    panel.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <h2>Injury-Supported Draft Bust Outcomes</h2>
          <p class="muted">
            Negative draft-slot value with at least two audited injury/health-supported missed games.
            This is an availability + production screen, not proof that injury alone caused the poor draft outcome.
          </p>
          ${tableHtml(
            ["#", "Year", "Player", "Supported Missed", "Played / Eligible", "Season Pts", "Slot Expect.", "Draft Value", "Quality"],
            bustRows
          )}
        </div>

        <div class="card">
          <h2>High-Confidence Healthy Value Picks</h2>
          <p class="muted">
            Positive-value drafted players with complete archived eligibility/participation,
            zero injury/health misses, zero suspension and zero unresolved absences.
          </p>
          ${tableHtml(
            ["#", "Year", "Player", "Played / Eligible", "Draft Value"],
            healthyRows
          )}
        </div>
      </div>
    `;
  }

  function renderHealth(panel, rows, A) {
    const unmapped = Array.isArray(A.unmapped) ? A.unmapped : [];
    const dstUnmapped = unmapped.filter(x => text(x.Player).includes("D/ST"));
    const playerUnmapped = unmapped.filter(x => !text(x.Player).includes("D/ST"));

    const tailFixed = rows.filter(x => x.TailExtended).length;
    const reserveFixed = rows.filter(x => (x.ReserveReclassified || 0) > 0).length;
    const nonInjuryFixed = rows.filter(x => x.NonInjuryCorrection).length;
    const low = rows.filter(x => x.AuditQuality === "Low").length;
    const medium = rows.filter(x => x.AuditQuality === "Medium").length;
    const high = rows.filter(x => x.AuditQuality === "High").length;

    const playerUnmappedRows = playerUnmapped.map(x => `
      <tr>
        <td>${safe(x.Season)}</td>
        <td><strong>${safe(x.Player)}</strong></td>
        <td>${safe(x.Reason || "Unmapped")}</td>
      </tr>
    `);

    panel.innerHTML = `
      <div class="metrics">
        ${metricBox("Mapped player-seasons", rows.length.toLocaleString(), "drafted LFL players")}
        ${metricBox("High-confidence rows", high.toLocaleString(), `${medium} medium / ${low} low`)}
        ${metricBox("Reserve rows reconstructed", reserveFixed.toLocaleString(), `${tailFixed} also needed eligible-tail repair`)}
        ${metricBox("Non-injury corrections", nonInjuryFixed.toLocaleString(), "false injury labels removed")}
      </div>

      <div class="grid-2 section-gap">
        <div class="card">
          <h2>v11.4 Audit Rules</h2>
          <p>
            <strong>Primary metric:</strong> Supported Injury / Health Games Missed.
            Explicit archived injury-report misses are kept when the row contains a real
            injury/health type.
          </p>
          <p>
            <strong>Reserve reconstruction:</strong> unresolved missed games can move into
            the injury/health bucket only when IR/reserve status and a real injury/health
            type both support the absence.
          </p>
          <p>
            <strong>Truncated IR tails:</strong> the eligible window is extended only when
            the archived row ends exactly at a reserve-supported injury and contains no
            suspension or unknown gap.
          </p>
          <p>
            <strong>Non-injury reports:</strong> rest, personal matters, load management,
            coach decisions and "Not Injury Related" alone cannot create injury misses.
          </p>
        </div>

        <div class="card">
          <h2>What v11.4 Still Does Not Claim</h2>
          <p>
            It does not invent weekly LFL ownership, starter/bench status, or fantasy points lost.
            Those require the historical player box-score reconstruction.
          </p>
          <p>
            Medium-confidence rows include conservative IR/reserve inference from the archived
            aggregate evidence. Low-confidence rows remain searchable but should not be treated
            as exact historical availability totals.
          </p>
          <p>
            The full external rebuild will re-ingest week-level NFL schedules, weekly rosters,
            participation and injury reports and validate each player-week individually.
          </p>
        </div>
      </div>

      <div class="card section-gap">
        <h2>Unmapped Draft Entries</h2>
        <p class="muted">
          ${unmapped.length} draft player-seasons are not in the mapped injury table:
          ${dstUnmapped.length} are D/ST entries and ${playerUnmapped.length} are individual-player rows.
        </p>
        ${
          playerUnmappedRows.length
            ? tableHtml(["Season", "Player", "Reason"], playerUnmappedRows)
            : "<p>No individual-player unmapped rows.</p>"
        }
      </div>
    `;
  }

  function renderMethod(panel, A) {
    const m = A.methodology || {};
    panel.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <h2>Archived Source Methodology</h2>
          <p><strong>Fantasy window:</strong> ${safe(m.fantasyWindow || "Saved fantasy-season window.")}</p>
          <p><strong>Bye weeks:</strong> ${safe(m.byeWeeks || "Excluded.")}</p>
          <p><strong>NFL postseason:</strong> ${safe(m.nflPostseason || "Excluded.")}</p>
          <p><strong>Participation:</strong> ${safe(m.participation || "Weekly participation data.")}</p>
        </div>
        <div class="card">
          <h2>Audited Classification</h2>
          <p>
            The original archive remains untouched. v11.4 rebuilds the displayed injury rankings
            at runtime from the player-season source rows and applies additional consistency checks.
          </p>
          <p>
            Injury/health evidence is required. Non-injury-only report labels are never counted
            as injury misses. Reserve-supported reconstruction is shown separately from explicit
            injury-report misses.
          </p>
        </div>
      </div>
    `;
  }

  pages.injuries = function () {
    setHeader(
      "Injury Room",
      "Audited drafted-player availability, injury/health misses and draft impact."
    );

    const A = DATA?.injuryAnalytics || {};
    const rows = buildRows();

    if (!rows.length) {
      document.querySelector("#content").innerHTML = `
        <div class="hero">
          <h2>Injury data needs to be rebuilt.</h2>
          <p>No mapped injury player-season rows are available.</p>
        </div>
      `;
      return;
    }

    const careers = aggregateCareers(rows);
    const leader = careers[0];
    const high = rows.filter(x => x.AuditQuality === "High").length;
    const medium = rows.filter(x => x.AuditQuality === "Medium").length;
    const low = rows.filter(x => x.AuditQuality === "Low").length;
    const corrections = rows.filter(
      x => x.TailExtended || x.ReserveReclassified > 0 || x.NonInjuryCorrection
    ).length;

    document.querySelector("#content").innerHTML = `
      <div class="metrics">
        ${metricBox(
          "Mapped drafted player-seasons",
          rows.length.toLocaleString(),
          "audited at runtime"
        )}
        ${metricBox(
          "Career supported-miss leader",
          leader ? format(leader.injury) : "-",
          leader ? leader.Player : ""
        )}
        ${metricBox(
          "Audit corrections / reconstructions",
          corrections.toLocaleString(),
          "source JSON unchanged"
        )}
        ${metricBox(
          "Audit quality",
          `${high} high`,
          `${medium} medium / ${low} low`
        )}
      </div>

      <div class="hero">
        <h2>Availability without pretending the archive is more complete than it is.</h2>
        <p>
          <strong>Supported Injury / Health Games Missed</strong> combines explicit archived
          injury misses with conservative IR/reserve-supported reconstruction. Suspensions,
          non-injury absences and unresolved gaps remain separate. Reconstructed values are
          visibly labeled instead of being presented as directly observed weekly facts.
        </p>
      </div>

      <div class="tabs" id="injuryAuditTabs">
        <button class="active" data-tab="career">Career Leaders</button>
        <button data-tab="season">By Season</button>
        <button data-tab="impact">Draft Impact</button>
        <button data-tab="health">Data Health</button>
        <button data-tab="method">Methodology</button>
      </div>

      <div id="injuryAuditPanel"></div>
    `;

    const panel = document.querySelector("#injuryAuditPanel");

    const draw = tab => {
      document
        .querySelectorAll("#injuryAuditTabs button")
        .forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tab));

      if (tab === "career") renderCareer(panel, careers);
      if (tab === "season") renderSeason(panel, rows);
      if (tab === "impact") renderImpact(panel, rows);
      if (tab === "health") renderHealth(panel, rows, A);
      if (tab === "method") renderMethod(panel, A);
    };

    document
      .querySelectorAll("#injuryAuditTabs button")
      .forEach(btn => btn.addEventListener("click", () => draw(btn.dataset.tab)));

    draw("career");

    if (typeof window.setStatus === "function") {
      setStatus(
        `Injury Room audit v11.4 - ${rows.length} mapped player-seasons - source JSON unchanged`,
        "good"
      );
    }
  };
})();
