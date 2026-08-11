// LFL Draft Lab Value Model v14.0
// Replaces the misleading cross-position slot-value comparison with:
// 1) ESPN weekly projection vs actual (2018-2025)
// 2) leave-one-out same-position/same-round draft value
// 3) actual starter points captured by the drafting franchise
// Also preserves the v11.3 player-position corrections.

window.LFL_DRAFT_LAB_FIX_VERSION = "v14.0";

(function () {
  if (!window.pages || typeof pages.draft !== "function") return;

  const baseDraftPage = pages.draft;
  const DATA_URL = "/data/draft_value_v14.json";
  const KEVIN_WHITE_ESPN_ID = 3042435;
  const TRAVIS_HUNTER_ESPN_ID = 4685415;

  let V14 = null;
  let loadPromise = null;
  let applied = false;

  function n(value) {
    if (value == null || value === "") return null;
    const x = Number(value);
    return Number.isFinite(x) ? x : null;
  }

  function txt(value) {
    return String(value == null ? "" : value).trim();
  }

  function esc14(value) {
    return txt(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function fmt14(value, digits = 1) {
    const x = n(value);
    if (x == null) return "—";
    return x.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function signed14(value, digits = 1) {
    const x = n(value);
    if (x == null) return "—";
    return `${x >= 0 ? "+" : ""}${x.toFixed(digits)}`;
  }

  function tone14(value) {
    const x = n(value);
    if (x == null) return "";
    return x >= 35 ? "good" : x <= -35 ? "bad" : "";
  }

  function normFantasyPosition(position, playerId) {
    const pos = txt(position).toUpperCase();

    if (playerId === TRAVIS_HUNTER_ESPN_ID) return "WR";
    if (pos === "FB") return "RB";
    if (["QB", "RB", "WR", "TE", "K", "D/ST"].includes(pos)) return pos;
    return pos;
  }

  function exactKey(season, playerId, overallPick = null) {
    const s = n(season);
    const p = n(playerId);
    if (s == null || p == null) return null;
    if (overallPick == null) return `${s}|${p}`;
    return `${s}|${p}|${n(overallPick) ?? ""}`;
  }

  function buildArchivePositionMap() {
    const out = new Map();

    for (const row of DATA?.injuryAnalytics?.players || []) {
      const season = n(row.Season);
      const playerId = n(row.PlayerId ?? row["Player ID"]);
      const key = exactKey(season, playerId);
      const pos = normFantasyPosition(row.Position, playerId);
      if (key && pos) out.set(key, pos);
    }

    return out;
  }

  function correctedPosition(pick, archivePositions) {
    const playerId = n(pick?.["Player ID"]);
    const current = normFantasyPosition(pick?.Position, playerId);
    if (current) return current;

    const archived = archivePositions.get(exactKey(pick?.Season, playerId)) || "";
    if (archived) return archived;
    if (playerId === KEVIN_WHITE_ESPN_ID) return "WR";
    return "";
  }

  function valueLabel(value) {
    const v = n(value);
    if (v == null) return "No benchmark";
    if (v >= 100) return "Elite steal";
    if (v >= 35) return "Steal";
    if (v <= -100) return "Major bust";
    if (v <= -35) return "Bust";
    return "Near expectation";
  }

  function loadV14() {
    if (V14) return Promise.resolve(V14);
    if (loadPromise) return loadPromise;

    loadPromise = fetch(DATA_URL, { cache: "force-cache" })
      .then(response => {
        if (!response.ok) throw new Error(`Draft Value data HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        V14 = data;
        return data;
      });

    return loadPromise;
  }

  function applyV14Model() {
    if (applied) return;

    const A = DATA?.draftAnalytics;
    if (!A || !Array.isArray(A.picks)) return;

    const metricByKey = new Map(
      (V14?.picks || []).map(row => [row.k, row])
    );
    const archivePositions = buildArchivePositionMap();

    const corrected = A.picks.map(original => {
      const key = exactKey(
        original.Season,
        original["Player ID"],
        original["Overall Pick"]
      );
      const metric = metricByKey.get(key);
      const position = metric?.p || correctedPosition(original, archivePositions);

      const expected = metric?.pe ?? null;
      const value = metric?.pv ?? null;
      const pct = metric?.pp ?? null;

      return {
        ...original,
        Position: position,

        // Preserve legacy values for audit only.
        LegacyExpectedSlotPoints: original.ExpectedSlotPoints,
        LegacyValueAboveSlot: original.ValueAboveSlot,

        // Base Draft Lab reads these names. v14 intentionally replaces them
        // with same-position/same-round values so every downstream view uses
        // a fair position-adjusted comparison.
        ExpectedSlotPoints: expected,
        ValueAboveSlot: value,
        ExpectedPositionRoundPoints: expected,
        ValueAbovePositionRound: value,
        ValuePct: pct,
        ValueLabel: valueLabel(value),

        // New weekly / manager-realized fields.
        V14ProjectionWeeks: metric?.pw ?? 0,
        V14ESPNProjected: metric?.ep ?? null,
        V14ProjectionActual: metric?.ea ?? null,
        V14ProjectionDelta: metric?.ed ?? null,
        V14ProjectionDeltaPct: metric?.epp ?? null,
        V14DraftTeamRosterWeeks: metric?.drw ?? 0,
        V14DraftTeamStarterWeeks: metric?.dsw ?? 0,
        V14DraftTeamStarterPoints: metric?.dsp ?? 0,
        V14DraftTeamBenchPoints: metric?.dbp ?? 0,
        V14AllLFLStarterPoints: metric?.sa ?? 0,
        V14DraftTeamCapturePct: metric?.cap ?? null,
        V14ProductionQuality: metric?.q || "unknown",
        V14PositionRoundComparables: metric?.ps ?? 0
      };
    });

    A.picks = corrected;
    A.topSteals = [...corrected]
      .filter(p => n(p.ValueAboveSlot) != null)
      .sort((a, b) => n(b.ValueAboveSlot) - n(a.ValueAboveSlot))
      .slice(0, 75);

    A.topBusts = [...corrected]
      .filter(p => n(p.ValueAboveSlot) != null)
      .sort((a, b) => n(a.ValueAboveSlot) - n(b.ValueAboveSlot))
      .slice(0, 75);

    A.classes = V14.classes || [];
    A.bestClasses = V14.bestClasses || [];
    A.worstClasses = V14.worstClasses || [];
    A.positionValue = V14.positionValue || [];
    A.roundValue = V14.roundValue || [];
    A.gradedPicks = V14.meta?.positionAdjustedPicks ?? corrected.length;
    A.totalPicks = V14.meta?.picks ?? corrected.length;
    A.coveragePct = V14.meta?.positionAdjustedCoveragePct ?? 0;
    A.methodology = {
      ...(A.methodology || {}),
      v14: V14.meta?.definitions || {}
    };

    A.__lflV14Applied = true;
    applied = true;
  }

  function ensureStyles() {
    if (document.querySelector("#lflDraftV140Styles")) return;

    const style = document.createElement("style");
    style.id = "lflDraftV140Styles";
    style.textContent = `
      .draft-v14-card{border-color:#36587c;background:linear-gradient(145deg,rgba(90,168,255,.07),rgba(17,24,43,.98))}
      .draft-v14-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
      .draft-v14-head h2{margin:4px 0 4px}
      .draft-v14-head p{margin:0;color:var(--muted);max-width:820px;line-height:1.5}
      .draft-v14-tabs{display:flex;gap:7px;flex-wrap:wrap;margin:15px 0 12px}
      .draft-v14-tabs button{border:1px solid var(--border);background:#10182b;color:var(--muted);padding:8px 10px;border-radius:9px;cursor:pointer}
      .draft-v14-tabs button.active,.draft-v14-tabs button:hover{background:#1a2943;color:var(--text);border-color:#46678e}
      .draft-v14-controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
      .draft-v14-controls select{background:#0d1426;border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:9px}
      .draft-v14-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .draft-v14-table-note{margin:8px 0 0;color:var(--muted);font-size:10px;line-height:1.5}
      .draft-v14-definition{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:flex-start;margin-top:10px;padding:10px 11px;border:1px solid var(--border);border-radius:10px;background:#0d1426}
      .draft-v14-definition strong{display:block;margin-bottom:2px}
      .draft-v14-definition span.muted{font-size:11px;line-height:1.5}
      .draft-v14-quality{font-size:9px;color:var(--muted)}
      @media(max-width:900px){.draft-v14-grid{grid-template-columns:1fr}.draft-v14-head{display:block}}
    `;
    document.head.appendChild(style);
  }

  function franchiseCell(row) {
    try {
      if (typeof displayFranchise === "function") {
        return displayFranchise(row.tid);
      }
    } catch (_) {}
    return `<strong>${esc14(row.tid != null ? `Team ${row.tid}` : "Unknown")}</strong>`;
  }

  function playerCell(row) {
    return `<strong>${esc14(row.n)}</strong><br><span class="muted">${esc14(row.p)} • ${row.s} • Pick ${row.o}</span>`;
  }

  function table14(headers, rows) {
    return `<div class="table-wrap"><table class="table"><thead><tr>${headers.map(h => `<th>${esc14(h)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table></div>`;
  }

  function qualityLabel(code) {
    if (code === "full_weekly") return "Full weekly";
    if (code === "verified_starters") return "Verified starters";
    if (code === "partial_legacy") return "Legacy partial";
    if (code === "partial") return "Partial";
    return "Unknown";
  }

  function filteredMetrics() {
    const root = document.querySelector("#draftValueV140");
    if (!root || !V14) return [];

    const season = root.querySelector("#dv14Season")?.value || "";
    const position = root.querySelector("#dv14Position")?.value || "";

    return (V14.picks || []).filter(row =>
      (!season || String(row.s) === season) &&
      (!position || row.p === position)
    );
  }

  function renderProjectionView() {
    const rows = filteredMetrics().filter(row =>
      row.pw >= 4 &&
      n(row.ep) != null &&
      n(row.ea) != null &&
      n(row.ed) != null
    );

    const best = [...rows].sort((a, b) => n(b.ed) - n(a.ed)).slice(0, 15);
    const worst = [...rows].sort((a, b) => n(a.ed) - n(b.ed)).slice(0, 15);

    const make = (list, good) => list.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${playerCell(row)}</td>
        <td>${fmt14(row.ea, 1)}</td>
        <td>${fmt14(row.ep, 1)}</td>
        <td class="${good ? "good" : "bad"}"><strong>${signed14(row.ed, 1)}</strong></td>
        <td>${row.pw}</td>
        <td>${franchiseCell(row)}</td>
      </tr>
    `);

    return `
      <div class="draft-v14-grid">
        <div class="card">
          <h2>Most Above ESPN Projection</h2>
          ${table14(["#","Player","Actual","ESPN Proj","Above / Below","Weeks","Drafted By"], make(best, true))}
        </div>
        <div class="card">
          <h2>Most Below ESPN Projection</h2>
          ${table14(["#","Player","Actual","ESPN Proj","Above / Below","Weeks","Drafted By"], make(worst, false))}
        </div>
      </div>
      <p class="draft-v14-table-note">Only weeks with an ESPN weekly projection are compared. Leaderboards require at least four projected weeks, preventing a one-week outlier from dominating the list.</p>
    `;
  }

  function renderPositionValueView() {
    const rows = filteredMetrics().filter(row =>
      n(row.pv) != null &&
      n(row.pe) != null &&
      n(row.sp) != null
    );

    const best = [...rows].sort((a, b) => n(b.pv) - n(a.pv)).slice(0, 15);
    const worst = [...rows].sort((a, b) => n(a.pv) - n(b.pv)).slice(0, 15);

    const make = (list, good) => list.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${playerCell(row)}</td>
        <td>${fmt14(row.sp, 1)}</td>
        <td>${fmt14(row.pe, 1)}</td>
        <td class="${good ? "good" : "bad"}"><strong>${signed14(row.pv, 1)}</strong></td>
        <td>${row.ps}</td>
        <td>${franchiseCell(row)}</td>
      </tr>
    `);

    return `
      <div class="draft-v14-grid">
        <div class="card">
          <h2>Best Position-Adjusted Picks</h2>
          ${table14(["#","Player","Season Pts","Pos/Round Expected","Value","Comparables","Drafted By"], make(best, true))}
        </div>
        <div class="card">
          <h2>Worst Position-Adjusted Picks</h2>
          ${table14(["#","Player","Season Pts","Pos/Round Expected","Value","Comparables","Drafted By"], make(worst, false))}
        </div>
      </div>
      <p class="draft-v14-table-note">Unlike the old model, a QB is compared with other QBs drafted in the same round, an RB with RBs in the same round, and so on. The player being graded is excluded from his own expectation.</p>
    `;
  }

  function renderProductionView() {
    const rows = filteredMetrics().filter(row =>
      row.drw > 0 || row.dsw > 0 || n(row.dsp) !== 0
    );

    const captured = [...rows]
      .sort((a, b) => n(b.dsp) - n(a.dsp))
      .slice(0, 20);

    const elsewhere = [...rows]
      .map(row => ({...row, elsewhere: Math.max(0, (n(row.sa) || 0) - (n(row.dsp) || 0))}))
      .filter(row => row.elsewhere > 0)
      .sort((a, b) => b.elsewhere - a.elsewhere)
      .slice(0, 20);

    const capturedRows = captured.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${playerCell(row)}</td>
        <td><strong>${fmt14(row.dsp, 1)}</strong></td>
        <td>${row.dsw}</td>
        <td>${row.drw}</td>
        <td>${row.cap == null ? "—" : `${fmt14(row.cap, 1)}%`}</td>
        <td>${franchiseCell(row)}<br><span class="draft-v14-quality">${esc14(qualityLabel(row.q))}</span></td>
      </tr>
    `);

    const elsewhereRows = elsewhere.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${playerCell(row)}</td>
        <td>${fmt14(row.dsp, 1)}</td>
        <td class="bad"><strong>${fmt14(row.elsewhere, 1)}</strong></td>
        <td>${row.dsw}</td>
        <td>${franchiseCell(row)}<br><span class="draft-v14-quality">${esc14(qualityLabel(row.q))}</span></td>
      </tr>
    `);

    return `
      <div class="draft-v14-grid">
        <div class="card">
          <h2>Most Starter Points Captured by Drafter</h2>
          ${table14(["#","Player","Draft-Team Pts","Starts","Roster Wks","Captured","Drafted By"], capturedRows)}
        </div>
        <div class="card">
          <h2>Most Starter Points Captured Elsewhere</h2>
          ${table14(["#","Player","Draft-Team Pts","Elsewhere Pts","Draft-Team Starts","Drafted By"], elsewhereRows)}
        </div>
      </div>
      <p class="draft-v14-table-note">Draft-Team Pts count only fantasy points that actually entered the drafting franchise's starting lineup. Bench production and points scored after a trade/drop do not receive credit. Older ESPN seasons are labeled where weekly retention is partial.</p>
    `;
  }

  function renderV14Panel(tab) {
    const panel = document.querySelector("#dv14Panel");
    if (!panel) return;

    document.querySelectorAll("#draftValueV140 [data-dv14-tab]").forEach(button => {
      button.classList.toggle("active", button.dataset.dv14Tab === tab);
    });

    panel.innerHTML =
      tab === "projection" ? renderProjectionView() :
      tab === "production" ? renderProductionView() :
      renderPositionValueView();

    panel.dataset.tab = tab;
  }

  function installV14Dashboard() {
    if (document.querySelector("#draftValueV140")) return;

    const tabs = document.querySelector("#draftTabs");
    if (!tabs || !V14) return;

    ensureStyles();

    const seasons = [...new Set(V14.picks.map(row => row.s))].sort((a, b) => b - a);
    const positions = [...new Set(V14.picks.map(row => row.p).filter(Boolean))].sort();

    const root = document.createElement("section");
    root.id = "draftValueV140";
    root.className = "card section-gap draft-v14-card";
    root.innerHTML = `
      <div class="draft-v14-head">
        <div>
          <span class="section-eyebrow">DRAFT VALUE 2.0 • v14.0</span>
          <h2>Three different questions. Three different stats.</h2>
          <p>The old site used one cross-position draft-slot benchmark for too many jobs. v14 separates player performance, position-adjusted draft outcome, and the points a manager actually captured.</p>
        </div>
        <span class="badge good">${fmt14(V14.meta.positionAdjustedCoveragePct, 2)}% adjusted benchmark coverage</span>
      </div>

      <div class="metrics section-gap">
        <div class="metric"><small>Position-adjusted picks</small><strong>${V14.meta.positionAdjustedPicks.toLocaleString()}</strong><span class="muted">of ${V14.meta.picks.toLocaleString()} picks</span></div>
        <div class="metric"><small>Weekly projections</small><strong>${fmt14(V14.meta.projectionEligibleCoveragePct, 2)}%</strong><span class="muted">${V14.meta.projectionSeasons}</span></div>
        <div class="metric"><small>Weekly player rows</small><strong>${V14.meta.weeklyPlayerRows.toLocaleString()}</strong><span class="muted">historical archive</span></div>
        <div class="metric"><small>Draft classes</small><strong>${V14.meta.classCount}</strong><span class="muted">regraded on adjusted value</span></div>
      </div>

      <div class="draft-v14-tabs">
        <button type="button" data-dv14-tab="projection">ESPN Projection vs Actual</button>
        <button type="button" class="active" data-dv14-tab="position">Position-Adjusted Draft Value</button>
        <button type="button" data-dv14-tab="production">Drafting-Team Production</button>
      </div>

      <div class="draft-v14-controls">
        <select id="dv14Season"><option value="">All seasons</option>${seasons.map(s => `<option value="${s}">${s}</option>`).join("")}</select>
        <select id="dv14Position"><option value="">All positions</option>${positions.map(p => `<option value="${esc14(p)}">${esc14(p)}</option>`).join("")}</select>
      </div>

      <div id="dv14Panel"></div>

      <div class="draft-v14-definition">
        <span class="badge good">Position-adjusted</span>
        <div><strong>Same position + same round, leave-one-out.</strong><span class="muted">${esc14(V14.meta.definitions.positionAdjusted)}</span></div>
      </div>
      <div class="draft-v14-definition">
        <span class="badge good">ESPN projection</span>
        <div><strong>Weekly projection and weekly actual are matched on the same scoring weeks.</strong><span class="muted">${esc14(V14.meta.definitions.projection)}</span></div>
      </div>
      <div class="draft-v14-definition">
        <span class="badge good">Manager realized</span>
        <div><strong>Only starter points actually scored for the drafting franchise count.</strong><span class="muted">${esc14(V14.meta.definitions.draftTeamProduction)}</span></div>
      </div>
      <div class="draft-v14-definition">
        <span class="badge">Class grades</span>
        <div><strong>Class grades were rebuilt too.</strong><span class="muted">${esc14(V14.meta.definitions.classGrades)}</span></div>
      </div>
    `;

    tabs.insertAdjacentElement("beforebegin", root);

    root.querySelectorAll("[data-dv14-tab]").forEach(button => {
      button.addEventListener("click", () => renderV14Panel(button.dataset.dv14Tab));
    });

    ["dv14Season", "dv14Position"].forEach(id => {
      root.querySelector(`#${id}`)?.addEventListener("change", () => {
        renderV14Panel(root.querySelector(".draft-v14-tabs button.active")?.dataset.dv14Tab || "position");
      });
    });

    renderV14Panel("position");
  }

  function replaceExactHeader(table, from, to) {
    if (!table) return;
    for (const th of table.querySelectorAll("th")) {
      if (th.textContent.trim() === from) th.textContent = to;
    }
  }

  function relabelBaseDraft() {
    const content = document.querySelector("#content");
    const panel = document.querySelector("#draftPanel");
    if (!content) return;

    const tabs = document.querySelector("#draftTabs");
    const stealsButton = tabs?.querySelector('[data-tab="steals"]');
    if (stealsButton) stealsButton.textContent = "Position-Adjusted Value";

    const topMetrics = content.querySelector(":scope > .metrics");
    if (topMetrics) {
      for (const small of topMetrics.querySelectorAll("small")) {
        if (small.textContent.trim() === "Pick-value coverage") {
          small.textContent = "Position-adjusted coverage";
        }
      }
    }

    const hero = [...content.querySelectorAll(".hero p")]
      .find(p => p.textContent.includes("Slot Value =") || p.textContent.includes("Position-Adjusted Value ="));
    if (hero) {
      hero.innerHTML = `<strong>Position-Adjusted Value = Player Season Pts − the leave-one-out historical average for the same position and draft round.</strong> This prevents quarterbacks from being graded against running backs, wide receivers, tight ends, kickers or defenses simply because they were drafted near the same overall pick. Weekly ESPN projection performance and actual drafting-team starter production are shown separately above.`;
    }

    if (!panel) return;

    for (const card of panel.querySelectorAll(".card")) {
      const h2 = card.querySelector("h2");
      if (h2) {
        const heading = h2.textContent.trim();
        if (heading === "Biggest Steals") h2.textContent = "Biggest Position-Adjusted Steals";
        if (heading === "Biggest Slot-Value Busts") h2.textContent = "Biggest Position-Adjusted Busts";
        if (heading === "Best Drafting Franchises by Average Pick Value") h2.textContent = "Best Drafting Franchises by Avg Position-Adjusted Value";
        if (heading === "Worst Slot Outcomes") h2.textContent = "Worst Position-Adjusted Outcomes";
      }
    }

    for (const small of panel.querySelectorAll("small")) {
      if (small.textContent.trim() === "Avg slot value") {
        small.textContent = "Avg position-adjusted value";
      }
    }

    for (const tableEl of panel.querySelectorAll("table")) {
      const headers = [...tableEl.querySelectorAll("th")].map(th => th.textContent.trim());

      replaceExactHeader(tableEl, "Actual", "Player Season Pts");
      replaceExactHeader(tableEl, "Expected", "Pos/Round Expected");
      replaceExactHeader(tableEl, "Value", "Pos-Adj Value");
      replaceExactHeader(tableEl, "Avg Value", "Avg Pos-Adj Value");
      replaceExactHeader(tableEl, "Total Value", "Total Pos-Adj Value");
      replaceExactHeader(tableEl, "Career Avg Value", "Career Avg Pos-Adj Value");

      if (headers.includes("Player") && headers.includes("Franchise")) {
        replaceExactHeader(tableEl, "Franchise", "Drafted By");
      }
      if (headers.includes("Player") && headers.includes("Franchise / Manager")) {
        replaceExactHeader(tableEl, "Franchise / Manager", "Drafted By");
      }
    }
  }

  function installBaseObserver() {
    const panel = document.querySelector("#draftPanel");
    if (!panel || panel.dataset.dv14Observed) return;
    panel.dataset.dv14Observed = "1";

    relabelBaseDraft();

    const observer = new MutationObserver(() => {
      relabelBaseDraft();
    });

    observer.observe(panel, { childList: true, subtree: true });
  }

  function renderEnhancedDraft() {
    applyV14Model();
    baseDraftPage();

    installV14Dashboard();
    relabelBaseDraft();
    installBaseObserver();

    if (typeof setHeader === "function") {
      setHeader(
        "Draft Lab",
        "Position-adjusted draft value, ESPN projection performance, and actual drafting-team production across 2013–2025."
      );
    }
    if (typeof setStatus === "function") {
      setStatus("Draft Value 2.0 loaded", "good");
    }
  }

  pages.draft = function () {
    if (V14) {
      renderEnhancedDraft();
      return;
    }

    if (typeof setHeader === "function") {
      setHeader("Draft Lab", "Loading corrected draft-value model...");
    }
    const content = document.querySelector("#content");
    if (content) {
      content.innerHTML = `<div class="empty">Loading Draft Value 2.0…</div>`;
    }

    loadV14()
      .then(() => {
        if (typeof currentPage === "undefined" || currentPage === "draft") {
          renderEnhancedDraft();
        }
      })
      .catch(error => {
        console.error("Draft Value v14 failed to load", error);
        baseDraftPage();
        if (typeof setStatus === "function") {
          setStatus("Draft Value data unavailable", "warn");
        }
      });
  };
})();