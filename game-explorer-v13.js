// LFL Historical Game Explorer v13.0
// Adds verified weekly matchup box scores to Records & Analytics.
// Loads compact player-level data from /data/game_boxscores_v13.json.
// Does not modify historical source JSON or existing record calculations.

window.LFL_GAME_EXPLORER_VERSION = "v13.0";

(function () {
  if (typeof pages === "undefined" || typeof navigate !== "function") return;

  const DATA_URL = "/data/game_boxscores_v13.json";
  const ROOT_ID = "lflGameExplorerV130";
  let boxData = null;
  let loadPromise = null;
  let selectedGameKey = null;

  function esc13(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[c]));
  }

  function n13(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function pts13(v) {
    const n = n13(v);
    if (n == null) return "—";
    return n.toLocaleString(undefined,{minimumFractionDigits:Number.isInteger(n)?0:1,maximumFractionDigits:2});
  }

  function signed13(v) {
    const n = n13(v);
    if (n == null) return "—";
    return `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
  }

  function stage13(tier) {
    if (tier === "WINNERS_BRACKET") return "Playoffs";
    if (tier === "LOSERS_CONSOLATION_LADDER") return "Consolation";
    if (tier === "WINNERS_CONSOLATION_LADDER") return "Placement";
    return "Regular Season";
  }

  function coverageLabel13(cov) {
    if (cov === "Full Lineup + Bench") return "Full Box Score";
    if (cov === "Verified Starters Only") return "Verified Starters";
    if (cov === "Partial / Needs Review") return "Partial ESPN Data";
    if (cov === "Matchup Only") return "Matchup Only";
    if (cov === "Bracket Bye") return "Playoff Bye";
    return cov || "Unknown";
  }

  function coverageClass13(cov) {
    if (cov === "Full Lineup + Bench") return "good";
    if (cov === "Verified Starters Only") return "warn";
    if (cov === "Partial / Needs Review" || cov === "Matchup Only") return "bad";
    if (cov === "Bracket Bye") return "";
    return "";
  }

  function historicalManager13(teamId, season) {
    const rows = (window.DATA || DATA)?.teams || [];
    const row = rows.find(x => Number(x.Season) === Number(season) && Number(x["Team ID"]) === Number(teamId));
    const owner = row?.["Owner(s)"] || "";
    try {
      if (typeof canonicalOwner === "function") return canonicalOwner(owner);
    } catch (_) {}
    return owner;
  }

  function ensureStyles13() {
    if (document.querySelector("#lflGameExplorerV130Styles")) return;
    const s = document.createElement("style");
    s.id = "lflGameExplorerV130Styles";
    s.textContent = `
      .game-explorer-v13{margin:0 0 18px;border:1px solid #345071;background:linear-gradient(145deg,rgba(90,168,255,.08),rgba(17,24,43,.96));border-radius:18px;padding:18px}
      .game-explorer-v13-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:14px}
      .game-explorer-v13-head h2{margin:4px 0 6px}
      .game-explorer-v13-head p{margin:0;color:var(--muted);line-height:1.5;max-width:760px}
      .game-explorer-v13-meta{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
      .game-explorer-v13-controls{display:grid;grid-template-columns:130px 120px 1fr 155px;gap:9px;margin:14px 0}
      .game-explorer-v13-controls select,.game-explorer-v13-controls input{width:100%;background:#0d1426;border:1px solid var(--border);color:var(--text);padding:9px 10px;border-radius:10px}
      .game-explorer-v13-grid{display:grid;grid-template-columns:minmax(0,.95fr) minmax(420px,1.45fr);gap:14px;align-items:start}
      .game-list-v13{border:1px solid var(--border);border-radius:13px;overflow:hidden;background:#0d1426}
      .game-list-v13-head{display:flex;justify-content:space-between;gap:10px;padding:11px 12px;border-bottom:1px solid var(--border);color:var(--muted);font-size:11px}
      .game-list-v13-scroll{max-height:660px;overflow:auto}
      .game-row-v13{width:100%;display:grid;grid-template-columns:52px 1fr auto;gap:9px;align-items:center;border:0;border-bottom:1px solid rgba(38,50,78,.7);background:transparent;color:var(--text);padding:11px 12px;text-align:left;cursor:pointer}
      .game-row-v13:hover,.game-row-v13.active{background:#17223a}
      .game-row-v13-week{font-size:10px;color:#8da0c2;font-weight:900;text-transform:uppercase}
      .game-row-v13-main strong{display:block;font-size:12px;line-height:1.35}
      .game-row-v13-main span{display:block;color:var(--muted);font-size:10px;margin-top:3px}
      .game-row-v13-score{font-weight:900;font-size:13px;white-space:nowrap}
      .box-detail-v13{border:1px solid var(--border);border-radius:13px;background:#0d1426;overflow:hidden;min-height:300px}
      .box-detail-v13-empty{display:grid;place-items:center;min-height:300px;color:var(--muted);text-align:center;padding:30px}
      .box-hero-v13{padding:16px;border-bottom:1px solid var(--border);background:linear-gradient(135deg,rgba(90,168,255,.09),transparent)}
      .box-hero-v13-top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}
      .box-matchup-v13{display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:center}
      .box-team-v13{min-width:0}
      .box-team-v13:last-child{text-align:right}
      .box-team-v13 strong{display:block;font-size:16px}
      .box-team-v13 span{display:block;color:var(--muted);font-size:11px;margin-top:3px}
      .box-score-v13{font-size:26px;font-weight:950;white-space:nowrap}
      .box-quality-v13{padding:11px 14px;border-bottom:1px solid var(--border);font-size:11px;color:var(--muted);line-height:1.5}
      .box-sides-v13{display:grid;grid-template-columns:1fr 1fr;gap:0}
      .box-side-v13{min-width:0;padding:13px}
      .box-side-v13+ .box-side-v13{border-left:1px solid var(--border)}
      .box-side-title-v13{display:flex;justify-content:space-between;gap:8px;align-items:end;margin-bottom:9px}
      .box-side-title-v13 strong{font-size:13px}
      .box-side-title-v13 span{font-size:10px;color:var(--muted)}
      .player-table-v13{width:100%;border-collapse:collapse}
      .player-table-v13 th,.player-table-v13 td{padding:7px 5px;border-bottom:1px solid rgba(38,50,78,.55);font-size:10px;text-align:left}
      .player-table-v13 th{color:#91a3c4;font-size:9px;text-transform:uppercase;letter-spacing:.05em}
      .player-table-v13 td.num,.player-table-v13 th.num{text-align:right;white-space:nowrap}
      .player-table-v13 .slot{color:#8fa4c7;width:42px}
      .player-name-v13 strong{display:block;font-size:11px}
      .player-name-v13 span{color:var(--muted);font-size:9px}
      .bench-head-v13{margin:12px 0 4px;color:#93a5c5;font-size:9px;font-weight:900;letter-spacing:.1em;text-transform:uppercase}
      .game-explorer-v13 .badge.good{color:var(--good)}
      .game-explorer-v13 .badge.bad{color:var(--bad)}
      .game-explorer-v13 .badge.warn{color:var(--warn)}
      .game-data-note-v13{margin-top:12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;color:var(--muted);font-size:10px;line-height:1.5}
      .game-share-v13{border:1px solid var(--border);background:#101a2d;color:var(--muted);padding:6px 9px;border-radius:8px;cursor:pointer;font-size:10px}
      .game-share-v13:hover{color:var(--text);background:#182540}
      @media(max-width:1120px){.game-explorer-v13-grid{grid-template-columns:1fr}.game-list-v13-scroll{max-height:360px}}
      @media(max-width:760px){.game-explorer-v13-head{display:block}.game-explorer-v13-meta{justify-content:flex-start;margin-top:10px}.game-explorer-v13-controls{grid-template-columns:1fr 1fr}.box-sides-v13{grid-template-columns:1fr}.box-side-v13+ .box-side-v13{border-left:0;border-top:1px solid var(--border)}.box-matchup-v13{grid-template-columns:1fr auto 1fr}.box-score-v13{font-size:21px}}
    `;
    document.head.appendChild(s);
  }

  function ensureData13() {
    if (boxData) return Promise.resolve(boxData);
    if (loadPromise) return loadPromise;
    loadPromise = fetch(DATA_URL, {cache:"force-cache"})
      .then(r => {
        if (!r.ok) throw new Error(`Game data HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        boxData = data;
        return data;
      });
    return loadPromise;
  }

  function parseGameFromHash13() {
    const hash = location.hash || "";
    const q = hash.split("?")[1] || "";
    const p = new URLSearchParams(q);
    return p.get("game");
  }

  function setGameHash13(key) {
    if (!key) return;
    const desired = `#records?game=${encodeURIComponent(key)}`;
    if (location.hash !== desired) history.replaceState({page:"records",game:key},"",desired);
  }

  function installSidebarJump13() {
    if (document.querySelector("#lflGameExplorerNavV130")) return;
    const groups = [...document.querySelectorAll(".lfl-nav-section")];
    const group = groups.find(g => g.querySelector(".lfl-nav-label")?.textContent.trim() === "Games & Records");
    const items = group?.querySelector(".lfl-nav-items");
    if (!items) return;

    const b = document.createElement("button");
    b.type = "button";
    b.id = "lflGameExplorerNavV130";
    b.innerHTML = `<span class="lfl-nav-icon">G</span><span>Game Explorer</span>`;
    b.addEventListener("click", () => {
      navigate("records");
      setTimeout(() => {
        document.querySelector(`#${ROOT_ID}`)?.scrollIntoView({behavior:"smooth",block:"start"});
      }, 30);
    });
    items.prepend(b);
  }

  function injectShell13() {
    ensureStyles13();
    installSidebarJump13();
    const content = document.querySelector("#content");
    if (!content || document.querySelector(`#${ROOT_ID}`)) return;

    const root = document.createElement("section");
    root.id = ROOT_ID;
    root.className = "game-explorer-v13";
    root.innerHTML = `
      <div class="game-explorer-v13-head">
        <div>
          <span class="section-eyebrow">HISTORICAL GAME EXPLORER</span>
          <h2>Every LFL matchup, down to the players</h2>
          <p>Open a game to see the verified ESPN weekly lineup and player scoring underneath the final score.</p>
        </div>
        <div class="game-explorer-v13-meta" id="gameExplorerMetaV130">
          <span class="badge">Loading archive...</span>
        </div>
      </div>
      <div class="game-explorer-v13-controls">
        <select id="gameSeasonV130" aria-label="Season"></select>
        <select id="gameWeekV130" aria-label="Week"></select>
        <select id="gameTeamV130" aria-label="Team"></select>
        <select id="gameStageV130" aria-label="Stage">
          <option value="all">All stages</option>
          <option value="NONE">Regular Season</option>
          <option value="WINNERS_BRACKET">Playoffs</option>
          <option value="LOSERS_CONSOLATION_LADDER">Consolation</option>
          <option value="WINNERS_CONSOLATION_LADDER">Placement</option>
        </select>
      </div>
      <div class="game-explorer-v13-grid">
        <div class="game-list-v13">
          <div class="game-list-v13-head"><span id="gameCountV130">Loading games...</span><span>Click a matchup</span></div>
          <div class="game-list-v13-scroll" id="gameListV130"></div>
        </div>
        <div class="box-detail-v13" id="gameDetailV130">
          <div class="box-detail-v13-empty">Loading historical box scores...</div>
        </div>
      </div>
      <div class="game-data-note-v13">
        ESPN historical retention varies by era. Full modern box scores include weekly starters, bench/IR and projections where retained. Older seasons are labeled <strong>Verified Starters</strong> or <strong>Partial ESPN Data</strong> when ESPN no longer exposes a complete historical lineup. Missing players are never invented.
      </div>
    `;
    content.prepend(root);

    ensureData13().then(initExplorer13).catch(err => {
      const detail = document.querySelector("#gameDetailV130");
      if (detail) detail.innerHTML = `<div class="box-detail-v13-empty"><div><strong>Game archive could not load.</strong><br>${esc13(err.message)}</div></div>`;
    });
  }

  function initExplorer13(data) {
    const root = document.querySelector(`#${ROOT_ID}`);
    if (!root) return;

    const seasons = [...new Set(data.games.map(g => g.s))].sort((a,b)=>b-a);
    const seasonSelect = root.querySelector("#gameSeasonV130");
    seasonSelect.innerHTML = seasons.map(s => `<option value="${s}">${s} Season</option>`).join("");

    const requested = parseGameFromHash13();
    const requestedGame = requested ? data.games.find(g => g.k === requested) : null;
    const initialSeason = requestedGame?.s || seasons[0];
    seasonSelect.value = String(initialSeason);

    populateTeams13();
    populateWeeks13(requestedGame?.w);
    renderMeta13();
    renderGameList13(requestedGame?.k || null);

    root.querySelector("#gameSeasonV130").addEventListener("change", () => {
      populateTeams13();
      populateWeeks13();
      selectedGameKey = null;
      renderGameList13();
    });
    root.querySelector("#gameWeekV130").addEventListener("change", () => { selectedGameKey=null; renderGameList13(); });
    root.querySelector("#gameTeamV130").addEventListener("change", () => { selectedGameKey=null; renderGameList13(); });
    root.querySelector("#gameStageV130").addEventListener("change", () => { selectedGameKey=null; renderGameList13(); });
  }

  function renderMeta13() {
    const m = boxData.meta;
    const target = document.querySelector("#gameExplorerMetaV130");
    if (!target) return;
    target.innerHTML = `
      <span class="badge good">${m.games.toLocaleString()} archive rows</span>
      <span class="badge">${m.playerRows.toLocaleString()} player-weeks</span>
      <span class="badge">${m.projectionCoveragePct}% projections</span>
    `;
  }

  function populateWeeks13(preselect) {
    const root = document.querySelector(`#${ROOT_ID}`);
    if (!root) return;
    const season = Number(root.querySelector("#gameSeasonV130").value);
    const weeks = [...new Set(boxData.games.filter(g => g.s === season).map(g => g.w))].sort((a,b)=>b-a);
    const sel = root.querySelector("#gameWeekV130");
    sel.innerHTML = `<option value="all">All weeks</option>` + weeks.map(w => `<option value="${w}">Week ${w}</option>`).join("");
    sel.value = preselect != null && weeks.includes(Number(preselect)) ? String(preselect) : String(weeks[0] || "all");
  }

  function populateTeams13() {
    const root = document.querySelector(`#${ROOT_ID}`);
    if (!root) return;
    const season = Number(root.querySelector("#gameSeasonV130").value);
    const teams = new Map();
    for (const g of boxData.games.filter(g => g.s === season)) {
      if (g.h?.id != null) teams.set(g.h.id, g.h.n || `Team ${g.h.id}`);
      if (g.a?.id != null) teams.set(g.a.id, g.a.n || `Team ${g.a.id}`);
    }
    const sel = root.querySelector("#gameTeamV130");
    sel.innerHTML = `<option value="all">All teams</option>` +
      [...teams.entries()].sort((a,b)=>String(a[1]).localeCompare(String(b[1]))).map(([id,n]) => `<option value="${id}">${esc13(n)}</option>`).join("");
  }

  function filteredGames13() {
    const root = document.querySelector(`#${ROOT_ID}`);
    if (!root || !boxData) return [];
    const season = Number(root.querySelector("#gameSeasonV130").value);
    const week = root.querySelector("#gameWeekV130").value;
    const team = root.querySelector("#gameTeamV130").value;
    const stage = root.querySelector("#gameStageV130").value;

    return boxData.games.filter(g =>
      g.s === season &&
      (week === "all" || g.w === Number(week)) &&
      (team === "all" || g.h?.id === Number(team) || g.a?.id === Number(team)) &&
      (stage === "all" || g.pt === stage)
    ).sort((a,b)=>b.w-a.w || a.m-b.m);
  }

  function renderGameList13(preselectKey) {
    const list = document.querySelector("#gameListV130");
    const count = document.querySelector("#gameCountV130");
    if (!list || !boxData) return;
    const games = filteredGames13();
    count.textContent = `${games.length} matchup${games.length===1?"":"s"}`;

    list.innerHTML = games.map(g => {
      const away = g.a?.id == null ? "BYE" : g.a.n;
      const score = g.a?.id == null ? pts13(g.h.sc) : `${pts13(g.h.sc)} - ${pts13(g.a.sc)}`;
      return `<button type="button" class="game-row-v13 ${g.k===selectedGameKey?"active":""}" data-game-key="${esc13(g.k)}">
        <span class="game-row-v13-week">W${g.w}</span>
        <span class="game-row-v13-main">
          <strong>${esc13(g.h.n)} vs ${esc13(away)}</strong>
          <span>${esc13(stage13(g.pt))} · ${esc13(coverageLabel13(g.cov))}</span>
        </span>
        <span class="game-row-v13-score">${esc13(score)}</span>
      </button>`;
    }).join("") || `<div class="box-detail-v13-empty">No matchups match these filters.</div>`;

    list.querySelectorAll("[data-game-key]").forEach(b => b.addEventListener("click", () => selectGame13(b.dataset.gameKey)));

    let target = preselectKey && games.find(g=>g.k===preselectKey) ? preselectKey : null;
    if (!target && selectedGameKey && games.find(g=>g.k===selectedGameKey)) target = selectedGameKey;
    if (!target && games.length) target = games[0].k;
    if (target) selectGame13(target, false);
    else renderGameDetail13(null);
  }

  function selectGame13(key, updateHash=true) {
    selectedGameKey = key;
    document.querySelectorAll(".game-row-v13").forEach(b => b.classList.toggle("active", b.dataset.gameKey===key));
    renderGameDetail13(boxData.games.find(g => g.k === key) || null);
    if (updateHash) setGameHash13(key);
  }

  function sidePlayers13(game, side) {
    return (boxData.players[game.k] || []).filter(p => p.sd === side);
  }

  function playerTable13(rows) {
    if (!rows.length) return `<div class="muted" style="font-size:10px;padding:8px 2px">No player rows retained by ESPN for this side.</div>`;
    return `<table class="player-table-v13">
      <thead><tr><th>Slot</th><th>Player</th><th class="num">Pts</th><th class="num">Proj</th><th class="num">+/-</th></tr></thead>
      <tbody>${rows.map(p => {
        const delta = n13(p.pr) == null || n13(p.pts) == null ? null : n13(p.pts)-n13(p.pr);
        return `<tr>
          <td class="slot">${esc13(p.ls || (p.st ? "START" : "BN"))}</td>
          <td class="player-name-v13"><strong>${esc13(p.n)}</strong><span>${esc13(p.p || "")}${p.inj?` · ${esc13(p.inj)}`:""}</span></td>
          <td class="num">${esc13(pts13(p.pts))}</td>
          <td class="num">${esc13(pts13(p.pr))}</td>
          <td class="num ${delta!=null?(delta>=0?"good":"bad"):""}">${esc13(signed13(delta))}</td>
        </tr>`;
      }).join("")}</tbody>
    </table>`;
  }

  function sidePanel13(game, sideName, side) {
    if (!side || side.id == null) return `<div class="box-side-v13"><div class="box-side-title-v13"><strong>Bye</strong></div><div class="muted" style="font-size:11px">No opposing roster for this bracket entry.</div></div>`;

    const ps = sidePlayers13(game, sideName);
    const starters = ps.filter(p=>p.st);
    const bench = ps.filter(p=>!p.st);
    const q = side.q || {};
    const manager = historicalManager13(side.id, game.s);
    const missing = n13(q.missingPoints);
    const note = q.coverage === "Partial Starters - Score Gap"
      ? `ESPN retained ${pts13(q.starterSum)} of this team's ${pts13(side.sc)} points. ${pts13(missing)} points are not attached to a surviving historical player row.`
      : q.coverage === "Verified Starters Only"
        ? `Weekly starters reconcile to the ESPN team score. ESPN does not retain a reliable weekly bench for this era.`
        : q.coverage === "Roster Present - Score Mismatch"
          ? `ESPN returned a roster container, but lineup-slot metadata is not reliable for this historical scoring period.`
          : "";

    return `<div class="box-side-v13">
      <div class="box-side-title-v13">
        <div><strong>${esc13(side.n)}</strong><span>${esc13(manager)}</span></div>
        <span>${starters.length} starter rows${bench.length?` · ${bench.length} bench/IR`:""}</span>
      </div>
      ${playerTable13(starters)}
      ${bench.length ? `<div class="bench-head-v13">Bench / IR · ${pts13(side.bp)} pts</div>${playerTable13(bench)}` : ""}
      ${note ? `<div class="game-data-note-v13">${esc13(note)}</div>` : ""}
    </div>`;
  }

  function renderGameDetail13(game) {
    const target = document.querySelector("#gameDetailV130");
    if (!target) return;
    if (!game) {
      target.innerHTML = `<div class="box-detail-v13-empty">Select a matchup to open its historical box score.</div>`;
      return;
    }

    const awayName = game.a?.id == null ? "BYE" : game.a.n;
    const awayManager = game.a?.id == null ? "" : historicalManager13(game.a.id, game.s);
    const homeManager = historicalManager13(game.h.id, game.s);
    const quality = coverageLabel13(game.cov);
    const qualityClass = coverageClass13(game.cov);

    target.innerHTML = `
      <div class="box-hero-v13">
        <div class="box-hero-v13-top">
          <div><span class="badge">${game.s} · Week ${game.w}</span> <span class="badge">${esc13(stage13(game.pt))}</span> <span class="badge ${qualityClass}">${esc13(quality)}</span></div>
          <button type="button" class="game-share-v13" id="gameShareV130">Copy game link</button>
        </div>
        <div class="box-matchup-v13">
          <div class="box-team-v13"><strong>${esc13(game.h.n)}</strong><span>${esc13(homeManager)}</span></div>
          <div class="box-score-v13">${esc13(pts13(game.h.sc))}${game.a?.id==null?"":` - ${esc13(pts13(game.a.sc))}`}</div>
          <div class="box-team-v13"><strong>${esc13(awayName)}</strong><span>${esc13(awayManager)}</span></div>
        </div>
      </div>
      <div class="box-quality-v13">
        ${quality === "Full Box Score" ? "ESPN weekly lineup is score-validated and includes starters plus bench/IR; projections are shown when ESPN retained them." :
          quality === "Verified Starters" ? "The surviving ESPN weekly starters reconcile to the team score, but a trustworthy historical weekly bench was not retained." :
          quality === "Partial ESPN Data" ? "The matchup score is verified, but ESPN no longer exposes every historical scoring-player row for at least one side." :
          quality === "Playoff Bye" ? "This is a one-sided ESPN playoff bracket entry (bye), not a head-to-head game." :
          "The matchup itself is preserved, but ESPN player-level historical coverage is incomplete for this entry."}
      </div>
      <div class="box-sides-v13">
        ${sidePanel13(game,"home",game.h)}
        ${sidePanel13(game,"away",game.a)}
      </div>
    `;

    target.querySelector("#gameShareV130")?.addEventListener("click", async () => {
      setGameHash13(game.k);
      try {
        await navigator.clipboard.writeText(location.href);
        const b = target.querySelector("#gameShareV130");
        b.textContent = "Copied";
        setTimeout(()=>{ if(b) b.textContent="Copy game link"; },1200);
      } catch (_) {}
    });
  }

  const baseRecords13 = pages.records;
  pages.records = function () {
    baseRecords13();
    injectShell13();
  };

  installSidebarJump13();
  setTimeout(installSidebarJump13, 50);
})();
