
let DATA=null;
let currentPage='home';
let liveTimer=null;

const $ = s => document.querySelector(s);
const fmt = (n,d=0) => n==null?'—':Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const pct = n => n==null?'—':(Number(n)*100).toFixed(1)+'%';
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ownerLabel = o => o || 'Unknown';
const signed = (n,d=1) => n==null?'—':`${Number(n)>=0?'+':''}${Number(n).toFixed(d)}`;
const valueTone = n => n==null?'':Number(n)>=35?'good':Number(n)<=-35?'bad':'';
const gradeTone = g => String(g||'').startsWith('A')?'good':String(g||'').startsWith('F')||String(g||'').startsWith('D')?'bad':String(g||'').startsWith('C')?'warn':'';

function metric(label,value,detail=''){
  return `<div class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong>${detail?`<span class="muted">${esc(detail)}</span>`:''}</div>`;
}
function table(headers, rows){
  return `<div class="table-wrap"><table class="table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}
function setHeader(title,subtitle){
  $('#pageTitle').textContent=title; $('#pageSubtitle').textContent=subtitle;
}
function setStatus(text,cls=''){
  const el=$('#statusPill'); el.textContent=text; el.className='pill '+cls;
}
function topManager(){
  return [...DATA.managers].sort((a,b)=>b.championships-a.championships||b.wins-a.wins)[0];
}

function renderHome(){
  setHeader('League Overview','13 seasons of history with live 2026 support.');
  const tm=topManager(), bestScore=DATA.records.highestScores[0], lastChamp=DATA.champions.at(-1);
  $('#content').innerHTML=`
    <div class="hero"><h2>Your league, from 2013 to now.</h2><p>Historical standings, every saved matchup, manager records, rivalries, draft data, and a live ESPN scoreboard. Draft-value, trade-grade and injury modules are built into the site architecture and report their coverage instead of guessing when source data is incomplete.</p></div>
    <div class="metrics">
      ${metric('Historical seasons','13','2013–2025')}
      ${metric('Saved matchups',fmt(DATA.meta.matchups),'regular season + playoffs')}
      ${metric('Most titles',tm?tm.championships:'—',tm?tm.owner:'')}
      ${metric('Record weekly score',bestScore?fmt(bestScore.highScore,2):'—',bestScore?`${bestScore.season} Week ${bestScore.week}`:'')}
    </div>
    <div class="grid-2">
      <div class="card"><h2>Championship Timeline</h2><div class="champion-list">
        ${[...DATA.champions].reverse().map(c=>`<div class="champion"><div class="year">${c.season}</div><div><strong>${esc(c.team)}</strong><div class="muted">${esc(c.owner)}</div></div><span class="badge">${c.wins}-${c.losses}</span></div>`).join('')}
      </div></div>
      <div class="card"><h2>All-Time Leaders</h2>
        ${DATA.managers.slice(0,8).map((m,i)=>`<div class="bar-row"><span>${i+1}. ${esc(m.owner)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,m.wins/Math.max(...DATA.managers.map(x=>x.wins))*100)}%"></div></div><strong>${m.wins} W</strong></div>`).join('')}
      </div>
    </div>`;
  setStatus('Historical data loaded','good');
}

async function renderLive(){
  setHeader('Live 2026','Current standings, rosters, matchups, transactions and injuries from ESPN.');
  $('#content').innerHTML=`<div class="hero"><h2>Live League Command Center</h2><p>The browser only calls your Vercel server function. ESPN credentials remain server-side and are never returned to visitors.</p></div><div id="liveArea" class="empty">Connecting to ESPN…</div>`;
  await refreshLive();
  clearInterval(liveTimer); liveTimer=setInterval(refreshLive,30000);
}
async function refreshLive(){
  try{
    const r=await fetch('/api/live');
    const d=await r.json();
    if(!r.ok||d.error) throw new Error(d.error||`HTTP ${r.status}`);
    setStatus(`Live • Week ${d.currentWeek||'—'}`,'good');
    const matchupCards=(d.matchups||[]).map(m=>`<div class="matchup-card">
      <div class="teamrow"><span><strong>${esc(m.awayTeam||'TBD')}</strong><br><small class="muted">${esc(m.awayOwner||'')}</small></span><strong>${fmt(m.awayScore,2)}</strong></div>
      <div class="teamrow"><span><strong>${esc(m.homeTeam||'TBD')}</strong><br><small class="muted">${esc(m.homeOwner||'')}</small></span><strong>${fmt(m.homeScore,2)}</strong></div>
      <div class="matchup-meta">Week ${esc(m.week)} • Updated ${new Date(d.updatedAt).toLocaleTimeString()}</div>
    </div>`).join('');
    const standingRows=(d.standings||[]).map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.team)}</strong><br><span class="muted">${esc(x.owner||'')}</span></td><td>${x.wins}-${x.losses}-${x.ties}</td><td>${fmt(x.pointsFor,1)}</td><td>${fmt(x.pointsAgainst,1)}</td><td>${fmt(x.powerScore,1)}</td></tr>`);
    const injuryRows=(d.injuries||[]).slice(0,40).map(x=>`<tr><td><strong>${esc(x.player)}</strong></td><td>${esc(x.position||'')}</td><td>${esc(x.team||'')}</td><td><span class="badge warn">${esc(x.status||'')}</span></td></tr>`);
    const txRows=(d.transactions||[]).slice(0,40).map(x=>`<tr><td>${x.date?new Date(x.date).toLocaleDateString():'—'}</td><td><strong>${esc(x.team||'League')}</strong></td><td>${esc(x.type||'')}</td><td>${esc((x.items||[]).map(i=>`${i.action||i.type||''} ${i.player||''}`).join(' • '))}</td></tr>`);
    const rosterTeams=d.rosters||[];
    const rosterOptions=rosterTeams.map((t,i)=>`<option value="${i}">${esc(t.team)}</option>`).join('');
    $('#liveArea').className='';
    $('#liveArea').innerHTML=`
      <div class="metrics">
        ${metric('Current week',d.currentWeek||'—')}
        ${metric('Teams',(d.standings||[]).length||'—')}
        ${metric('Recent transactions',(d.transactions||[]).length,'ESPN activity')}
        ${metric('Current injuries',(d.injuries||[]).length,'non-active roster statuses')}
      </div>
      <div class="card"><h2>Live Matchups</h2><div class="scoreboard">${matchupCards||'<div class="empty">No current-week matchups returned yet.</div>'}</div></div>
      <div class="grid-2 section-gap">
        <div class="card"><h2>Current Standings + Power Score</h2>${standingRows.length?table(['#','Team / Manager','Record','PF','PA','Power'],standingRows):'<div class="empty">Standings not available yet.</div>'}</div>
        <div class="card"><h2>Current Injuries</h2>${injuryRows.length?table(['Player','Pos','Team','Status'],injuryRows):'<div class="empty">No injured roster players returned.</div>'}</div>
      </div>
      <div class="grid-2 section-gap">
        <div class="card"><h2>Recent League Activity</h2>${txRows.length?table(['Date','Team','Type','Players'],txRows):'<div class="empty">No recent transactions returned.</div>'}</div>
        <div class="card"><h2>Current Rosters</h2>${rosterTeams.length?`<div class="controls"><select id="liveRosterPick">${rosterOptions}</select></div><div id="liveRosterTable"></div>`:'<div class="empty">Rosters not available.</div>'}</div>
      </div>`;
    if(rosterTeams.length){
      const drawRoster=()=>{const t=rosterTeams[Number($('#liveRosterPick').value)||0]; $('#liveRosterTable').innerHTML=table(['Slot','Player','Pos','Status'],(t.players||[]).map(p=>`<tr><td>${esc(p.slot||'')}</td><td><strong>${esc(p.player||'')}</strong></td><td>${esc(p.position||'')}</td><td>${p.injuryStatus&&p.injuryStatus!=='ACTIVE'?`<span class="badge warn">${esc(p.injuryStatus)}</span>`:'Active'}</td></tr>`));};
      $('#liveRosterPick').addEventListener('change',drawRoster); drawRoster();
    }
  }catch(e){
    setStatus('Live connection needs setup','warn');
    $('#liveArea').className='empty';
    $('#liveArea').innerHTML=`<strong>Live ESPN connection isn't active.</strong><br><br>${esc(e.message)}<br><br><span class="muted">Check ESPN_S2 and SWID in Vercel Environment Variables, then redeploy.</span>`;
  }
}

function renderHistory(){
  setHeader('Season History','Standings and champions by year.');
  const years=[...new Set(DATA.teams.map(x=>x.Season))].sort((a,b)=>b-a);
  $('#content').innerHTML=`<div class="controls"><label>Season <select id="seasonPick">${years.map(y=>`<option>${y}</option>`).join('')}</select></label></div><div id="seasonTable"></div>`;
  $('#seasonPick').addEventListener('change',renderSeasonTable); renderSeasonTable();
}
function renderSeasonTable(){
  const y=Number($('#seasonPick').value);
  const rows=DATA.teams.filter(x=>Number(x.Season)===y).sort((a,b)=>(a['Final Rank']??99)-(b['Final Rank']??99)).map(x=>`<tr><td>${esc(x['Final Rank'])}</td><td><strong>${esc(x['Team Name'])}</strong><br><span class="muted">${esc(x['Owner(s)'])}</span></td><td>${esc(x.Wins)}-${esc(x.Losses)}-${esc(x.Ties)}</td><td>${fmt(x['Points For'],2)}</td><td>${fmt(x['Points Against'],2)}</td><td>${esc(x['Playoff Seed'])}</td></tr>`);
  $('#seasonTable').innerHTML=table(['Finish','Team / Manager','Record','PF','PA','Seed'],rows);
}

function renderManagers(){
  setHeader('Managers','Career standings across every saved season.');
  const rows=DATA.managers.map((m,i)=>`<tr><td>${i+1}</td><td><strong>${esc(m.owner)}</strong></td><td>${m.seasons}</td><td>${m.championships}</td><td>${m.wins}-${m.losses}-${m.ties}</td><td>${pct(m.winPct)}</td><td>${fmt(m.pointsFor,2)}</td><td>${fmt(m.avgPointsPerSeason,1)}</td></tr>`);
  $('#content').innerHTML=`<div class="card"><h2>All-Time Manager Table</h2>${table(['#','Manager','Seasons','Titles','W-L-T','Win %','Points For','PF / Season'],rows)}</div><p class="muted">Manager aliases are currently kept exactly as ESPN stored them. If one person used multiple ESPN identities, they are intentionally not merged automatically.</p>`;
  setStatus(`${DATA.managers.length} manager identities`);
}

function renderRivalries(){
  setHeader('Rivalries','Head-to-head records between managers.');
  const rows=DATA.rivalries.slice(0,100).map(r=>`<tr><td><strong>${esc(r.a)}</strong> vs <strong>${esc(r.b)}</strong></td><td>${r.games}</td><td>${r.aWins}-${r.bWins}-${r.ties}</td><td>${fmt(r.aPoints,2)} – ${fmt(r.bPoints,2)}</td></tr>`);
  $('#content').innerHTML=`<div class="card"><h2>Most-Played Rivalries</h2>${table(['Matchup','Games','Record (left-right-ties)','Total Points'],rows)}</div>`;
}

function recordRows(items,type){
  return items.map(g=>{
    const score=`${fmt(g.awayScore,2)} – ${fmt(g.homeScore,2)}`;
    const value=type==='score'?fmt(g.highScore,2):fmt(g.margin,2);
    return `<tr><td><strong>${value}</strong></td><td>${g.season} W${g.week}</td><td>${esc(g.awayTeam)} @ ${esc(g.homeTeam)}</td><td>${score}</td></tr>`;
  });
}
function renderRecords(){
  setHeader('League Records','Best, worst, closest and most ridiculous results.');
  const high=recordRows(DATA.records.highestScores.slice(0,15),'score');
  const blow=recordRows(DATA.records.biggestBlowouts.slice(0,15),'margin');
  const close=recordRows(DATA.records.closestGames.slice(0,15),'margin');
  $('#content').innerHTML=`<div class="grid-3">
    <div class="card"><h3>Highest Scores</h3>${table(['Score','When','Matchup','Final'],high)}</div>
    <div class="card"><h3>Biggest Blowouts</h3>${table(['Margin','When','Matchup','Final'],blow)}</div>
    <div class="card"><h3>Closest Games</h3>${table(['Margin','When','Matchup','Final'],close)}</div>
  </div>`;
}

function renderDraft(){
  setHeader('Draft Lab','Real draft-value analytics across 2013–2025.');
  const A=DATA.draftAnalytics||{};
  if(!A.topSteals){ $('#content').innerHTML='<div class="empty">Draft analytics have not been built yet.</div>'; return; }
  const years=[...new Set((A.classes||[]).map(x=>x.Season))].sort((a,b)=>b-a);
  const top=A.topSteals[0], best=A.bestClasses?.[0];
  $('#content').innerHTML=`
    <div class="metrics">
      ${metric('Draft picks',fmt(A.totalPicks||DATA.meta.draftPicks))}
      ${metric('Graded picks',fmt(A.gradedPicks),`${A.coveragePct}% current coverage`)}
      ${metric('Biggest steal',top?top['Player Name']:'—',top?`${top.Season} • Pick ${top['Overall Pick']} • ${signed(top.ValueAboveSlot)} pts`: '')}
      ${metric('Best class',best?best.Grade:'—',best?`${best.Season} • ${best.TeamName||best['Team Name']||best.Owner}`:'')}
    </div>
    <div class="hero"><h2>How Draft Value works</h2><p><strong>Slot Value = actual season fantasy points − historical expected points at that overall pick.</strong> Expected points are estimated from nearby draft slots across other seasons. This v1 model grades only picks with a saved ESPN season-point total; the next enrichment pass will fill the remaining missing totals and add injury-adjusted grades.</p></div>
    <div class="tabs" id="draftTabs">
      <button class="active" data-tab="steals">Steals & Busts</button><button data-tab="classes">Draft Classes</button><button data-tab="managers">Manager Careers</button><button data-tab="positions">Position / Round Value</button><button data-tab="all">All Picks</button>
    </div><div id="draftPanel"></div>`;
  const panel=$('#draftPanel');
  const stealRows=(A.topSteals||[]).slice(0,25).map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x['Player Name'])}</strong><br><span class="muted">${x.Season} • Pick ${x['Overall Pick']} • ${esc(x.Position||'')}</span></td><td>${fmt(x.ActualPoints,1)}</td><td>${fmt(x.ExpectedSlotPoints,1)}</td><td class="good"><strong>${signed(x.ValueAboveSlot)}</strong></td><td>${esc(x['Owner(s)']||x['Team Name'])}</td></tr>`);
  const bustRows=(A.topBusts||[]).slice(0,25).map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x['Player Name'])}</strong><br><span class="muted">${x.Season} • Pick ${x['Overall Pick']} • ${esc(x.Position||'')}</span></td><td>${fmt(x.ActualPoints,1)}</td><td>${fmt(x.ExpectedSlotPoints,1)}</td><td class="bad"><strong>${signed(x.ValueAboveSlot)}</strong></td><td>${esc(x['Owner(s)']||x['Team Name'])}</td></tr>`);
  const renderTab=tab=>{
    document.querySelectorAll('#draftTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    if(tab==='steals') panel.innerHTML=`<div class="grid-2"><div class="card"><h2>Biggest Steals</h2>${table(['#','Player','Actual','Expected','Value','Manager'],stealRows)}</div><div class="card"><h2>Biggest Busts</h2>${table(['#','Player','Actual','Expected','Value','Manager'],bustRows)}</div></div>`;
    if(tab==='classes'){
      panel.innerHTML=`<div class="controls"><label>Season <select id="classSeason">${years.map(y=>`<option>${y}</option>`).join('')}</select></label></div><div id="classTable"></div><div class="grid-2 section-gap"><div class="card"><h2>Best Classes Ever</h2>${table(['Year','Grade','Team / Manager','Avg Value','Total Value','Coverage'],(A.bestClasses||[]).slice(0,20).map(x=>`<tr><td>${x.Season}</td><td><span class="badge ${gradeTone(x.Grade)}">${esc(x.Grade)}</span></td><td><strong>${esc(x['Team Name'])}</strong><br><span class="muted">${esc(x.Owner)}</span></td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${fmt(x.CoveragePct,1)}%</td></tr>`))}</div><div class="card"><h2>Worst Classes Ever</h2>${table(['Year','Grade','Team / Manager','Avg Value','Total Value','Coverage'],(A.worstClasses||[]).slice(0,20).map(x=>`<tr><td>${x.Season}</td><td><span class="badge ${gradeTone(x.Grade)}">${esc(x.Grade)}</span></td><td><strong>${esc(x['Team Name'])}</strong><br><span class="muted">${esc(x.Owner)}</span></td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${fmt(x.CoveragePct,1)}%</td></tr>`))}</div></div>`;
      const draw=()=>{const y=Number($('#classSeason').value);const rows=(A.classes||[]).filter(x=>Number(x.Season)===y).sort((a,b)=>b.RawScore-a.RawScore).map((x,i)=>`<tr><td>${i+1}</td><td><span class="badge ${gradeTone(x.Grade)}"><strong>${esc(x.Grade)}</strong></span></td><td><strong>${esc(x['Team Name'])}</strong><br><span class="muted">${esc(x.Owner)}</span></td><td>${x['Graded Picks']}/${x.Picks}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${fmt(x.HitRatePct,1)}%</td><td>${fmt(x.BustRatePct,1)}%</td></tr>`);$('#classTable').innerHTML=table(['#','Grade','Team / Manager','Graded','Avg Value','Total Value','Steal %','Bust %'],rows);};$('#classSeason').addEventListener('change',draw);draw();
    }
    if(tab==='managers') panel.innerHTML=`<div class="card"><h2>Career Draft Performance</h2>${table(['#','Manager','Seasons','Graded Picks','Value / Pick','Total Value','A-range Classes'],(A.managerCareer||[]).map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.Owner)}</strong></td><td>${x.Seasons}</td><td>${x.GradedPicks}</td><td class="${valueTone(x.AvgValuePerPick)}"><strong>${signed(x.AvgValuePerPick)}</strong></td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${x.AorBetter}</td></tr>`))}</div>`;
    if(tab==='positions') panel.innerHTML=`<div class="grid-2"><div class="card"><h2>Value by Position</h2><p class="muted">Compared against the historical expectation for the same position and round.</p>${table(['Position','Picks','Actual','Expected','Value','Steal %','Bust %'],(A.positionValue||[]).map(x=>`<tr><td><strong>${esc(x.Position)}</strong></td><td>${x.Picks}</td><td>${fmt(x.AvgActual,1)}</td><td>${fmt(x.AvgExpected,1)}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td>${fmt(x.HitRatePct,1)}%</td><td>${fmt(x.BustRatePct,1)}%</td></tr>`))}</div><div class="card"><h2>Value by Round</h2>${table(['Round','Picks','Actual','Expected','Value','Steal %','Bust %'],(A.roundValue||[]).map(x=>`<tr><td><strong>${x.Round}</strong></td><td>${x.Picks}</td><td>${fmt(x.AvgActual,1)}</td><td>${fmt(x.AvgExpected,1)}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td>${fmt(x.HitRatePct,1)}%</td><td>${fmt(x.BustRatePct,1)}%</td></tr>`))}</div></div>`;
    if(tab==='all'){
      panel.innerHTML=`<div class="controls"><input id="draftSearch" placeholder="Search player, manager or team"><select id="draftSeason"><option value="">All seasons</option>${years.map(y=>`<option>${y}</option>`).join('')}</select><select id="draftPos"><option value="">All positions</option>${[...new Set((A.picks||[]).map(x=>x.Position).filter(Boolean))].sort().map(p=>`<option>${p}</option>`).join('')}</select></div><div id="draftTable"></div>`;
      const draw=()=>{const q=$('#draftSearch').value.toLowerCase(),sy=$('#draftSeason').value,pos=$('#draftPos').value;const xs=(A.picks||[]).filter(x=>(!sy||String(x.Season)===sy)&&(!pos||x.Position===pos)&&(!q||JSON.stringify(x).toLowerCase().includes(q))).sort((a,b)=>Number(b.Season)-Number(a.Season)||Number(a['Overall Pick'])-Number(b['Overall Pick'])).slice(0,600);$('#draftTable').innerHTML=table(['Year','Pick','Rnd','Player','Pos','Manager / Team','Actual','Expected','Value'],xs.map(x=>`<tr><td>${x.Season}</td><td>${x['Overall Pick']}</td><td>${x.Round}</td><td><strong>${esc(x['Player Name']||'Unknown')}</strong></td><td>${esc(x.Position||'')}</td><td>${esc(x['Owner(s)']||x['Team Name'])}</td><td>${fmt(x.ActualPoints,1)}</td><td>${fmt(x.ExpectedSlotPoints,1)}</td><td class="${valueTone(x.ValueAboveSlot)}"><strong>${signed(x.ValueAboveSlot)}</strong></td></tr>`));};$('#draftSearch').addEventListener('input',draw);$('#draftSeason').addEventListener('change',draw);$('#draftPos').addEventListener('change',draw);draw();
    }
  };
  document.querySelectorAll('#draftTabs button').forEach(b=>b.addEventListener('click',()=>renderTab(b.dataset.tab))); renderTab('steals');
}

function renderTrades(){
  setHeader('Trade Center','Every trade, date-aware rest-of-season value, fleeces and manager records.');
  const A=DATA.tradeAnalytics||{}, trades=A.trades||[];
  if(!trades.length){
    $('#content').innerHTML=`<div class="hero"><h2>Historical trade pull is the next local-data step.</h2><p>The website is ready to score trades, but your current archive did not include individual historical trade packages. The local enrichment tool will use ESPN's <code>mTransactions2</code> transaction view for each scoring period, then calculate each player's actual rest-of-season production after the trade.</p></div><div class="grid-2"><div class="card"><h2>What will appear here</h2><div class="feature-list"><div class="feature"><strong>Every Historical Trade</strong><span class="muted">Date, teams, players and draft picks where available.</span></div><div class="feature"><strong>Biggest Fleeces</strong><span class="muted">Largest realized rest-of-season value gap.</span></div><div class="feature"><strong>Balanced Trades</strong><span class="muted">Deals with the smallest value difference.</span></div><div class="feature"><strong>Manager Trade Records</strong><span class="muted">Career wins, losses and net realized value.</span></div></div></div><div class="card"><h2>Status</h2><p><span class="badge warn">Run local trade enrichment</span></p><p class="muted">No trade ranking is shown until the actual packages are recovered from ESPN. This avoids inventing or misattributing trades.</p></div></div>`;return;
  }
  const fleece=(A.biggestFleeces||[]).slice(0,20), balanced=(A.mostBalanced||[]).slice(0,20);
  const tr=x=>`<tr><td>${x.Season} W${x.Week}</td><td><strong>${esc(x.TeamA)}</strong><br>${esc((x.TeamAPlayers||[]).join(', '))}</td><td><strong>${esc(x.TeamB)}</strong><br>${esc((x.TeamBPlayers||[]).join(', '))}</td><td class="${valueTone(x.ValueGap)}">${signed(x.ValueGap)}</td></tr>`;
  $('#content').innerHTML=`<div class="metrics">${metric('Historical trades',trades.length)}${metric('Biggest value gap',fleece[0]?signed(fleece[0].ValueGap):'—')}${metric('Managers graded',(A.managerCareer||[]).length)}${metric('Model','ROS realized value','expected model follows')}</div><div class="grid-2"><div class="card"><h2>Biggest Fleeces</h2>${table(['When','Side A','Side B','Value Gap'],fleece.map(tr))}</div><div class="card"><h2>Most Balanced</h2>${table(['When','Side A','Side B','Value Gap'],balanced.map(tr))}</div></div><div class="card section-gap"><h2>Trade Timeline</h2>${table(['When','Side A','Side B','Value Gap'],trades.slice().sort((a,b)=>b.Timestamp-a.Timestamp).map(tr))}</div>`;
}

function renderInjuries(){
  setHeader('Injury Room','Games missed, reported injury weeks and injury-adjusted draft value.');
  const A=DATA.injuryAnalytics||{}, players=A.players||[];
  if(!players.length){
    $('#content').innerHTML=`<div class="hero"><h2>Next: distinguish bad picks from bad injury luck.</h2><p>The enrichment tool joins your ESPN player IDs to nflverse's player-ID map and injury reports. nflverse injury data is available back to 2009, so it covers the full 2013–2025 history.</p></div><div class="grid-3"><div class="card"><h3>Most Games Missed</h3><p class="muted">Drafted players with the most reported injury absences.</p><span class="badge warn">Enrichment pending</span></div><div class="card"><h3>Injury Busts</h3><p class="muted">Negative draft value where availability explains a large share of the loss.</p><span class="badge warn">Enrichment pending</span></div><div class="card"><h3>Iron Men</h3><p class="muted">High-value picks with strong season-long availability.</p><span class="badge warn">Enrichment pending</span></div></div>`;return;
  }
  const row=x=>`<tr><td>${x.Season}</td><td><strong>${esc(x.Player)}</strong><br><span class="muted">Pick ${x.OverallPick} • ${esc(x.Position||'')}</span></td><td>${x.GamesPlayed??'—'}</td><td>${x.GamesMissed??'—'}</td><td>${x.InjuryWeeks??'—'}</td><td class="${valueTone(x.DraftValue)}">${signed(x.DraftValue)}</td></tr>`;
  $('#content').innerHTML=`<div class="metrics">${metric('Players enriched',players.length)}${metric('Most missed',A.mostMissed?.[0]?.GamesMissed??'—',A.mostMissed?.[0]?.Player||'')}${metric('Injury busts',(A.injuryBusts||[]).length)}${metric('Iron men',(A.ironMen||[]).length)}</div><div class="grid-3"><div class="card"><h2>Most Games Missed</h2>${table(['Year','Player','GP','Missed','Inj Weeks','Draft Value'],(A.mostMissed||[]).slice(0,25).map(row))}</div><div class="card"><h2>Injury Busts</h2>${table(['Year','Player','GP','Missed','Inj Weeks','Draft Value'],(A.injuryBusts||[]).slice(0,25).map(row))}</div><div class="card"><h2>Iron Men</h2>${table(['Year','Player','GP','Missed','Inj Weeks','Draft Value'],(A.ironMen||[]).slice(0,25).map(row))}</div></div>`;
}

function renderData(){
  setHeader('Data Health','What is complete, partial, live or still waiting on enrichment.');
  const items=[
    ['Historical seasons 2013–2025','Complete','good'],
    ['Teams / standings','Complete','good'],
    ['Historical matchups','Complete','good'],
    ['Draft picks','Complete IDs; 94%+ names','good'],
    ['Draft Lab value model','Live on currently covered picks','good'],
    ['Draft actual season points','70.6% current; exact ESPN enrichment next','warn'],
    ['Live 2026 matchups / standings / rosters','Server-side ESPN connection','good'],
    ['Historical individual trades','Needs activity export','warn'],
    ['Games missed / injuries','Needs public NFL enrichment','warn'],
    ['Historical preseason projections','Source-dependent enrichment','warn']
  ];
  $('#content').innerHTML=`<div class="card"><h2>Coverage Matrix</h2>${table(['Dataset','Status','Coverage'],items.map(x=>`<tr><td><strong>${x[0]}</strong></td><td><span class="badge ${x[2]}">${x[1]}</span></td><td>${x[2]==='good'?'Ready':'Next enrichment phase'}</td></tr>`))}</div>
  <div class="hero" style="margin-top:16px"><h2>Why this matters</h2><p>The site intentionally tracks provenance and coverage. A “best trade” or “worst draft pick” is only displayed once the underlying transaction/date/player-season data supports the claim.</p></div>`;
}

const pages={home:renderHome,live:renderLive,history:renderHistory,managers:renderManagers,rivalries:renderRivalries,records:renderRecords,draft:renderDraft,trades:renderTrades,injuries:renderInjuries,data:renderData};
function navigate(page){
  if(liveTimer&&page!=='live'){clearInterval(liveTimer);liveTimer=null}
  currentPage=page; document.querySelectorAll('nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  pages[page]();
}
document.querySelectorAll('nav button').forEach(b=>b.addEventListener('click',()=>navigate(b.dataset.page)));

(async()=>{
  try{
    DATA=await fetch('/data/history.json').then(r=>r.json());
    navigate('home');
  }catch(e){
    $('#content').innerHTML=`<div class="empty">Could not load league history: ${esc(e.message)}</div>`;
    setStatus('Data load failed','bad');
  }
})();
