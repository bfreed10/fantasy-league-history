
let DATA=null;
let currentPage='home';
let liveTimer=null;

const $ = s => document.querySelector(s);
const fmt = (n,d=0) => n==null?'—':Number(n).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
const pct = n => n==null?'—':(Number(n)*100).toFixed(1)+'%';
const esc = v => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ownerLabel = o => o || 'Unknown';

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
  setHeader('Live 2026','Current ESPN matchup scores auto-refresh every 30 seconds.');
  $('#content').innerHTML=`<div class="hero"><h2>Live Scoreboard</h2><p>Your ESPN authentication stays on the server. The browser never receives <code>espn_s2</code> or <code>SWID</code>.</p></div><div id="liveArea" class="empty">Connecting to ESPN…</div>`;
  await refreshLive();
  clearInterval(liveTimer); liveTimer=setInterval(refreshLive,30000);
}
async function refreshLive(){
  try{
    const r=await fetch('/api/live');
    const d=await r.json();
    if(!r.ok||d.error) throw new Error(d.error||`HTTP ${r.status}`);
    setStatus(`Live • Week ${d.currentWeek||'—'}`,'good');
    const cards=(d.matchups||[]).map(m=>`<div class="matchup-card">
      <div class="teamrow"><span><strong>${esc(m.awayTeam||'TBD')}</strong><br><small class="muted">${esc(m.awayOwner||'')}</small></span><strong>${fmt(m.awayScore,2)}</strong></div>
      <div class="teamrow"><span><strong>${esc(m.homeTeam||'TBD')}</strong><br><small class="muted">${esc(m.homeOwner||'')}</small></span><strong>${fmt(m.homeScore,2)}</strong></div>
      <div class="matchup-meta">Week ${esc(m.week)} • ESPN live data • Updated ${new Date(d.updatedAt).toLocaleTimeString()}</div>
    </div>`).join('');
    $('#liveArea').className='scoreboard';
    $('#liveArea').innerHTML=cards||`<div class="empty">No current-week matchups returned yet.</div>`;
  }catch(e){
    setStatus('Live connection needs setup','warn');
    $('#liveArea').className='empty';
    $('#liveArea').innerHTML=`<strong>Live ESPN connection isn't active yet.</strong><br><br>${esc(e.message)}<br><br><span class="muted">Run this website from the same ESPN_League_Archive folder as your existing espn_downloader.py, or set ESPN_S2 and SWID as environment variables.</span>`;
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
  setHeader('Draft Lab','Draft history today; full value model ready for public-data enrichment.');
  const coverage=DATA.meta.draftActualPointsCoveragePct;
  const named=DATA.meta.draftNameCoveragePct;
  const picks=DATA.draft.filter(x=>x['Player Name']).slice().sort((a,b)=>Number(a.Season)-Number(b.Season)||Number(a['Overall Pick'])-Number(b['Overall Pick']));
  $('#content').innerHTML=`
    <div class="metrics">
      ${metric('Draft picks',fmt(DATA.meta.draftPicks))}
      ${metric('Player-name coverage',named+'%','matched from ESPN player IDs')}
      ${metric('Actual-points coverage',coverage+'%','partial roster snapshot')}
      ${metric('Target metric','VORP + pick value','public enrichment')}
    </div>
    <div class="hero"><h2>Planned draft scoring model</h2><p><strong>Steal / bust value</strong> will compare actual season points against expected value for that exact draft slot and position. Injury-adjusted grading will separate poor performance from games missed. The site already preserves ESPN player IDs so public NFL data can be joined without name guessing.</p></div>
    <div class="controls"><input id="draftSearch" placeholder="Search player, team or season"><select id="draftSeason"><option value="">All seasons</option>${[...new Set(DATA.draft.map(x=>x.Season))].sort((a,b)=>b-a).map(y=>`<option>${y}</option>`).join('')}</select></div>
    <div id="draftTable"></div>`;
  const draw=()=>{
    const q=$('#draftSearch').value.toLowerCase(), sy=$('#draftSeason').value;
    const filtered=picks.filter(x=>(!sy||String(x.Season)===sy)&&(!q||JSON.stringify(x).toLowerCase().includes(q))).slice(0,300);
    $('#draftTable').innerHTML=table(['Year','Pick','Round','Player','Team','Actual pts*'],filtered.map(x=>`<tr><td>${x.Season}</td><td>${esc(x['Overall Pick'])}</td><td>${esc(x.Round)}</td><td><strong>${esc(x['Player Name']||'Unknown')}</strong></td><td>${esc(x['Team Name'])}</td><td>${fmt(x['Actual Season Points (partial)'],1)}</td></tr>`));
  }; $('#draftSearch').addEventListener('input',draw); $('#draftSeason').addEventListener('change',draw); draw();
}

function renderTrades(){
  setHeader('Trade Center','Transaction grading framework is ready; historical trade pull is the remaining source-data step.');
  $('#content').innerHTML=`<div class="hero"><h2>Trade grading will be date-aware.</h2><p>A good trade model should not compare full-season totals. It will grade each side using <strong>expected rest-of-season value on the trade date</strong> versus <strong>actual rest-of-season production</strong>, then adjust for injuries, positional scarcity, and multi-player packages.</p></div>
  <div class="grid-2"><div class="card"><h2>Features</h2><div class="feature-list">
    <div class="feature"><strong>Biggest Fleeces</strong><span class="muted">Largest realized value gap after the trade.</span></div>
    <div class="feature"><strong>Best Balanced Trades</strong><span class="muted">Deals where both sides received similar realized value.</span></div>
    <div class="feature"><strong>Manager Trade Records</strong><span class="muted">Career trade wins, losses and net value.</span></div>
    <div class="feature"><strong>Trade Timeline</strong><span class="muted">Every deal with players, date and rest-of-season scoring.</span></div>
  </div></div><div class="card"><h2>Current data status</h2><p><span class="badge warn">Needs historical ESPN activity pull</span></p><p class="muted">Your current workbook contains transaction counters, but not the individual historical trade packages needed to grade deals correctly. The website labels this as unavailable rather than inventing results.</p></div></div>`;
}

function renderInjuries(){
  setHeader('Injury Room','Games missed, injury-adjusted draft grades and availability trends.');
  $('#content').innerHTML=`<div class="hero"><h2>Separate bad picks from bad injury luck.</h2><p>The enrichment layer is designed to join ESPN player IDs to public NFL player IDs, then calculate games available, games played and games missed. That allows draft grades such as <strong>raw value</strong>, <strong>per-game value</strong>, and <strong>injury-adjusted value</strong>.</p></div>
  <div class="grid-3">
    <div class="card"><h3>Most Games Missed</h3><p class="muted">Rank drafted players by missed regular-season games.</p><span class="badge warn">Public enrichment needed</span></div>
    <div class="card"><h3>Injury Busts</h3><p class="muted">High draft-cost players whose value loss was primarily availability.</p><span class="badge warn">Public enrichment needed</span></div>
    <div class="card"><h3>Iron Men</h3><p class="muted">High-value drafted players with strong season-long availability.</p><span class="badge warn">Public enrichment needed</span></div>
  </div>`;
}

function renderData(){
  setHeader('Data Health','What is complete, partial, live or still waiting on enrichment.');
  const items=[
    ['Historical seasons 2013–2025','Complete','good'],
    ['Teams / standings','Complete','good'],
    ['Historical matchups','Complete','good'],
    ['Draft picks','Complete IDs; 94%+ names','good'],
    ['Draft actual season points','Partial roster-derived coverage','warn'],
    ['Live 2026 matchups','Server-side ESPN connection','good'],
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
