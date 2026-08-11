// LFL Draft Lab Data Fix v11.3
// Presentation-layer correction for historical player draft data.
// - Restores missing player positions from the archive's player-position mapping.
// - Normalizes fantasy display edge cases (FB -> RB; Travis Hunter -> WR).
// - Uses an explicit Kevin White WR fallback for the two unmapped historical rows.
// - Clarifies that ActualPoints are PLAYER FULL-SEASON totals, not points necessarily
//   earned for the franchise that drafted the player.
// - Does not modify DATA, history JSON, team/franchise history, records, or matchup data.

window.LFL_DRAFT_LAB_FIX_VERSION = "v11.3";

(function () {
  if (!window.pages || typeof pages.draft !== "function") return;

  const baseDraftPage = pages.draft;
  const KEVIN_WHITE_ESPN_ID = 3042435;
  const TRAVIS_HUNTER_ESPN_ID = 4685415;

  function n(value) {
    if (value == null || value === "") return null;
    const x = Number(value);
    return Number.isFinite(x) ? x : null;
  }

  function txt(value) {
    return String(value == null ? "" : value).trim();
  }

  function esc2(value) {
    return txt(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normFantasyPosition(position, playerId) {
    const pos = txt(position).toUpperCase();

    if (playerId === TRAVIS_HUNTER_ESPN_ID) return "WR";
    if (pos === "FB") return "RB";

    if (["QB", "RB", "WR", "TE", "K", "D/ST"].includes(pos)) return pos;
    return pos;
  }

  function exactKey(season, playerId) {
    const s = n(season);
    const p = n(playerId);
    if (s == null || p == null) return null;
    return `${s}|${p}`;
  }

  function buildArchivePositionMap() {
    const out = new Map();

    for (const row of DATA?.injuryAnalytics?.players || []) {
      const key = exactKey(row.Season, row.PlayerId ?? row["Player ID"]);
      const playerId = n(row.PlayerId ?? row["Player ID"]);
      const pos = normFantasyPosition(row.Position, playerId);
      if (key && pos) out.set(key, pos);
    }

    return out;
  }

  function correctedPosition(pick, archivePositions) {
    const current = normFantasyPosition(pick?.Position, n(pick?.["Player ID"]));
    if (current) return { position: current, source: "draft" };

    const playerId = n(pick?.["Player ID"]);
    const key = exactKey(pick?.Season, playerId);
    const archived = key ? archivePositions.get(key) : "";

    if (archived) return { position: archived, source: "archive" };

    if (playerId === KEVIN_WHITE_ESPN_ID) {
      return { position: "WR", source: "verified-fallback" };
    }

    return { position: "", source: "missing" };
  }

  function correctPick(pick, archivePositions) {
    const result = correctedPosition(pick, archivePositions);
    return {
      ...pick,
      Position: result.position,
      __lflPositionSource: result.source
    };
  }

  function pickKey(pick) {
    return [
      n(pick?.Season) ?? "",
      n(pick?.["Player ID"]) ?? "",
      n(pick?.["Overall Pick"]) ?? ""
    ].join("|");
  }

  function buildCorrectedPicks(originalPicks, archivePositions) {
    return originalPicks.map(p => correctPick(p, archivePositions));
  }

  function correctDerivedPickList(rows, correctedByKey, archivePositions) {
    return (rows || []).map(row => {
      const fromMain = correctedByKey.get(pickKey(row));
      return fromMain ? { ...row, Position: fromMain.Position } : correctPick(row, archivePositions);
    });
  }

  function attributionSummary(picks) {
    const rosterBySeasonPlayer = new Map();

    for (const row of DATA?.rosters || []) {
      const key = exactKey(row.Season, row["Player ID"]);
      if (key) rosterBySeasonPlayer.set(key, row);
    }

    let sameSnapshot = 0;
    let changedSnapshot = 0;
    let draftOnly = 0;

    for (const pick of picks) {
      const key = exactKey(pick.Season, pick["Player ID"]);
      const roster = key ? rosterBySeasonPlayer.get(key) : null;

      if (!roster) {
        draftOnly++;
        continue;
      }

      const draftedTeam = n(pick["Team ID"]);
      const snapshotTeam = n(roster["Team ID"]);

      if (
        draftedTeam != null &&
        snapshotTeam != null &&
        draftedTeam !== snapshotTeam
      ) {
        changedSnapshot++;
      } else {
        sameSnapshot++;
      }
    }

    return { sameSnapshot, changedSnapshot, draftOnly };
  }

  function positionAudit(originalPicks, correctedPicks, archivePositions) {
    let originalMissing = 0;
    let remainingMissing = 0;
    let archiveRestored = 0;
    let verifiedFallback = 0;
    let compared = 0;
    let conflicts = 0;

    for (let i = 0; i < originalPicks.length; i++) {
      const original = originalPicks[i];
      const corrected = correctedPicks[i];
      const originalPos = normFantasyPosition(
        original.Position,
        n(original["Player ID"])
      );
      const correctedPos = txt(corrected.Position);

      if (!originalPos) {
        originalMissing++;
        if (!correctedPos) remainingMissing++;
        if (corrected.__lflPositionSource === "archive") archiveRestored++;
        if (corrected.__lflPositionSource === "verified-fallback") verifiedFallback++;
      }

      const key = exactKey(original.Season, original["Player ID"]);
      const archived = key ? archivePositions.get(key) : "";
      if (originalPos && archived) {
        compared++;
        if (originalPos !== archived) conflicts++;
      }
    }

    const byPosition = new Map();
    for (const pick of correctedPicks) {
      const pos = txt(pick.Position) || "Unknown";
      byPosition.set(pos, (byPosition.get(pos) || 0) + 1);
    }

    return {
      originalMissing,
      remainingMissing,
      restored: originalMissing - remainingMissing,
      archiveRestored,
      verifiedFallback,
      compared,
      conflicts,
      byPosition
    };
  }

  function metricBox(label, value, detail) {
    return `
      <div class="metric">
        <small>${esc2(label)}</small>
        <strong>${esc2(value)}</strong>
        ${detail ? `<span class="muted">${esc2(detail)}</span>` : ""}
      </div>
    `;
  }

  function auditCard(picks, positionInfo, attr) {
    const coverage = picks.length
      ? ((picks.length - positionInfo.remainingMissing) / picks.length) * 100
      : 0;

    const positionBreakdown = [...positionInfo.byPosition.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([pos, count]) => `${pos} ${count}`)
      .join(" | ");

    return `
      <div class="card section-gap" id="draftDataFixV113">
        <div class="card-heading-row">
          <div>
            <span class="section-eyebrow">PLAYER DATA AUDIT v11.3</span>
            <h2>Corrected Draft Lab Player Layer</h2>
          </div>
          <span class="badge good">${coverage.toFixed(1)}% position coverage</span>
        </div>

        <div class="metrics section-gap">
          ${metricBox("Draft picks", picks.length.toLocaleString(), "2013-2025")}
          ${metricBox(
            "Positions restored",
            positionInfo.restored.toLocaleString(),
            `${positionInfo.archiveRestored} archive mapped + ${positionInfo.verifiedFallback} verified fallback`
          )}
          ${metricBox(
            "Position cross-check",
            `${positionInfo.conflicts} conflicts`,
            `${positionInfo.compared.toLocaleString()} existing positions compared`
          )}
          ${metricBox(
            "Different draft / snapshot teams",
            attr.changedSnapshot.toLocaleString(),
            "Do not assign full season points to the drafter"
          )}
        </div>

        <div class="identity-note section-gap">
          <span class="badge warn">Points definition</span>
          <div>
            <strong>Player Season Pts = the player's full saved ESPN season total.</strong>
            <span class="muted">
              It is not the number of fantasy points the drafting manager actually received
              from that player. Weekly ownership and lineup history are required to calculate
              manager-earned points correctly.
            </span>
          </div>
        </div>

        <div class="identity-note">
          <span class="badge warn">Draft attribution</span>
          <div>
            <strong>The franchise shown in Draft Lab means "Drafted By."</strong>
            <span class="muted">
              ${attr.sameSnapshot.toLocaleString()} drafted player-seasons also appear on the
              same team's saved roster snapshot; ${attr.changedSnapshot.toLocaleString()} appear
              on a different team's snapshot; ${attr.draftOnly.toLocaleString()} are not present
              in the saved roster snapshot. A snapshot does not prove week-by-week ownership.
            </span>
          </div>
        </div>

        <div class="identity-note">
          <span class="badge good">Expected points definition</span>
          <div>
            <strong>Slot Expectation is a historical draft-slot benchmark, not ESPN preseason projection.</strong>
            <span class="muted">
              Slot Value compares a player's full-season points with the historical expectation
              for that overall LFL draft slot. Position/round value remains limited to picks that
              already have a valid same-position/same-round benchmark; no missing benchmark is invented.
            </span>
          </div>
        </div>

        <p class="muted section-gap">
          Corrected position distribution: ${esc2(positionBreakdown)}.
        </p>
      </div>
    `;
  }

  function replaceExactHeader(table, from, to) {
    if (!table) return;
    for (const th of table.querySelectorAll("th")) {
      if (th.textContent.trim() === from) th.textContent = to;
    }
  }

  function relabelDraftPanel() {
    const panel = document.querySelector("#draftPanel");
    if (!panel) return;

    // "Actual" is always the saved full-season player total in Draft Lab.
    for (const tableEl of panel.querySelectorAll("table")) {
      replaceExactHeader(tableEl, "Actual", "Player Season Pts");

      const headers = [...tableEl.querySelectorAll("th")].map(th => th.textContent.trim());
      if (
        headers.includes("Player Season Pts") &&
        headers.includes("Franchise / Manager")
      ) {
        replaceExactHeader(tableEl, "Franchise / Manager", "Drafted By");
      }
    }

    for (const card of panel.querySelectorAll(".card")) {
      const heading = txt(card.querySelector("h2")?.textContent);
      const tableEl = card.querySelector("table");
      if (!tableEl) continue;

      if (heading === "Value by Position") {
        replaceExactHeader(tableEl, "Expected", "Pos/Round Expected");
      } else if (heading === "Value by Round") {
        replaceExactHeader(tableEl, "Expected", "Round Expected");
      } else {
        replaceExactHeader(tableEl, "Expected", "Slot Expectation");
      }

      if (
        heading === "Biggest Steals" ||
        heading === "Biggest Slot-Value Busts"
      ) {
        replaceExactHeader(tableEl, "Franchise", "Drafted By");
      }
    }

    const allTable = document.querySelector("#draftTable table");
    if (allTable) {
      replaceExactHeader(allTable, "Actual", "Player Season Pts");
      replaceExactHeader(allTable, "Expected", "Slot Expectation");
      replaceExactHeader(allTable, "Franchise / Manager", "Drafted By");
    }

    // Clarify the base hero language without removing any existing methodology.
    const content = document.querySelector("#content");
    const heroParagraph = [...(content?.querySelectorAll(".hero p") || [])]
      .find(p => p.textContent.includes("Slot Value ="));
    if (heroParagraph && !heroParagraph.dataset.lflDraftV113) {
      heroParagraph.dataset.lflDraftV113 = "1";
      heroParagraph.innerHTML = heroParagraph.innerHTML
        .replace(
          "actual season fantasy points",
          "the player's full saved season fantasy points"
        )
        .replace(
          "historical expected points at that overall pick",
          "historical expected points at that overall LFL draft pick"
        );
    }
  }

  function installRelabelObserver() {
    const panel = document.querySelector("#draftPanel");
    if (!panel) return;

    relabelDraftPanel();

    const observer = new MutationObserver(() => {
      relabelDraftPanel();
    });

    observer.observe(panel, { childList: true, subtree: true });

    // Disconnect automatically when the user navigates away and the panel is removed.
    const cleanup = new MutationObserver(() => {
      if (!document.body.contains(panel)) {
        observer.disconnect();
        cleanup.disconnect();
      }
    });
    cleanup.observe(document.body, { childList: true, subtree: true });
  }

  pages.draft = function () {
    const A = DATA?.draftAnalytics || {};
    const originalPicks = Array.isArray(A.picks) ? A.picks : [];

    if (!originalPicks.length) {
      baseDraftPage();
      return;
    }

    const archivePositions = buildArchivePositionMap();
    const correctedPicks = buildCorrectedPicks(originalPicks, archivePositions);
    const correctedByKey = new Map(correctedPicks.map(p => [pickKey(p), p]));

    const originalTopSteals = A.topSteals;
    const originalTopBusts = A.topBusts;

    // Temporary input swap only for the duration of base render.
    // The base page's event closures retain correctedPicks; DATA is restored immediately.
    A.picks = correctedPicks;
    if (Array.isArray(originalTopSteals)) {
      A.topSteals = correctDerivedPickList(
        originalTopSteals,
        correctedByKey,
        archivePositions
      );
    }
    if (Array.isArray(originalTopBusts)) {
      A.topBusts = correctDerivedPickList(
        originalTopBusts,
        correctedByKey,
        archivePositions
      );
    }

    try {
      baseDraftPage();
    } finally {
      A.picks = originalPicks;
      A.topSteals = originalTopSteals;
      A.topBusts = originalTopBusts;
    }

    const positionInfo = positionAudit(
      originalPicks,
      correctedPicks,
      archivePositions
    );
    const attr = attributionSummary(correctedPicks);

    const tabs = document.querySelector("#draftTabs");
    if (tabs && !document.querySelector("#draftDataFixV113")) {
      tabs.insertAdjacentHTML(
        "beforebegin",
        auditCard(correctedPicks, positionInfo, attr)
      );
    }

    installRelabelObserver();

    if (typeof window.setStatus === "function") {
      setStatus("Draft Lab player data corrected", "good");
    }
  };
})();
