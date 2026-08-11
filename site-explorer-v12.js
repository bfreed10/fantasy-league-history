// LFL Navigation + Exploration Redesign v12.0
// Presentation-only information architecture upgrade.
// Does not modify historical data, analytics, franchise identity, or page calculations.
//
// Adds:
// - grouped sidebar navigation
// - universal Explore LFL search (Cmd/Ctrl+K or /)
// - contextual breadcrumbs + related quick jumps
// - shareable #page URLs + browser Back/Forward support
// - homepage exploration hub
// - smart player/season/manager search jumps into existing pages

window.LFL_SITE_EXPLORER_VERSION = "v12.0";

(function () {
  if (typeof pages === "undefined" || typeof navigate !== "function") return;

  const PAGE_META = {
    home:      { label: "Overview", section: "Home", icon: "H" },
    live:      { label: "Live 2026", section: "Home", icon: "L" },
    history:   { label: "Season History", section: "League History", icon: "S" },
    managers:  { label: "Teams & Managers", section: "League History", icon: "M" },
    records:   { label: "Records & Analytics", section: "Games & Records", icon: "R" },
    rivalries: { label: "Rivalries", section: "Games & Records", icon: "V" },
    draft:     { label: "Draft Lab", section: "Players", icon: "D" },
    injuries:  { label: "Injury Room", section: "Players", icon: "+" },
    trades:    { label: "Transactions & Trades", section: "Transactions", icon: "T" },
    rules:     { label: "League Rules", section: "More", icon: "?" },
    data:      { label: "Data Health", section: "More", icon: "OK" }
  };

  const NAV_GROUPS = [
    {
      section: "Home",
      items: [
        { page: "home", label: "Overview" },
        { page: "live", label: "Live 2026", live: true }
      ]
    },
    {
      section: "League History",
      items: [
        { page: "history", label: "Seasons" },
        { page: "managers", label: "Teams & Managers" }
      ]
    },
    {
      section: "Games & Records",
      items: [
        { page: "records", label: "Records & Analytics" },
        { page: "rivalries", label: "Rivalries" }
      ]
    },
    {
      section: "Players",
      items: [
        { jump: "player-records", label: "Player Records" },
        { page: "draft", label: "Draft Lab" },
        { page: "injuries", label: "Injury Room" }
      ]
    },
    {
      section: "Transactions",
      items: [
        { page: "trades", label: "Transactions & Trades" }
      ]
    },
    {
      section: "More",
      items: [
        { page: "rules", label: "League Rules" },
        { page: "data", label: "Data Health" }
      ]
    }
  ];

  const SECTION_LINKS = {
    Home: [
      { page: "home", label: "Overview" },
      { page: "live", label: "Live 2026" }
    ],
    "League History": [
      { page: "history", label: "Seasons" },
      { page: "managers", label: "Teams & Managers" }
    ],
    "Games & Records": [
      { page: "records", label: "Records" },
      { page: "rivalries", label: "Rivalries" },
      { jump: "player-records", label: "Player Records" }
    ],
    Players: [
      { jump: "player-records", label: "Player Records" },
      { page: "draft", label: "Draft Lab" },
      { page: "injuries", label: "Injury Room" }
    ],
    Transactions: [
      { page: "trades", label: "Transactions & Trades" }
    ],
    More: [
      { page: "rules", label: "League Rules" },
      { page: "data", label: "Data Health" }
    ]
  };

  const SEARCH_PAGES = [
    { page: "home", title: "League Overview", terms: "home overview champions trophy titles league" },
    { page: "live", title: "Live 2026", terms: "live current matchups scores 2026" },
    { page: "history", title: "Season History", terms: "season standings history champions playoffs year" },
    { page: "managers", title: "Teams & Managers", terms: "manager owner franchise team all time leaders" },
    { page: "records", title: "Records & Analytics", terms: "records scores streaks clutch pressure explorer player records" },
    { page: "rivalries", title: "Rivalries", terms: "rivalry head to head matchup opponent games" },
    { jump: "player-records", title: "Player Records", terms: "players highest season points fantasy player records" },
    { page: "draft", title: "Draft Lab", terms: "draft adp steals busts draft classes picks value" },
    { page: "injuries", title: "Injury Room", terms: "injury missed games health availability injured reserve" },
    { page: "trades", title: "Transactions & Trades", terms: "trades transactions adds drops waivers trade center" },
    { page: "rules", title: "League Rules", terms: "rules scoring settings divisions roster lineup" },
    { page: "data", title: "Data Health", terms: "data provenance coverage quality methodology health" },
    { page: "records", title: "Clutch & Pressure Analytics", terms: "clutch close games pressure playoffs winning teams" },
    { page: "records", title: "Records Explorer", terms: "explorer filter games margin score opponent stage" },
    { page: "records", title: "Streaks & Deeper Records", terms: "streak winning losing consecutive thresholds" }
  ];

  let searchOpen = false;
  let initialNavigationHandled = false;
  let searchIndexCache = null;
  let suppressHistory = false;

  function esc12(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function clean12(value) {
    return String(value == null ? "" : value).trim();
  }

  function num12(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function injectStyles() {
    if (document.querySelector("#lflExplorerV120Styles")) return;
    const style = document.createElement("style");
    style.id = "lflExplorerV120Styles";
    style.textContent = `
      /* LFL Navigation + Exploration v12 */
      .sidebar{overflow-y:auto}
      .lfl-nav-search{
        width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;
        margin:0 0 15px;padding:11px 12px;border:1px solid var(--border);border-radius:12px;
        background:#111a2d;color:var(--text);cursor:pointer;text-align:left
      }
      .lfl-nav-search:hover{background:#17223a;border-color:#3c5479}
      .lfl-nav-search span:first-child{font-weight:800}
      .lfl-key{
        font-size:10px;color:var(--muted);border:1px solid var(--border);border-radius:6px;
        padding:3px 6px;background:#0b1020;white-space:nowrap
      }
      #nav{display:block}
      .lfl-nav-section{margin:0 0 14px}
      .lfl-nav-label{
        padding:0 10px 6px;font-size:10px;letter-spacing:.13em;text-transform:uppercase;
        font-weight:900;color:#71809d
      }
      .lfl-nav-items{display:grid;gap:4px}
      #nav .lfl-nav-items button{
        width:100%;display:flex;align-items:center;gap:9px;border:0;background:transparent;
        color:var(--muted);padding:9px 11px;text-align:left;border-radius:10px;cursor:pointer
      }
      #nav .lfl-nav-items button:hover,#nav .lfl-nav-items button.active{
        background:var(--panel2);color:var(--text)
      }
      .lfl-nav-icon{width:17px;text-align:center;color:#8293b2;font-size:12px}
      #nav button.active .lfl-nav-icon{color:var(--accent)}
      .lfl-top-actions{display:flex;align-items:center;gap:9px;flex-wrap:wrap;justify-content:flex-end}
      .lfl-top-search{
        border:1px solid var(--border);background:#11182b;color:var(--text);padding:8px 11px;
        border-radius:999px;cursor:pointer;font-size:13px
      }
      .lfl-top-search:hover{border-color:#3c5479;background:#17223a}
      #lflContextBar{
        display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
        margin:0 34px 2px;padding:10px 0 12px;border-bottom:1px solid rgba(38,50,78,.7)
      }
      .lfl-breadcrumbs{display:flex;align-items:center;gap:7px;color:var(--muted);font-size:12px;flex-wrap:wrap}
      .lfl-breadcrumbs strong{color:var(--text)}
      .lfl-breadcrumb-sep{color:#586784}
      .lfl-context-links{display:flex;gap:7px;flex-wrap:wrap}
      .lfl-context-link{
        border:1px solid var(--border);background:#0d1426;color:var(--muted);padding:6px 9px;
        border-radius:9px;cursor:pointer;font-size:11px
      }
      .lfl-context-link:hover,.lfl-context-link.active{background:var(--panel2);color:var(--text);border-color:#3c5479}
      .lfl-home-explore{
        margin-bottom:18px;padding:18px;border:1px solid var(--border);border-radius:16px;background:#0f1729
      }
      .lfl-home-explore-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-end;margin-bottom:13px}
      .lfl-home-explore h2{margin:3px 0 0}
      .lfl-home-explore p{margin:0;color:var(--muted);font-size:13px}
      .lfl-explore-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}
      .lfl-explore-card{
        display:block;border:1px solid var(--border);border-radius:12px;padding:12px;background:#11182b;
        color:var(--text);cursor:pointer;text-align:left;min-height:86px
      }
      .lfl-explore-card:hover{border-color:#3c5479;background:#16223a;transform:translateY(-1px)}
      .lfl-explore-card strong{display:block;margin-bottom:5px;font-size:13px}
      .lfl-explore-card span{display:block;color:var(--muted);font-size:11px;line-height:1.35}
      #lflExploreOverlay{
        position:fixed;inset:0;z-index:10000;background:rgba(3,7,16,.78);backdrop-filter:blur(8px);
        display:none;padding:9vh 18px 30px;align-items:flex-start;justify-content:center
      }
      #lflExploreOverlay.open{display:flex}
      .lfl-search-shell{
        width:min(760px,100%);max-height:78vh;overflow:hidden;border:1px solid #354764;border-radius:18px;
        background:#0e1628;box-shadow:0 35px 100px rgba(0,0,0,.55)
      }
      .lfl-search-head{padding:16px;border-bottom:1px solid var(--border)}
      .lfl-search-title{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:10px}
      .lfl-search-title strong{font-size:15px}
      .lfl-search-title span{font-size:11px;color:var(--muted)}
      #lflExploreInput{
        width:100%;border:1px solid var(--border);background:#09101f;color:var(--text);
        border-radius:12px;padding:13px 14px;outline:none;font-size:16px
      }
      #lflExploreInput:focus{border-color:#4f82bc;box-shadow:0 0 0 3px rgba(90,168,255,.08)}
      #lflExploreResults{max-height:58vh;overflow:auto;padding:8px}
      .lfl-search-empty{padding:28px;text-align:center;color:var(--muted)}
      .lfl-search-result{
        width:100%;display:grid;grid-template-columns:auto 1fr auto;gap:11px;align-items:center;
        border:0;background:transparent;color:var(--text);padding:11px;border-radius:11px;cursor:pointer;text-align:left
      }
      .lfl-search-result:hover,.lfl-search-result.selected{background:#17223a}
      .lfl-result-type{
        min-width:62px;text-align:center;border:1px solid var(--border);border-radius:999px;
        padding:4px 7px;color:#9bb0d2;font-size:9px;font-weight:900;letter-spacing:.07em;text-transform:uppercase
      }
      .lfl-result-main strong{display:block;font-size:13px}
      .lfl-result-main span{display:block;color:var(--muted);font-size:11px;margin-top:3px;line-height:1.4}
      .lfl-result-arrow{color:#61708c;font-size:16px}
      .lfl-flash{animation:lflFlash 1.8s ease}
      @keyframes lflFlash{0%,100%{background:transparent}35%{background:rgba(90,168,255,.18)}}
      @media(max-width:1180px){.lfl-explore-grid{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:760px){
        .sidebar{padding-bottom:14px}
        .lfl-nav-section{margin-bottom:10px}
        .lfl-nav-items{grid-template-columns:repeat(2,minmax(0,1fr))}
        .lfl-nav-label{padding-top:5px}
        #lflContextBar{margin:0 18px 2px}
        .lfl-context-links{width:100%;overflow-x:auto;flex-wrap:nowrap;padding-bottom:3px}
        .lfl-context-link{white-space:nowrap}
        .lfl-top-actions{width:100%;justify-content:flex-start}
        .topbar{flex-wrap:wrap}
        .lfl-explore-grid{grid-template-columns:repeat(2,1fr)}
      }
      @media(max-width:470px){
        .lfl-nav-items{grid-template-columns:1fr 1fr}
        .lfl-explore-grid{grid-template-columns:1fr 1fr}
      }
    `;
    document.head.appendChild(style);
  }

  function rebuildSidebar() {
    const nav = document.querySelector("#nav");
    if (!nav) return;

    const searchButton = document.createElement("button");
    searchButton.type = "button";
    searchButton.className = "lfl-nav-search";
    searchButton.id = "lflNavSearch";
    searchButton.innerHTML = `<span>Search Explore LFL</span><span class="lfl-key">Cmd K</span>`;

    const brand = document.querySelector(".brand");
    if (brand && !document.querySelector("#lflNavSearch")) {
      brand.insertAdjacentElement("afterend", searchButton);
    }

    nav.innerHTML = NAV_GROUPS.map(group => `
      <div class="lfl-nav-section" data-section="${esc12(group.section)}">
        <div class="lfl-nav-label">${esc12(group.section)}</div>
        <div class="lfl-nav-items">
          ${group.items.map(item => {
            const meta = item.page ? PAGE_META[item.page] : null;
            const icon = item.jump === "player-records" ? "P" : (meta?.icon || "-");
            return `
              <button
                type="button"
                ${item.page ? `data-page="${esc12(item.page)}"` : ""}
                ${item.jump ? `data-jump="${esc12(item.jump)}"` : ""}
              >
                <span class="lfl-nav-icon">${esc12(icon)}</span>
                <span>${esc12(item.label)}${item.live ? ` <span class="live-dot"></span>` : ""}</span>
              </button>
            `;
          }).join("")}
        </div>
      </div>
    `).join("");

    nav.querySelectorAll("button[data-page]").forEach(button => {
      button.addEventListener("click", () => navigate(button.dataset.page));
    });

    nav.querySelectorAll("button[data-jump]").forEach(button => {
      button.addEventListener("click", () => runJump(button.dataset.jump));
    });

    searchButton.addEventListener("click", openSearch);
  }

  function enhanceTopbar() {
    const topbar = document.querySelector(".topbar");
    const status = document.querySelector("#statusPill");
    if (!topbar || !status || document.querySelector("#lflTopSearch")) return;

    const actions = document.createElement("div");
    actions.className = "lfl-top-actions";
    actions.innerHTML = `
      <button type="button" class="lfl-top-search" id="lflTopSearch">Search Explore LFL</button>
    `;

    status.insertAdjacentElement("beforebegin", actions);
    actions.appendChild(status);

    document.querySelector("#lflTopSearch")?.addEventListener("click", openSearch);

    const context = document.createElement("div");
    context.id = "lflContextBar";
    topbar.insertAdjacentElement("afterend", context);
  }

  function buildSearchOverlay() {
    if (document.querySelector("#lflExploreOverlay")) return;

    const overlay = document.createElement("div");
    overlay.id = "lflExploreOverlay";
    overlay.innerHTML = `
      <div class="lfl-search-shell" role="dialog" aria-modal="true" aria-label="Explore LFL">
        <div class="lfl-search-head">
          <div class="lfl-search-title">
            <strong>Explore LFL</strong>
            <span>Players - managers - teams - seasons - records - pages</span>
          </div>
          <input id="lflExploreInput" type="search" autocomplete="off"
            placeholder="Search Patrick Mahomes, Brandon Freedman, 2021, draft steals...">
        </div>
        <div id="lflExploreResults"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.addEventListener("mousedown", event => {
      if (event.target === overlay) closeSearch();
    });

    const input = document.querySelector("#lflExploreInput");
    input?.addEventListener("input", renderSearchResults);
    input?.addEventListener("keydown", handleSearchKeys);
  }

  function currentHashPage() {
    const raw = location.hash.replace(/^#/, "").split("?")[0];
    return raw && Object.prototype.hasOwnProperty.call(PAGE_META, raw) ? raw : null;
  }

  const baseNavigate = navigate;

  navigate = function (page, options = {}) {
    let target = page;

    if (!initialNavigationHandled) {
      initialNavigationHandled = true;
      const fromHash = currentHashPage();
      if (page === "home" && fromHash) target = fromHash;
    }

    if (!PAGE_META[target] || typeof pages[target] !== "function") target = "home";

    baseNavigate(target);
    updateContext(target);
    queueMicrotask(() => decoratePage(target));

    if (!options.fromHistory && !suppressHistory) {
      const desired = `#${target}`;
      if (location.hash !== desired) {
        if (options.replace || !location.hash) history.replaceState({ page: target }, "", desired);
        else history.pushState({ page: target }, "", desired);
      }
    }
  };

  window.addEventListener("popstate", () => {
    const target = currentHashPage() || "home";
    suppressHistory = true;
    try {
      baseNavigate(target);
      updateContext(target);
      queueMicrotask(() => decoratePage(target));
    } finally {
      suppressHistory = false;
    }
  });

  function updateContext(page) {
    const meta = PAGE_META[page] || PAGE_META.home;
    const bar = document.querySelector("#lflContextBar");
    if (!bar) return;

    const links = SECTION_LINKS[meta.section] || [];
    bar.innerHTML = `
      <div class="lfl-breadcrumbs">
        <span>LFL</span>
        <span class="lfl-breadcrumb-sep">/</span>
        <span>${esc12(meta.section)}</span>
        <span class="lfl-breadcrumb-sep">/</span>
        <strong>${esc12(meta.label)}</strong>
      </div>
      <div class="lfl-context-links">
        ${links.map(link => `
          <button
            type="button"
            class="lfl-context-link ${link.page === page ? "active" : ""}"
            ${link.page ? `data-context-page="${esc12(link.page)}"` : ""}
            ${link.jump ? `data-context-jump="${esc12(link.jump)}"` : ""}
          >${esc12(link.label)}</button>
        `).join("")}
      </div>
    `;

    bar.querySelectorAll("[data-context-page]").forEach(button => {
      button.addEventListener("click", () => navigate(button.dataset.contextPage));
    });
    bar.querySelectorAll("[data-context-jump]").forEach(button => {
      button.addEventListener("click", () => runJump(button.dataset.contextJump));
    });

    document.querySelectorAll("#nav button[data-page]").forEach(button => {
      button.classList.toggle("active", button.dataset.page === page);
    });
  }

  function decoratePage(page) {
    if (page === "home") addHomeExplore();
  }

  function addHomeExplore() {
    const content = document.querySelector("#content");
    if (!content || document.querySelector("#lflHomeExploreV120")) return;

    const hub = document.createElement("section");
    hub.id = "lflHomeExploreV120";
    hub.className = "lfl-home-explore";
    hub.innerHTML = `
      <div class="lfl-home-explore-head">
        <div>
          <span class="section-eyebrow">EXPLORE THE ARCHIVE</span>
          <h2>Where do you want to go?</h2>
        </div>
        <p>Search everything with CmdK</p>
      </div>
      <div class="lfl-explore-grid">
        <button class="lfl-explore-card" data-page="history">
          <strong>Seasons</strong><span>Standings, finishes, champions and year-by-year history.</span>
        </button>
        <button class="lfl-explore-card" data-page="managers">
          <strong>Teams & Managers</strong><span>Franchise records, manager histories and all-time leaders.</span>
        </button>
        <button class="lfl-explore-card" data-page="records">
          <strong>Games & Records</strong><span>Records, streaks, clutch analytics and game exploration.</span>
        </button>
        <button class="lfl-explore-card" data-jump="player-records">
          <strong>Players</strong><span>Player records, draft history and player-season production.</span>
        </button>
        <button class="lfl-explore-card" data-page="trades">
          <strong>Transactions</strong><span>Trades, adds, drops and historical transaction activity.</span>
        </button>
        <button class="lfl-explore-card" data-page="live">
          <strong>Live 2026</strong><span>Current season gateway and live matchup data.</span>
        </button>
      </div>
    `;

    const first = content.firstElementChild;
    if (first) first.insertAdjacentElement("afterend", hub);
    else content.prepend(hub);

    hub.querySelectorAll("[data-page]").forEach(button => {
      button.addEventListener("click", () => navigate(button.dataset.page));
    });
    hub.querySelectorAll("[data-jump]").forEach(button => {
      button.addEventListener("click", () => runJump(button.dataset.jump));
    });
  }

  function buildSearchIndex() {
    const out = [];

    for (const entry of SEARCH_PAGES) {
      out.push({
        type: "Page",
        title: entry.title,
        subtitle: entry.jump ? "Direct jump" : (PAGE_META[entry.page]?.section || "LFL"),
        terms: `${entry.title} ${entry.terms}`.toLowerCase(),
        action: () => entry.jump ? runJump(entry.jump) : navigate(entry.page)
      });
    }

    const seasons = new Set();
    for (const row of DATA?.teams || []) {
      const year = num12(row.Season);
      if (year) seasons.add(year);
    }
    for (const year of [...seasons].sort((a, b) => b - a)) {
      out.push({
        type: "Season",
        title: `${year} LFL Season`,
        subtitle: "Season History",
        terms: `${year} season standings playoffs champion history`,
        action: () => jumpToSeason(year)
      });
    }
    out.push({
      type: "Season",
      title: "2026 Live Season",
      subtitle: "Live 2026",
      terms: "2026 live current season matchups",
      action: () => navigate("live")
    });

    const franchises = new Map();
    for (const row of DATA?.teams || []) {
      const id = num12(row["Team ID"]);
      if (id == null) continue;
      if (!franchises.has(id)) {
        franchises.set(id, { id, teams: new Set(), owners: new Set(), seasons: [] });
      }
      const x = franchises.get(id);
      const team = clean12(row["Team Name"]);
      const owner = clean12(row["Owner(s)"]);
      if (team) x.teams.add(team);
      if (owner) x.owners.add(owner);
      const season = num12(row.Season);
      if (season) x.seasons.push(season);
    }

    for (const franchise of franchises.values()) {
      const teamNames = [...franchise.teams];
      const ownerNames = [...franchise.owners];
      const currentTeam = teamNames.at(-1) || `Team ${franchise.id}`;
      const currentOwner = ownerNames.at(-1) || "Manager";
      const first = franchise.seasons.length ? Math.min(...franchise.seasons) : "";
      const last = franchise.seasons.length ? Math.max(...franchise.seasons) : "";

      out.push({
        type: "Team",
        title: currentTeam,
        subtitle: `${currentOwner}${first ? ` - ${first}-${last}` : ""}`,
        terms: `${currentTeam} ${teamNames.join(" ")} ${ownerNames.join(" ")} team franchise manager owner`.toLowerCase(),
        action: () => jumpToManager(currentTeam, currentOwner)
      });
    }

    const players = new Map();

    function addPlayer(row) {
      const id = num12(row?.["Player ID"] ?? row?.PlayerId);
      const name = clean12(row?.["Player Name"] ?? row?.Player);
      if (!name) return;
      const key = id != null ? `id:${id}` : `name:${name.toLowerCase()}`;
      if (!players.has(key)) {
        players.set(key, { id, name, positions: new Set(), seasons: new Set() });
      }
      const p = players.get(key);
      p.name = name || p.name;
      const pos = clean12(row?.Position);
      if (pos) p.positions.add(pos);
      const season = num12(row?.Season);
      if (season) p.seasons.add(season);
    }

    for (const row of DATA?.draftAnalytics?.picks || []) addPlayer(row);
    for (const row of DATA?.rosters || []) addPlayer(row);
    for (const row of DATA?.injuryAnalytics?.players || []) addPlayer(row);

    for (const player of players.values()) {
      const seasonsArr = [...player.seasons].sort((a, b) => a - b);
      const pos = [...player.positions][0] || "Player";
      const span = seasonsArr.length
        ? (seasonsArr.length === 1 ? `${seasonsArr[0]}` : `${seasonsArr[0]}-${seasonsArr.at(-1)}`)
        : "LFL history";

      out.push({
        type: "Player",
        title: player.name,
        subtitle: `${pos} - ${span}`,
        terms: `${player.name} ${pos} player fantasy draft injury records`.toLowerCase(),
        action: () => jumpToPlayer(player.name)
      });
    }

    return out;
  }

  function getSearchIndex() {
    if (!searchIndexCache) searchIndexCache = buildSearchIndex();
    return searchIndexCache;
  }

  function scoreResult(item, query) {
    const q = query.toLowerCase();
    const title = item.title.toLowerCase();
    const terms = item.terms || "";

    if (title === q) return 1000;
    if (title.startsWith(q)) return 800;
    if (title.includes(q)) return 600;

    const words = q.split(/\s+/).filter(Boolean);
    let score = 0;
    for (const word of words) {
      if (title.includes(word)) score += 120;
      if (terms.includes(word)) score += 45;
    }
    return score;
  }

  function renderSearchResults() {
    const input = document.querySelector("#lflExploreInput");
    const target = document.querySelector("#lflExploreResults");
    if (!input || !target) return;

    const query = input.value.trim();
    const index = getSearchIndex();

    let results;
    if (!query) {
      results = index.filter(x => x.type === "Page").slice(0, 10);
    } else {
      results = index
        .map(item => ({ item, score: scoreResult(item, query) }))
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
        .slice(0, 14)
        .map(x => x.item);
    }

    if (!results.length) {
      target.innerHTML = `<div class="lfl-search-empty">No matching LFL results.</div>`;
      return;
    }

    target.innerHTML = results.map((item, i) => `
      <button type="button" class="lfl-search-result ${i === 0 ? "selected" : ""}" data-result-index="${i}">
        <span class="lfl-result-type">${esc12(item.type)}</span>
        <span class="lfl-result-main">
          <strong>${esc12(item.title)}</strong>
          <span>${esc12(item.subtitle || "")}</span>
        </span>
        <span class="lfl-result-arrow">></span>
      </button>
    `).join("");

    target.querySelectorAll("[data-result-index]").forEach(button => {
      button.addEventListener("click", () => {
        const item = results[Number(button.dataset.resultIndex)];
        closeSearch();
        item?.action?.();
      });
    });

    target._lflResults = results;
  }

  function handleSearchKeys(event) {
    const target = document.querySelector("#lflExploreResults");
    const buttons = [...(target?.querySelectorAll(".lfl-search-result") || [])];
    if (!buttons.length && event.key !== "Escape") return;

    let selected = buttons.findIndex(x => x.classList.contains("selected"));
    if (selected < 0) selected = 0;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      buttons[selected]?.classList.remove("selected");
      selected = (selected + 1) % buttons.length;
      buttons[selected]?.classList.add("selected");
      buttons[selected]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      buttons[selected]?.classList.remove("selected");
      selected = (selected - 1 + buttons.length) % buttons.length;
      buttons[selected]?.classList.add("selected");
      buttons[selected]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      buttons[selected]?.click();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeSearch();
    }
  }

  function openSearch() {
    buildSearchOverlay();
    const overlay = document.querySelector("#lflExploreOverlay");
    const input = document.querySelector("#lflExploreInput");
    if (!overlay || !input) return;
    searchOpen = true;
    overlay.classList.add("open");
    input.value = "";
    renderSearchResults();
    setTimeout(() => input.focus(), 0);
  }

  function closeSearch() {
    searchOpen = false;
    document.querySelector("#lflExploreOverlay")?.classList.remove("open");
  }

  document.addEventListener("keydown", event => {
    const activeTag = document.activeElement?.tagName;
    const editing =
      activeTag === "INPUT" ||
      activeTag === "TEXTAREA" ||
      activeTag === "SELECT" ||
      document.activeElement?.isContentEditable;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      searchOpen ? closeSearch() : openSearch();
      return;
    }

    if (event.key === "/" && !editing && !searchOpen) {
      event.preventDefault();
      openSearch();
      return;
    }

    if (event.key === "Escape" && searchOpen) {
      closeSearch();
    }
  });

  function runJump(jump) {
    if (jump === "player-records") jumpToPlayerRecords();
  }

  function jumpToPlayerRecords(playerName = "") {
    navigate("records");
    setTimeout(() => {
      const input = document.querySelector("#playerRecordSearchV112");
      if (input) {
        if (playerName) {
          input.value = playerName;
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        const anchor =
          document.querySelector("#playerRecordControlsV112") ||
          [...document.querySelectorAll("#content h3, #content h2")]
            .find(x => /player/i.test(x.textContent || ""));
        anchor?.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }

      const fallback =
        [...document.querySelectorAll("#content h2, #content h3")]
          .find(x => /player record|player single-season/i.test(x.textContent || ""));
      fallback?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  function jumpToPlayer(playerName) {
    navigate("records");
    setTimeout(() => {
      const input = document.querySelector("#playerRecordSearchV112");
      if (input) {
        input.value = playerName;
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      navigate("draft");
      setTimeout(() => {
        const allButton = document.querySelector('#draftTabs button[data-tab="all"]');
        allButton?.click();
        const draftSearch = document.querySelector("#draftSearch");
        if (draftSearch) {
          draftSearch.value = playerName;
          draftSearch.dispatchEvent(new Event("input", { bubbles: true }));
          draftSearch.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 30);
    }, 40);
  }

  function jumpToSeason(year) {
    navigate("history");
    setTimeout(() => {
      const select =
        document.querySelector("#seasonPick") ||
        [...document.querySelectorAll("#content select")]
          .find(x => [...x.options].some(o => Number(o.value || o.textContent) === Number(year)));

      if (select) {
        select.value = String(year);
        select.dispatchEvent(new Event("change", { bubbles: true }));
        select.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 40);
  }

  function jumpToManager(team, owner) {
    navigate("managers");
    setTimeout(() => {
      const needle = team || owner;
      if (!needle) return;
      flashFirstText(needle);
    }, 50);
  }

  function flashFirstText(needle) {
    const lower = needle.toLowerCase();
    const candidates = [...document.querySelectorAll("#content td, #content .card, #content .feature")];
    const node = candidates.find(x => (x.textContent || "").toLowerCase().includes(lower));
    if (!node) return;
    node.classList.add("lfl-flash");
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => node.classList.remove("lfl-flash"), 1900);
  }

  // Wrap pages so the context layer stays synchronized even when a page is invoked
  // through an existing site control instead of the sidebar.
  for (const [page, renderer] of Object.entries({ ...pages })) {
    if (typeof renderer !== "function") continue;
    pages[page] = function (...args) {
      const result = renderer.apply(this, args);
      queueMicrotask(() => {
        updateContext(page);
        decoratePage(page);
      });
      return result;
    };
  }

  injectStyles();
  rebuildSidebar();
  enhanceTopbar();
  buildSearchOverlay();

  // If the app already rendered before this script finished loading, synchronize now.
  setTimeout(() => {
    const page = (typeof currentPage !== "undefined" && PAGE_META[currentPage])
      ? currentPage
      : (currentHashPage() || "home");
    updateContext(page);
    decoratePage(page);
  }, 0);
})();
