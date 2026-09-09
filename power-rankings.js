const POWER_RANKINGS = [
  {
    season: 2026,
    week: 1,
    author: 'Ginger',
    title: 'Week 1 Power Rankings',
    file: '/power-rankings/2026/week-1-ginger.pdf'
  }
];

function renderPower(){
  setHeader(
    'Power Rankings',
    'Weekly league power rankings written by members of the LFL.'
  );

  const rankings=[...POWER_RANKINGS].sort(
    (a,b)=>b.season-a.season || b.week-a.week
  );

  if(!rankings.length){
    $('#content').innerHTML=`
      <div class="empty">
        No power rankings have been uploaded yet.
      </div>
    `;
    return;
  }

  const latest=rankings[0];

  $('#content').innerHTML=`
    <div class="hero">
      <span class="section-eyebrow">LFL POWER RANKINGS</span>
      <h2>${esc(latest.title)}</h2>
      <p>
        Written by <strong>${esc(latest.author)}</strong>
        • ${latest.season} Season
      </p>
    </div>

    <div class="card section-gap">
      <div class="controls">
        <label>
          Rankings
          <select id="powerRankingPick">
            ${rankings.map((r,i)=>`
              <option value="${i}">
                ${r.season} • Week ${r.week} • ${esc(r.author)}
              </option>
            `).join('')}
          </select>
        </label>
      </div>
    </div>

    <div id="powerRankingViewer" class="section-gap"></div>
  `;

  const drawRanking=()=>{
    const ranking=rankings[
      Number($('#powerRankingPick').value)||0
    ];

    $('#powerRankingViewer').innerHTML=`
      <div class="card">
        <div class="card-heading-row">
          <div>
            <span class="section-eyebrow">
              ${ranking.season} • WEEK ${ranking.week}
            </span>
            <h2>${esc(ranking.title)}</h2>
            <span class="muted">
              By ${esc(ranking.author)}
            </span>
          </div>

          <a
            href="${ranking.file}"
            target="_blank"
            rel="noopener"
          >
            Open PDF
          </a>
        </div>

        <div style="margin-top:16px">
          <iframe
            src="${ranking.file}"
            title="${esc(ranking.title)}"
            style="
              width:100%;
              height:80vh;
              min-height:700px;
              border:0;
              border-radius:12px;
              background:white;
            "
          ></iframe>
        </div>
      </div>
    `;
  };

  $('#powerRankingPick').addEventListener(
    'change',
    drawRanking
  );

  drawRanking();

  setStatus(
    `${rankings.length} power ranking${rankings.length===1?'':'s'} loaded`,
    'good'
  );
}

pages.power=renderPower;
