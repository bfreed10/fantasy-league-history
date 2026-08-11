// LFL Season History Sort v11.1a
// Safe presentation-layer patch.
// Does not modify historical data or any existing analytics.
// Makes Season History columns sortable and adds a live sort rank.

window.LFL_SEASON_HISTORY_SORT_VERSION = "v11.1a";

(function () {
  const sortState = {
    key: "finish",
    direction: "asc"
  };

  const columns = [
    { key: "finish", label: "Finish", defaultDirection: "asc" },
    { key: "team", label: "Team / Manager", defaultDirection: "asc" },
    { key: "record", label: "Record", defaultDirection: "desc" },
    { key: "pf", label: "PF", defaultDirection: "desc" },
    { key: "pa", label: "PA", defaultDirection: "desc" },
    { key: "seed", label: "Seed", defaultDirection: "asc" }
  ];

  function num(value, fallback = null) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function teamLabel(row) {
    return `${cleanTeam(row["Team Name"])} ${canonicalOwner(row["Owner(s)"])}`.toLowerCase();
  }

  function compareNumbers(a, b, direction) {
    const av = a == null ? (direction === "asc" ? Infinity : -Infinity) : a;
    const bv = b == null ? (direction === "asc" ? Infinity : -Infinity) : b;
    return direction === "asc" ? av - bv : bv - av;
  }

  function compareText(a, b, direction) {
    const result = String(a || "").localeCompare(String(b || ""));
    return direction === "asc" ? result : -result;
  }

  function recordCompare(a, b, direction) {
    const aw = num(a.Wins, 0);
    const bw = num(b.Wins, 0);
    const at = num(a.Ties, 0);
    const bt = num(b.Ties, 0);
    const al = num(a.Losses, 0);
    const bl = num(b.Losses, 0);
    const apf = num(a["Points For"], 0);
    const bpf = num(b["Points For"], 0);

    let result =
      bw - aw ||
      bt - at ||
      al - bl ||
      bpf - apf;

    return direction === "desc" ? result : -result;
  }

  function sortRows(rows) {
    const key = sortState.key;
    const direction = sortState.direction;

    return rows.slice().sort((a, b) => {
      let result = 0;

      if (key === "finish") {
        result = compareNumbers(
          num(a["Final Rank"]),
          num(b["Final Rank"]),
          direction
        );
      } else if (key === "team") {
        result = compareText(teamLabel(a), teamLabel(b), direction);
      } else if (key === "record") {
        result = recordCompare(a, b, direction);
      } else if (key === "pf") {
        result = compareNumbers(
          num(a["Points For"]),
          num(b["Points For"]),
          direction
        );
      } else if (key === "pa") {
        result = compareNumbers(
          num(a["Points Against"]),
          num(b["Points Against"]),
          direction
        );
      } else if (key === "seed") {
        result = compareNumbers(
          num(a["Playoff Seed"]),
          num(b["Playoff Seed"]),
          direction
        );
      }

      if (result !== 0) return result;

      return (
        compareNumbers(
          num(a["Final Rank"]),
          num(b["Final Rank"]),
          "asc"
        ) ||
        compareNumbers(
          num(a["Team ID"]),
          num(b["Team ID"]),
          "asc"
        )
      );
    });
  }

  function arrowFor(column) {
    if (sortState.key !== column.key) return "&#8597;";
    return sortState.direction === "asc" ? "&#8593;" : "&#8595;";
  }

  function sortHeader(column) {
    const active = sortState.key === column.key;
    const directionText = active
      ? sortState.direction === "asc"
        ? "ascending"
        : "descending"
      : "not sorted";

    return `
      <th
        scope="col"
        aria-sort="${
          active
            ? sortState.direction === "asc"
              ? "ascending"
              : "descending"
            : "none"
        }">
        <button
          type="button"
          class="season-sort-button${active ? " active" : ""}"
          data-season-sort="${column.key}"
          aria-label="Sort ${esc(column.label)}; currently ${directionText}">
          <span>${esc(column.label)}</span>
          <span class="season-sort-arrow">${arrowFor(column)}</span>
        </button>
      </th>
    `;
  }

  function sortedLabel() {
    const column =
      columns.find(x => x.key === sortState.key) || columns[0];

    const direction =
      sortState.direction === "asc" ? "lowest to highest" : "highest to lowest";

    if (column.key === "team") {
      return sortState.direction === "asc"
        ? "Team / Manager A to Z"
        : "Team / Manager Z to A";
    }

    if (column.key === "finish" || column.key === "seed") {
      return `${column.label}: ${direction}`;
    }

    return `${column.label}: ${direction}`;
  }

  function renderSortableSeasonTable() {
    const seasonPick = $("#seasonPick");
    const target = $("#seasonTable");
    if (!seasonPick || !target) return;

    const year = Number(seasonPick.value);
    const seasonRows = (DATA?.teams || []).filter(
      row => Number(row.Season) === year
    );
    const rows = sortRows(seasonRows);

    const bodyRows = rows.map((row, index) => `
      <tr>
        <td><strong>${index + 1}</strong></td>
        <td>${esc(row["Final Rank"])}</td>
        <td>${displayFranchise(row["Team ID"], row["Team Name"], row["Owner(s)"])}</td>
        <td>${esc(row.Wins)}-${esc(row.Losses)}-${esc(row.Ties)}</td>
        <td>${fmt(row["Points For"], 2)}</td>
        <td>${fmt(row["Points Against"], 2)}</td>
        <td>${esc(row["Playoff Seed"])}</td>
      </tr>
    `);

    target.innerHTML = `
      <div class="card section-gap season-sort-card">
        <div class="card-heading-row">
          <div>
            <span class="section-eyebrow">INTERACTIVE STANDINGS</span>
            <h2>${esc(year)} Season</h2>
          </div>
          <span class="badge good">Sortable</span>
        </div>

        <p class="muted">
          Click any column heading to rank the season by that stat.
          Click the same heading again to reverse the order.
          <strong>Current sort: ${esc(sortedLabel())}.</strong>
        </p>

        <div class="table-wrap">
          <table class="table season-sort-table">
            <thead>
              <tr>
                <th scope="col">#</th>
                ${columns.map(sortHeader).join("")}
              </tr>
            </thead>
            <tbody>
              ${bodyRows.join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;

    target
      .querySelectorAll("[data-season-sort]")
      .forEach(button => {
        button.addEventListener("click", () => {
          const key = button.dataset.seasonSort;
          const column = columns.find(x => x.key === key);
          if (!column) return;

          if (sortState.key === key) {
            sortState.direction =
              sortState.direction === "asc" ? "desc" : "asc";
          } else {
            sortState.key = key;
            sortState.direction = column.defaultDirection;
          }

          renderSortableSeasonTable();
        });
      });
  }

  function injectStyle() {
    if ($("#seasonHistorySortStyleV111a")) return;

    const style = document.createElement("style");
    style.id = "seasonHistorySortStyleV111a";
    style.textContent = `
      .season-sort-button {
        appearance: none;
        border: 0;
        background: transparent;
        color: inherit;
        font: inherit;
        font-weight: inherit;
        padding: 0;
        margin: 0;
        width: 100%;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        text-align: left;
      }

      .season-sort-button:hover,
      .season-sort-button:focus-visible,
      .season-sort-button.active {
        text-decoration: underline;
        text-underline-offset: 3px;
      }

      .season-sort-arrow {
        opacity: .65;
        font-size: .9em;
      }

      .season-sort-button.active .season-sort-arrow {
        opacity: 1;
      }

      .season-sort-table td:first-child,
      .season-sort-table th:first-child {
        width: 44px;
        text-align: center;
      }
    `;

    document.head.appendChild(style);
  }

  pages.history = function () {
    injectStyle();

    setHeader(
      "Season History",
      "Standings and champions by year - click any stat to re-rank the season."
    );

    const years = [
      ...new Set((DATA?.teams || []).map(x => Number(x.Season)))
    ].sort((a, b) => b - a);

    $("#content").innerHTML = `
      <div class="controls">
        <label>
          Season
          <select id="seasonPick">
            ${years.map(y => `<option>${y}</option>`).join("")}
          </select>
        </label>
      </div>
      <div id="seasonTable"></div>
    `;

    $("#seasonPick").addEventListener(
      "change",
      renderSortableSeasonTable
    );

    renderSortableSeasonTable();
    setStatus("Sortable season history loaded", "good");
  };
})();
