// LFL Draft Lab Value Model v14.2
// "Expected" now means ESPN weekly projection ONLY.
// Historical draft comparison is shown as Draft Value Percentile (0-100),
// never as fake expected fantasy points.

window.LFL_DRAFT_LAB_FIX_VERSION = "v14.2";

(function () {
  if (!window.pages || typeof pages.draft !== "function") return;

  const baseDraftPage = pages.draft;
  const DATA_URL = "/data/draft_value_v14.json";
  const KEVIN_WHITE_ESPN_ID = 3042435;
  const TRAVIS_HUNTER_ESPN_ID = 4685415;

  let V141 = null; // v14.2 data object; variable name retained for compatibility
  let loadPromise = null;
  let applied = false;
  let relabelling = false;

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

  function loadV141() {
    if (V141) return Promise.resolve(V141);
    if (loadPromise) return loadPromise;

    loadPromise = fetch(DATA_URL, { cache: "no-cache" })
      .then(response => {
        if (!response.ok) throw new Error(`Draft Value data HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        V141 = data;
        return data;
      });

    return loadPromise;
  }

  function applyModel() {
    if (applied) return;

    const A = DATA?.draftAnalytics;
    if (!A || !Array.isArray(A.picks)) return;

    const metricByKey = new Map((V141?.picks || []).map(row => [row.k, row]));
    const archivePositions = buildArchivePositionMap();

    const corrected = A.picks.map(original => {
      const key = exactKey(original.Season, original["Player ID"], original["Overall Pick"]);
      const metric = metricByKey.get(key);
      const position = metric?.p || correctedPosition(original, archivePositions);

      return {
        ...original,
        Position: position,

        // Keep the old fields for audit only.
        LegacyExpectedSlotPoints: original.ExpectedSlotPoints,
        LegacyValueAboveSlot: original.ValueAboveSlot,

        // CRITICAL: do not expose a historical fantasy-point benchmark as "Expected".
        ExpectedSlotPoints: null,

        // Base Draft Lab still expects one numeric value field.
        // We use centered percentile score: percentile - 50.
        ValueAboveSlot: metric?.ds ?? null,
        DraftValuePercentile: metric?.dv ?? null,
        DraftValueScore: metric?.ds ?? null,
        DraftValueLabel: metric?.dl || "No benchmark",
        DraftComparableCount: metric?.dc ?? 0,

        V14ProjectionWeeks: metric?.wew ?? 0,
        V14ESPNWeeklyProjected: metric?.wep ?? null,
        V14WeeklyProjectionActual: metric?.wea ?? null,
        V14WeeklyProjectionDelta: metric?.wed ?? null,

        // v14.2: draft "Expected" means ESPN's stored preseason full-season projection.
        V142ESPNPreseasonProjected: metric?.pep ?? null,
        V142SeasonActual: metric?.pea ?? null,
        V142PreseasonDelta: metric?.ped ?? null,
        V142PreseasonSourcePeriod: metric?.pps ?? null,
        V14DraftTeamRosterWeeks: metric?.drw ?? 0,
        V14DraftTeamStarterWeeks: metric?.dsw ?? 0,
        V14DraftTeamStarterPoints: metric?.dsp ?? 0,
        V14DraftTeamBenchPoints: metric?.dbp ?? 0,
        V14AllLFLStarterPoints: metric?.sa ?? 0,
        V14DraftTeamCapturePct: metric?.cap ?? null,
        V14ProductionQuality: metric?.q || "unknown"
      };
    });

    A.picks = corrected;
    A.topSteals = [...corrected]
      .filter(p => n(p.DraftValuePercentile) != null)
      .sort((a, b) => n(b.DraftValuePercentile) - n(a.DraftValuePercentile))
      .slice(0, 75);

    A.topBusts = [...corrected]
      .filter(p => n(p.DraftValuePercentile) != null)
      .sort((a, b) => n(a.DraftValuePercentile) - n(b.DraftValuePercentile))
      .slice(0, 75);

    A.classes = V141.classes || [];
    A.bestClasses = V141.bestClasses || [];
    A.worstClasses = V141.worstClasses || [];
    A.positionValue = V141.positionValue || [];
    A.roundValue = V141.roundValue || [];
    A.gradedPicks = V141.meta?.draftValuePicks ?? corrected.length;
    A.totalPicks = V141.meta?.picks ?? corrected.length;
    A.coveragePct = V141.meta?.draftValueCoveragePct ?? 0;

    A.__lflV141Applied = true;
    applied = true;
  }

  function ensureStyles() {
    if (document.querySelector("#lflDraftV141Styles")) return;

    const style = document.createElement("style");
    style.id = "lflDraftV141Styles";
    style.textContent = `
      .draft-v141-card{border-color:#36587c;background:linear-gradient(145deg,rgba(90,168,255,.07),rgba(17,24,43,.98))}
      .draft-v141-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}
      .draft-v141-head h2{margin:4px 0 4px}
      .draft-v141-head p{margin:0;color:var(--muted);max-width:830px;line-height:1.5}
      .draft-v141-tabs{display:flex;gap:7px;flex-wrap:wrap;margin:15px 0 12px}
      .draft-v141-tabs button{border:1px solid var(--border);background:#10182b;color:var(--muted);padding:8px 10px;border-radius:9px;cursor:pointer}
      .draft-v141-tabs button.active,.draft-v141-tabs button:hover{background:#1a2943;color:var(--text);border-color:#46678e}
      .draft-v141-controls{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
      .draft-v141-controls select{background:#0d1426;border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:9px}
      .draft-v141-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
      .draft-v141-note{margin:8px 0 0;color:var(--muted);font-size:10px;line-height:1.5}
      .draft-v141-definition{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:flex-start;margin-top:10px;padding:10px 11px;border:1px solid var(--border);border-radius:10px;background:#0d1426}
      .draft-v141-definition strong{display:block;margin-bottom:2px}
      .draft-v141-definition span.muted{font-size:11px;line-height:1.5}
      .draft-v141-quality{font-size:9px;color:var(--muted)}
      @media(max-width:900px){.draft-v141-grid{grid-template-columns:1fr}.draft-v141-head{display:block}}
    `;
    document.head.appendChild(style);
  }

  function franchiseCell(row) {
    try {
      if (typeof displayFranchise === "function") return displayFranchise(row.tid);
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
    const root = document.querySelector("#draftValueV141");
    if (!root || !V141) return [];

    const season = root.querySelector("#dv141Season")?.value || "";
    const position = root.querySelector("#dv141Position")?.value || "";

    return (V141.picks || []).filter(row =>
      (!season || String(row.s) === season) &&
      (!position || row.p === position)
    );
  }

  function renderProjectionView() {
    const all = filteredMetrics();
    const rows = all.filter(row =>
      n(row.pep) != null &&
      n(row.pea) != null &&
      n(row.ped) != null
    );

    if (!rows.length) {
      const root = document.querySelector("#draftValueV141");
      const season = root?.querySelector("#dv141Season")?.value || "";

      if (season === "2023") {
        return `<div class="empty"><strong>2023 ESPN preseason projections are intentionally unavailable.</strong><br><br>ESPN's historical archive returns 0.0 season projections for 160 of 192 drafted players in this league — including healthy elite players — and those zero values persist across every roster snapshot we tested. Rather than publish bad data, 2023 is excluded.</div>`;
      }

      if (["2013","2014","2015","2016","2017"].includes(season)) {
        return `<div class="empty"><strong>ESPN preseason projection history is unavailable for ${esc14(season)}.</strong><br><br>The historical league archive did not retain usable season-level preseason projections for 2013–2017.</div>`;
      }

      return `<div class="empty">No verified ESPN preseason season projection is available for this selection.</div>`;
    }

    const best = [...rows].sort((a, b) => n(b.ped) - n(a.ped)).slice(0, 15);
    const worst = [...rows].sort((a, b) => n(a.ped) - n(b.ped)).slice(0, 15);

    const make = (list, good) => list.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${playerCell(row)}</td>
        <td>${fmt14(row.pea, 1)}</td>
        <td>${fmt14(row.pep, 1)}</td>
        <td class="${good ? "good" : "bad"}"><strong>${signed14(row.ped, 1)}</strong></td>
        <td>${franchiseCell(row)}</td>
      </tr>
    `);

    return `
      <div class="draft-v141-grid">
        <div class="card">
          <h2>Most Above Preseason Expectation</h2>
          ${table14(["#","Player","Actual Season Pts","ESPN Preseason Expected","Beat By","Drafted By"], make(best, true))}
        </div>
        <div class="card">
          <h2>Most Below Preseason Expectation</h2>
          ${table14(["#","Player","Actual Season Pts","ESPN Preseason Expected","Missed By","Drafted By"], make(worst, false))}
        </div>
      </div>
      <p class="draft-v141-note"><strong>Expected = ESPN's stored full-season preseason projection.</strong> Actual = the player's full-season fantasy points under the same league scoring basis. Weekly in-season projections are not summed. Verified usable seasons: 2018–2022 and 2024–2025. 2023 is excluded because ESPN's historical projection archive is corrupted for that season.</p>
    `;
  }

  function renderDraftValueView() {
    const rows = filteredMetrics().filter(row =>
      n(row.dv) != null &&
      n(row.sp) != null
    );

    const best = [...rows].sort((a, b) => n(b.dv) - n(a.dv)).slice(0, 15);
    const worst = [...rows].sort((a, b) => n(a.dv) - n(b.dv)).slice(0, 15);

    const make = list => list.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${playerCell(row)}</td>
        <td>${fmt14(row.sp, 1)}</td>
        <td><strong>${fmt14(row.dv, 1)}th</strong></td>
        <td>${esc14(row.dl)}</td>
        <td>${row.dc}</td>
        <td>${franchiseCell(row)}</td>
      </tr>
    `);

    return `
      <div class="draft-v141-grid">
        <div class="card">
          <h2>Best Draft Outcomes</h2>
          ${table14(["#","Player","Season Pts","Draft Value %ile","Label","Comparables","Drafted By"], make(best))}
        </div>
        <div class="card">
          <h2>Worst Draft Outcomes</h2>
          ${table14(["#","Player","Season Pts","Draft Value %ile","Label","Comparables","Drafted By"], make(worst))}
        </div>
      </div>
      <p class="draft-v141-note">Draft Value Percentile compares the player's season outcome only with other LFL picks at the same position and draft round. It is a relative draft result, <strong>not expected fantasy points</strong>.</p>
    `;
  }

  function renderProductionView() {
    const rows = filteredMetrics().filter(row =>
      row.drw > 0 || row.dsw > 0 || n(row.dsp) !== 0
    );

    const captured = [...rows].sort((a, b) => n(b.dsp) - n(a.dsp)).slice(0, 20);
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
        <td>${franchiseCell(row)}<br><span class="draft-v141-quality">${esc14(qualityLabel(row.q))}</span></td>
      </tr>
    `);

    const elsewhereRows = elsewhere.map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${playerCell(row)}</td>
        <td>${fmt14(row.dsp, 1)}</td>
        <td class="bad"><strong>${fmt14(row.elsewhere, 1)}</strong></td>
        <td>${row.dsw}</td>
        <td>${franchiseCell(row)}<br><span class="draft-v141-quality">${esc14(qualityLabel(row.q))}</span></td>
      </tr>
    `);

    return `
      <div class="draft-v141-grid">
        <div class="card">
          <h2>Most Starter Points Captured by Drafter</h2>
          ${table14(["#","Player","Draft-Team Pts","Starts","Roster Wks","Captured","Drafted By"], capturedRows)}
        </div>
        <div class="card">
          <h2>Most Starter Points Captured Elsewhere</h2>
          ${table14(["#","Player","Draft-Team Pts","Elsewhere Pts","Draft-Team Starts","Drafted By"], elsewhereRows)}
        </div>
      </div>
      <p class="draft-v141-note">Draft-Team Pts count only fantasy points that actually entered the drafting franchise's starting lineup. Bench points and points scored after a trade/drop do not receive credit.</p>
    `;
  }

  function renderDashboard(tab) {
    const panel = document.querySelector("#dv141Panel");
    if (!panel) return;

    document.querySelectorAll("#draftValueV141 [data-dv141-tab]").forEach(button => {
      button.classList.toggle("active", button.dataset.dv141Tab === tab);
    });

    panel.innerHTML =
      tab === "draftvalue" ? renderDraftValueView() :
      tab === "production" ? renderProductionView() :
      renderProjectionView();

    panel.dataset.tab = tab;
  }

  function installDashboard() {
    if (document.querySelector("#draftValueV141")) return;

    const tabs = document.querySelector("#draftTabs");
    if (!tabs || !V141) return;

    ensureStyles();

    const seasons = [...new Set(V141.picks.map(row => row.s))].sort((a, b) => b - a);
    const positions = [...new Set(V141.picks.map(row => row.p).filter(Boolean))].sort();

    const root = document.createElement("section");
    root.id = "draftValueV141";
    root.className = "card section-gap draft-v141-card";
    root.innerHTML = `
      <div class="draft-v141-head">
        <div>
          <span class="section-eyebrow">DRAFT VALUE 2.2 • v14.2</span>
          <h2>Expected points now means ESPN preseason season projection.</h2>
          <p>Draft expectation now uses ESPN's stored preseason full-season projection. Relative draft outcome and manager-realized production remain separate metrics.</p>
        </div>
        <span class="badge good">${fmt14(V141.meta.draftValueCoveragePct, 2)}% draft-value coverage</span>
      </div>

      <div class="metrics section-gap">
        <div class="metric"><small>Draft-value picks</small><strong>${V141.meta.draftValuePicks.toLocaleString()}</strong><span class="muted">of ${V141.meta.picks.toLocaleString()} picks</span></div>
        <div class="metric"><small>ESPN preseason coverage</small><strong>${fmt14(V141.meta.preseasonProjectionCoveragePct, 2)}%</strong><span class="muted">${V141.meta.preseasonProjectionSeasons}</span></div>
        <div class="metric"><small>Weekly player rows</small><strong>${V141.meta.weeklyPlayerRows.toLocaleString()}</strong><span class="muted">historical archive</span></div>
        <div class="metric"><small>Draft classes</small><strong>${V141.meta.classCount}</strong><span class="muted">regraded on relative value</span></div>
      </div>

      <div class="draft-v141-tabs">
        <button type="button" class="active" data-dv141-tab="projection">ESPN Preseason Expected vs Actual</button>
        <button type="button" data-dv141-tab="draftvalue">Draft Value Percentile</button>
        <button type="button" data-dv141-tab="production">Drafting-Team Production</button>
      </div>

      <div class="draft-v141-controls">
        <select id="dv141Season"><option value="">All seasons</option>${seasons.map(s => `<option value="${s}">${s}</option>`).join("")}</select>
        <select id="dv141Position"><option value="">All positions</option>${positions.map(p => `<option value="${esc14(p)}">${esc14(p)}</option>`).join("")}</select>
      </div>

      <div id="dv141Panel"></div>

      <div class="draft-v141-definition">
        <span class="badge good">Expected Points</span>
        <div><strong>ESPN preseason full-season projection only.</strong><span class="muted">${esc14(V141.meta.definitions.expectedPoints)}</span></div>
      </div>
      <div class="draft-v141-definition">
        <span class="badge">Draft Value</span>
        <div><strong>0–100 relative percentile, not points.</strong><span class="muted">${esc14(V141.meta.definitions.draftValue)}</span></div>
      </div>
      <div class="draft-v141-definition">
        <span class="badge good">Manager realized</span>
        <div><strong>Only starter points actually scored for the drafting franchise count.</strong><span class="muted">${esc14(V141.meta.definitions.draftTeamProduction)}</span></div>
      </div>
    `;

    tabs.insertAdjacentElement("beforebegin", root);

    root.querySelectorAll("[data-dv141-tab]").forEach(button => {
      button.addEventListener("click", () => renderDashboard(button.dataset.dv141Tab));
    });

    ["dv141Season", "dv141Position"].forEach(id => {
      root.querySelector(`#${id}`)?.addEventListener("change", () => {
        renderDashboard(root.querySelector(".draft-v141-tabs button.active")?.dataset.dv141Tab || "projection");
      });
    });

    renderDashboard("projection");
  }

  function removeColumnByHeader(table, names) {
    if (!table) return;
    const headers = [...table.querySelectorAll("thead th")];
    const index = headers.findIndex(th => names.includes(th.textContent.trim()));
    if (index < 0) return;

    for (const row of table.querySelectorAll("tr")) {
      const cells = row.children;
      if (cells[index]) cells[index].remove();
    }
  }

  function replaceHeader(table, from, to) {
    if (!table) return;
    for (const th of table.querySelectorAll("th")) {
      if (th.textContent.trim() === from) th.textContent = to;
    }
  }

  function postProcessBaseDraft() {
    if (relabelling) return;
    relabelling = true;
    try {
      const content = document.querySelector("#content");
      const panel = document.querySelector("#draftPanel");
      if (!content) return;

      const stealsButton = document.querySelector('#draftTabs [data-tab="steals"]');
      if (stealsButton) stealsButton.textContent = "Draft Value";

      const topMetrics = content.querySelector(":scope > .metrics");
      if (topMetrics) {
        for (const metric of topMetrics.querySelectorAll(".metric")) {
          const label = metric.querySelector("small")?.textContent.trim();
          if (label === "Pick-value coverage") {
            metric.querySelector("small").textContent = "Draft-value coverage";
          }
          if (label === "Biggest steal") {
            const detail = metric.querySelector(".muted");
            if (detail) detail.textContent = detail.textContent.replace(/\spts$/, " score");
          }
        }
      }

      const hero = [...content.querySelectorAll(".hero p")]
        .find(p => p.textContent.includes("Slot Value =") || p.textContent.includes("Draft Value"));
      if (hero) {
        hero.innerHTML = `<strong>Expected Points = ESPN preseason full-season projection only.</strong> Draft Value is a separate 0–100 percentile based on how a player performed relative to other LFL picks at the same position and draft round. It is not an expected-points estimate.`;
      }

      if (!panel) return;

      for (const card of panel.querySelectorAll(".card")) {
        const h2 = card.querySelector("h2");
        if (h2) {
          const heading = h2.textContent.trim();
          if (heading === "Biggest Steals") h2.textContent = "Best Draft Outcomes";
          if (heading === "Biggest Slot-Value Busts") h2.textContent = "Worst Draft Outcomes";
          if (heading === "Best Drafting Franchises by Average Pick Value") h2.textContent = "Best Drafting Franchises by Avg Draft Value Score";
          if (heading === "Worst Slot Outcomes") h2.textContent = "Worst Draft Outcomes";
        }
      }

      for (const small of panel.querySelectorAll("small")) {
        if (small.textContent.trim() === "Avg slot value") {
          small.textContent = "Avg draft value score";
        }
      }

      for (const tableEl of panel.querySelectorAll("table")) {
        // Remove every historical "Expected" fantasy-point column from the base Draft Lab.
        removeColumnByHeader(tableEl, [
          "Expected",
          "Slot Expectation",
          "Pos/Round Expected",
          "Round Expected"
        ]);

        replaceHeader(tableEl, "Actual", "Player Season Pts");
        replaceHeader(tableEl, "Value", "Draft Value Score");
        replaceHeader(tableEl, "Avg Value", "Avg Draft Score");
        replaceHeader(tableEl, "Total Value", "Total Draft Score");
        replaceHeader(tableEl, "Career Avg Value", "Career Avg Draft Score");
        replaceHeader(tableEl, "Avg Value / Pick", "Avg Draft Score / Pick");
        replaceHeader(tableEl, "Franchise", "Drafted By");
      }
    } finally {
      relabelling = false;
    }
  }

  function installObserver() {
    const panel = document.querySelector("#draftPanel");
    if (!panel || panel.dataset.dv141Observed) return;
    panel.dataset.dv141Observed = "1";

    postProcessBaseDraft();

    const observer = new MutationObserver(() => {
      postProcessBaseDraft();
    });

    observer.observe(panel, { childList: true, subtree: true });
  }

  function renderEnhancedDraft() {
    applyModel();
    baseDraftPage();

    installDashboard();
    postProcessBaseDraft();
    installObserver();

    if (typeof setHeader === "function") {
      setHeader(
        "Draft Lab",
        "ESPN preseason expected points, relative draft value, and actual drafting-team production across 2013–2025."
      );
    }
    if (typeof setStatus === "function") {
      setStatus("Draft Value 2.2 loaded", "good");
    }
  }

  pages.draft = function () {
    if (V141) {
      renderEnhancedDraft();
      return;
    }

    if (typeof setHeader === "function") {
      setHeader("Draft Lab", "Loading verified preseason expected-points model...");
    }

    const content = document.querySelector("#content");
    if (content) {
      content.innerHTML = `<div class="empty">Loading Draft Value 2.2…</div>`;
    }

    loadV141()
      .then(() => {
        if (typeof currentPage === "undefined" || currentPage === "draft") {
          renderEnhancedDraft();
        }
      })
      .catch(error => {
        console.error("Draft Value v14.2 failed to load", error);
        baseDraftPage();
        if (typeof setStatus === "function") {
          setStatus("Draft Value data unavailable", "warn");
        }
      });
  };
})();