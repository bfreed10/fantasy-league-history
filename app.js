
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


// League identity + franchise cleanup.
// Team ID is the stable franchise key in the historical ESPN archive. This lets
// display-name/account changes merge naturally without modifying the source JSON.
const OWNER_KEYS={
  'minky414':'minky',
  'minky mink':'minky',
  'potatoskins12344':'schwappaports',
  'eli1971, potatoskins12344':'schwappaports',
  'camlevine':'camlevine',
  'matthew z':'matthew-z',
  'man clan':'man-clan',
  'wierce55':'pierce',
  'ryanbballer3':'balow',
  'pointman521':'brandon-king',
  'brandon228667':'brandon-freedman',
  'jack faraone':'jack-faraone',
  'spenger123':'spencer',
  'matthewg1019':'matthew-gordon',
  '301garrett':'301garrett'
};
const MANAGER_NAMES={
  'minky':'Justin Minkoff',
  'schwappaports':'Alec Rappaport & Eli Schwartz',
  'camlevine':'Cameron Levine',
  'matthew-z':'Matthew Zlotnicki',
  'man-clan':'Sam Boderman',
  'pierce':'Pierce Barbour',
  'balow':'Ryan Balow',
  'brandon-king':'Brandon King',
  'brandon-freedman':'Brandon Freedman',
  'jack-faraone':'Jack Faraone',
  'spencer':'Spencer Friedman',
  'matthew-gordon':'Matthew Gordon',
  '301garrett':'301garrett'
};
const normOwner=o=>String(o||'Unknown').trim();
const ownerKey=o=>OWNER_KEYS[normOwner(o).toLowerCase()]||normOwner(o).toLowerCase();
const canonicalOwner=o=>MANAGER_NAMES[ownerKey(o)]||normOwner(o);
const teamId=v=>{const n=Number(v);return Number.isFinite(n)?n:null;};
const cleanTeam=t=>String(t||'').trim().replace(/\s{2,}/g,' ');

function franchiseRows(id){
  const tid=teamId(id);
  return (DATA?.teams||[]).filter(x=>teamId(x['Team ID'])===tid).sort((a,b)=>Number(a.Season)-Number(b.Season));
}
function latestFranchiseRow(id){
  const xs=franchiseRows(id); return xs.length?xs.at(-1):null;
}
function latestTeamById(id){
  const x=latestFranchiseRow(id); return x?cleanTeam(x['Team Name']):`Team ${id}`;
}
function latestManagerById(id){
  const x=latestFranchiseRow(id); return x?canonicalOwner(x['Owner(s)']):'Unknown';
}
function ownerTeamRows(owner){
  const key=ownerKey(owner);
  return (DATA?.teams||[]).filter(x=>ownerKey(x['Owner(s)'])===key).sort((a,b)=>Number(a.Season)-Number(b.Season));
}
function latestTeam(owner){
  const xs=ownerTeamRows(owner); return xs.length?cleanTeam(xs.at(-1)['Team Name']):canonicalOwner(owner);
}
function displayTeamOwner(owner,team=''){
  const t=cleanTeam(team)||latestTeam(owner);
  return `<span class="team-primary">${esc(t)}</span><span class="manager-secondary">${esc(canonicalOwner(owner))}</span>`;
}
function displayFranchise(id,team='',owner=''){
  const row=latestFranchiseRow(id), t=cleanTeam(team)||(row?cleanTeam(row['Team Name']):`Team ${id}`), o=owner||row?.['Owner(s)']||'';
  return `<span class="team-primary">${esc(t)}</span><span class="manager-secondary">${esc(canonicalOwner(o))}</span>`;
}
function championTeamId(c){
  const season=Number(c.season);
  const exact=(DATA?.teams||[]).find(x=>Number(x.Season)===season&&cleanTeam(x['Team Name'])===cleanTeam(c.team));
  if(exact) return teamId(exact['Team ID']);
  const owner=(DATA?.teams||[]).find(x=>Number(x.Season)===season&&ownerKey(x['Owner(s)'])===ownerKey(c.owner));
  return owner?teamId(owner['Team ID']):null;
}
function franchiseStats(){
  const map=new Map();
  for(const x of DATA?.teams||[]){
    const id=teamId(x['Team ID']); if(id==null) continue;
    if(!map.has(id)) map.set(id,{id,rows:[],seasons:new Set(),wins:0,losses:0,ties:0,pointsFor:0,pointsAgainst:0,finishTotal:0,finishCount:0,top3:0,bestFinish:null,titles:0,playoffSeasons:new Set()});
    const f=map.get(id), finish=Number(x['Final Rank']);
    f.rows.push(x);f.seasons.add(Number(x.Season));f.wins+=Number(x.Wins||0);f.losses+=Number(x.Losses||0);f.ties+=Number(x.Ties||0);f.pointsFor+=Number(x['Points For']||0);f.pointsAgainst+=Number(x['Points Against']||0);
    if(Number.isFinite(finish)&&finish>0){f.finishTotal+=finish;f.finishCount++;if(finish<=3)f.top3++;f.bestFinish=f.bestFinish==null?finish:Math.min(f.bestFinish,finish);}
  }
  for(const c of DATA?.champions||[]){const id=championTeamId(c);if(id!=null&&map.has(id))map.get(id).titles++;}
  for(const g of DATA?.matchups||[]){
    if(String(g['Playoff Tier']||'')!=='WINNERS_BRACKET') continue;
    for(const k of ['Home Team ID','Away Team ID']){const id=teamId(g[k]);if(id!=null&&map.has(id))map.get(id).playoffSeasons.add(Number(g.Season));}
  }
  return [...map.values()].map(f=>{
    f.rows.sort((a,b)=>Number(a.Season)-Number(b.Season));
    const last=f.rows.at(-1), games=f.wins+f.losses+f.ties, seasons=f.seasons.size;
    const aliases=[...new Set(f.rows.map(x=>cleanTeam(x['Team Name'])).filter(Boolean))];
    const managers=[...new Set(f.rows.map(x=>canonicalOwner(x['Owner(s)'])).filter(Boolean))];
    return {...f,seasons,currentTeam:cleanTeam(last?.['Team Name'])||`Team ${f.id}`,currentManager:canonicalOwner(last?.['Owner(s)']),aliases,managers,firstSeason:Number(f.rows[0]?.Season),lastSeason:Number(last?.Season),winPct:games?f.wins/games:0,avgFinish:f.finishCount?f.finishTotal/f.finishCount:null,avgPointsPerSeason:seasons?f.pointsFor/seasons:0,playoffApps:f.playoffSeasons.size};
  }).sort((a,b)=>b.wins-a.wins||b.titles-a.titles||b.pointsFor-a.pointsFor);
}
function franchiseDraftCareers(){
  const A=DATA?.draftAnalytics||{}, map=new Map();
  for(const p of A.picks||[]){
    if(p.ValueAboveSlot==null) continue;
    const id=teamId(p['Team ID']); if(id==null) continue;
    if(!map.has(id)) map.set(id,{TeamID:id,seasons:new Set(),GradedPicks:0,TotalValue:0,AorBetter:0});
    const m=map.get(id);m.seasons.add(Number(p.Season));m.GradedPicks++;m.TotalValue+=Number(p.ValueAboveSlot||0);
  }
  for(const c of A.classes||[]){const id=teamId(c['Team ID']);if(id!=null&&map.has(id)&&String(c.Grade||'').startsWith('A'))map.get(id).AorBetter++;}
  return [...map.values()].map(m=>({TeamID:m.TeamID,Team:latestTeamById(m.TeamID),Manager:latestManagerById(m.TeamID),Seasons:m.seasons.size,GradedPicks:m.GradedPicks,AvgValuePerPick:m.GradedPicks?m.TotalValue/m.GradedPicks:0,TotalValue:m.TotalValue,AorBetter:m.AorBetter})).sort((a,b)=>b.AvgValuePerPick-a.AvgValuePerPick);
}
function buildRivalries(){
  const map=new Map();
  for(const g of DATA?.matchups||[]){
    const home=teamId(g['Home Team ID']), away=teamId(g['Away Team ID']);
    if(home==null||away==null||home===away) continue;
    const [a,b]=[home,away].sort((x,y)=>x-y), key=`${a}|||${b}`;
    if(!map.has(key)) map.set(key,{a,b,games:0,aWins:0,bWins:0,ties:0,aPoints:0,bPoints:0,playoffGames:0,meetings:[]});
    const r=map.get(key), homeIsA=home===a;
    const aScore=Number(homeIsA?g['Home Score']:g['Away Score'])||0, bScore=Number(homeIsA?g['Away Score']:g['Home Score'])||0;
    const aTeam=cleanTeam(homeIsA?g['Home Team']:g['Away Team']), bTeam=cleanTeam(homeIsA?g['Away Team']:g['Home Team']);
    r.games++;r.aPoints+=aScore;r.bPoints+=bScore;if(aScore>bScore)r.aWins++;else if(bScore>aScore)r.bWins++;else r.ties++;
    const playoff=String(g['Playoff Tier']||'')==='WINNERS_BRACKET';if(playoff)r.playoffGames++;
    r.meetings.push({season:Number(g.Season),week:Number(g.Week),aScore,bScore,aTeam,bTeam,playoff,margin:Math.abs(aScore-bScore)});
  }
  return [...map.values()].sort((x,y)=>y.games-x.games||Math.max(y.aWins,y.bWins)-Math.max(x.aWins,x.bWins));
}
function rivalryStreak(meetings,selectedA,recordA){
  const xs=[...meetings].sort((x,y)=>y.season-x.season||y.week-x.week); if(!xs.length)return '—';
  const first=xs[0]; const firstAWon=first.aScore>first.bScore, firstBWon=first.bScore>first.aScore;if(!firstAWon&&!firstBWon)return '1 tie';
  const originalWinner=firstAWon?'a':'b';let n=0;for(const m of xs){const w=m.aScore>m.bScore?'a':m.bScore>m.aScore?'b':'t';if(w!==originalWinner)break;n++;}
  const winnerId=originalWinner==='a'?recordA.a:recordA.b;return `${latestTeamById(winnerId)} • ${n} win${n===1?'':'s'}`;
}

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
  return [...franchiseStats()].sort((a,b)=>b.titles-a.titles||b.wins-a.wins)[0];
}

function renderHome(){
  setHeader('League Overview','13 seasons of history with live 2026 support.');
  const franchises=franchiseStats(), topTitles=[...franchises].sort((a,b)=>b.titles-a.titles||b.wins-a.wins)[0], bestScore=DATA.records.highestScores[0];
  const maxWins=Math.max(...franchises.map(x=>x.wins));
  $('#content').innerHTML=`
    <div class="hero"><h2>Your league, from 2013 to now.</h2><p>Historical standings, matchups, franchise records, rivalries, draft data, and the live ESPN dashboard. Historical ESPN account-name changes are cleaned up using the stable franchise/team ID, so aliases no longer split career totals.</p></div>
    <div class="metrics">
      ${metric('Historical seasons','13','2013–2025')}
      ${metric('Saved matchups',fmt(DATA.meta.matchups),'regular season + playoffs')}
      ${metric('Most titles',topTitles?.titles??'—',topTitles?.currentTeam||'')}
      ${metric('Record weekly score',bestScore?fmt(bestScore.highScore,2):'—',bestScore?`${bestScore.season} Week ${bestScore.week}`:'')}
    </div>
    <div class="grid-2">
      <div class="card"><h2>Championship Timeline</h2><div class="champion-list">
        ${[...DATA.champions].reverse().map(c=>`<div class="champion"><div class="year">${c.season}</div><div><strong>${esc(cleanTeam(c.team))}</strong><div class="muted">${esc(canonicalOwner(c.owner))}</div></div><span class="badge">${c.wins}-${c.losses}</span></div>`).join('')}
      </div></div>
      <div class="card"><h2>All-Time Wins</h2><p class="muted">Franchise records, not ESPN usernames.</p>
        ${franchises.slice(0,8).map((f,i)=>`<div class="bar-row"><span>${i+1}. ${esc(f.currentTeam)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,f.wins/maxWins*100)}%"></div></div><strong>${f.wins} W</strong></div>`).join('')}
      </div>
    </div>`;
  setStatus('Cleaned franchise history loaded','good');
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
      <div class="teamrow"><span><strong>${esc(m.awayTeam||'TBD')}</strong><br><small class="muted">${esc(canonicalOwner(m.awayOwner||''))}</small></span><strong>${fmt(m.awayScore,2)}</strong></div>
      <div class="teamrow"><span><strong>${esc(m.homeTeam||'TBD')}</strong><br><small class="muted">${esc(canonicalOwner(m.homeOwner||''))}</small></span><strong>${fmt(m.homeScore,2)}</strong></div>
      <div class="matchup-meta">Week ${esc(m.week)} • Updated ${new Date(d.updatedAt).toLocaleTimeString()}</div>
    </div>`).join('');
    const standingRows=(d.standings||[]).map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.team)}</strong><br><span class="muted">${esc(canonicalOwner(x.owner||''))}</span></td><td>${x.wins}-${x.losses}-${x.ties}</td><td>${fmt(x.pointsFor,1)}</td><td>${fmt(x.pointsAgainst,1)}</td><td>${fmt(x.powerScore,1)}</td></tr>`);
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
  const rows=DATA.teams.filter(x=>Number(x.Season)===y).sort((a,b)=>(a['Final Rank']??99)-(b['Final Rank']??99)).map(x=>`<tr><td>${esc(x['Final Rank'])}</td><td>${displayFranchise(x['Team ID'],x['Team Name'],x['Owner(s)'])}</td><td>${esc(x.Wins)}-${esc(x.Losses)}-${esc(x.Ties)}</td><td>${fmt(x['Points For'],2)}</td><td>${fmt(x['Points Against'],2)}</td><td>${esc(x['Playoff Seed'])}</td></tr>`);
  $('#seasonTable').innerHTML=table(['Finish','Team / Manager','Record','PF','PA','Seed'],rows);
}

function renderManagers(){
  setHeader('All-Time Leaders','Cleaned franchise records, manager history and team-name timelines.');
  const franchises=franchiseStats();
  const rows=franchises.map((f,i)=>`<tr>
    <td>${i+1}</td><td>${displayFranchise(f.id)}</td><td>${f.seasons}</td><td>${f.titles}</td><td>${f.wins}-${f.losses}-${f.ties}</td><td>${pct(f.winPct)}</td><td>${f.playoffApps}</td><td>${f.top3}</td><td>${fmt(f.avgFinish,2)}</td><td>${f.bestFinish??'—'}</td><td>${fmt(f.pointsFor,1)}</td><td>${fmt(f.avgPointsPerSeason,1)}</td>
  </tr>`);
  const topWins=[...franchises].sort((a,b)=>b.wins-a.wins)[0], topTitles=[...franchises].sort((a,b)=>b.titles-a.titles||b.wins-a.wins)[0], bestPct=[...franchises].filter(x=>x.seasons>=6).sort((a,b)=>b.winPct-a.winPct)[0], bestAvg=[...franchises].filter(x=>x.seasons>=6).sort((a,b)=>a.avgFinish-b.avgFinish)[0];
  const options=franchises.slice().sort((a,b)=>a.currentTeam.localeCompare(b.currentTeam)).map(f=>`<option value="${f.id}">${esc(f.currentTeam)} (${f.firstSeason}–${f.lastSeason})</option>`).join('');
  $('#content').innerHTML=`
    <div class="metrics">
      ${metric('Most wins',topWins?.wins??'—',topWins?.currentTeam||'')}
      ${metric('Most titles',topTitles?.titles??'—',topTitles?.currentTeam||'')}
      ${metric('Best win %',bestPct?pct(bestPct.winPct):'—',bestPct?.currentTeam||'min. 6 seasons')}
      ${metric('Best avg finish',bestAvg?fmt(bestAvg.avgFinish,2):'—',bestAvg?.currentTeam||'min. 6 seasons')}
    </div>
    <div class="card"><h2>All-Time Franchise Table</h2><p class="muted">Stats are grouped by ESPN Team ID, which fixes account-name changes such as Minky414 → Minky mink and potatoskins12344 → the later dual-owner account.</p>${table(['#','Team / Manager','Seasons','Titles','W-L-T','Win %','Playoffs','Top 3','Avg Finish','Best','Points For','PF / Season'],rows)}</div>
    <div class="grid-2 section-gap">
      <div class="card"><h2>Identity Cleanup</h2>
        <div class="identity-note"><span class="badge good">13 seasons</span><div><strong>I love big TD's</strong><span class="muted">Minky414 and Minky mink are one franchise history (Team ID 4): 91-83-1 across 2013–2025.</span><div class="aliases"><span class="badge">Minky414</span><span class="badge">Minky mink</span></div></div></div>
        <div class="identity-note"><span class="badge good">13 seasons</span><div><strong>The Schwappaports</strong><span class="muted">potatoskins12344 and eli1971, potatoskins12344 are one franchise history (Team ID 12): 81-91-3 across 2013–2025.</span><div class="aliases"><span class="badge">potatoskins12344</span><span class="badge">eli1971, potatoskins12344</span></div></div></div>
      </div>
      <div class="card"><h2>Matthew / Spenger History</h2>
        <div class="identity-note"><span class="badge warn">13 years participating</span><div><strong>Matthew Gordon</strong><span class="muted">2013–2019: participated on Spencer Friedman's franchise. Beginning in 2020, Matthew managed his own franchise after taking the league slot vacated when 301garrett left.</span></div></div>
        <p class="muted">Matthew's first seven participation seasons are documented here but are not copied into his independent franchise W-L record. The Money Team therefore shows 6 franchise seasons (2020–2025), while Matthew's league participation spans all 13 historical seasons.</p>
      </div>
    </div>
    <div class="card section-gap"><h2>Franchise / Team Name History</h2><div class="controls"><label>Franchise <select id="franchiseHistoryPick">${options}</select></label></div><div id="franchiseHistoryPanel"></div></div>`;
  const drawHistory=()=>{
    const id=Number($('#franchiseHistoryPick').value), f=franchises.find(x=>x.id===id);if(!f)return;
    const hist=f.rows.map(x=>`<tr><td>${x.Season}</td><td><strong>${esc(cleanTeam(x['Team Name']))}</strong></td><td>${esc(canonicalOwner(x['Owner(s)']))}</td><td>${x.Wins}-${x.Losses}-${x.Ties}</td><td>${x['Final Rank']??'—'}</td><td>${fmt(x['Points For'],1)}</td></tr>`);
    $('#franchiseHistoryPanel').innerHTML=`<div class="franchise-summary"><strong>${esc(f.currentTeam)}</strong><span class="muted">${f.firstSeason}–${f.lastSeason} • ${f.seasons} seasons • ${f.titles} title${f.titles===1?'':'s'} • ${f.playoffApps} championship-bracket appearances</span></div>${table(['Season','Team Name','Manager','Record','Finish','PF'],hist)}`;
  };
  $('#franchiseHistoryPick').addEventListener('change',drawHistory);drawHistory();
  setStatus(`${franchises.length} historical franchise IDs • aliases cleaned`,'good');
}

function renderRivalries(){
  setHeader('Rivalries','Keep the full rivalry board or compare any two franchises directly.');
  const rivalries=buildRivalries(), franchises=franchiseStats();
  const options=`<option value="">All Teams</option>${franchises.slice().sort((a,b)=>a.currentTeam.localeCompare(b.currentTeam)).map(f=>`<option value="${f.id}">${esc(f.currentTeam)}${f.lastSeason<2025?` (${f.firstSeason}–${f.lastSeason})`:''}</option>`).join('')}`;
  $('#content').innerHTML=`<div class="card"><div class="rivalry-picker"><label>Team A<select id="rivalA">${options}</select></label><div class="rivalry-vs">VS</div><label>Team B<select id="rivalB">${options}</select></label></div><div id="rivalryPanel"></div></div>`;
  const panel=$('#rivalryPanel');
  const draw=()=>{
    const a=Number($('#rivalA').value)||null,b=Number($('#rivalB').value)||null;
    if(a&&b&&a===b){panel.innerHTML='<div class="empty">Choose two different teams.</div>';return;}
    if(a&&b){
      const lo=Math.min(a,b),hi=Math.max(a,b),r=rivalries.find(x=>x.a===lo&&x.b===hi);
      if(!r){panel.innerHTML='<div class="empty">No saved meetings between those franchises.</div>';return;}
      const selectedAIsRecordA=a===r.a;
      const aWins=selectedAIsRecordA?r.aWins:r.bWins,bWins=selectedAIsRecordA?r.bWins:r.aWins,aPts=selectedAIsRecordA?r.aPoints:r.bPoints,bPts=selectedAIsRecordA?r.bPoints:r.aPoints;
      const meetings=[...r.meetings].sort((x,y)=>y.season-x.season||y.week-x.week);
      const mapped=meetings.map(m=>selectedAIsRecordA?m:{...m,aScore:m.bScore,bScore:m.aScore,aTeam:m.bTeam,bTeam:m.aTeam});
      const biggest=[...mapped].sort((x,y)=>(y.aScore-y.bScore)-(x.aScore-x.bScore))[0], closest=[...mapped].sort((x,y)=>x.margin-y.margin)[0];
      panel.innerHTML=`
        <div class="rivalry-summary">
          ${metric(latestTeamById(a),`${aWins}-${bWins}-${r.ties}`,`${r.games} total meetings`)}
          ${metric('Total points',`${fmt(aPts,1)} – ${fmt(bPts,1)}`,`${fmt(aPts/r.games,1)} – ${fmt(bPts/r.games,1)} avg`)}
          ${metric('Championship-bracket meetings',r.playoffGames,r.playoffGames?'WINNERS_BRACKET only':'None')}
          ${metric('Current streak',rivalryStreak(r.meetings,a,r))}
        </div>
        <div class="grid-2 section-gap"><div class="card mini-card"><h3>Biggest ${esc(latestTeamById(a))} Win</h3><p>${biggest&&biggest.aScore>biggest.bScore?`${biggest.season} W${biggest.week} • ${fmt(biggest.aScore,1)}–${fmt(biggest.bScore,1)} (+${fmt(biggest.aScore-biggest.bScore,1)})`:'No wins in saved meetings'}</p></div><div class="card mini-card"><h3>Closest Meeting</h3><p>${closest?`${closest.season} W${closest.week} • ${fmt(closest.aScore,1)}–${fmt(closest.bScore,1)} (${fmt(closest.margin,1)} pts)`:''}</p></div></div>
        <div class="section-gap"><h3>Meeting History</h3>${table(['Season','Week',latestTeamById(a),latestTeamById(b),'Stage'],mapped.map(m=>`<tr><td>${m.season}</td><td>${m.week}</td><td><strong>${fmt(m.aScore,2)}</strong><br><span class="muted">${esc(m.aTeam)}</span></td><td><strong>${fmt(m.bScore,2)}</strong><br><span class="muted">${esc(m.bTeam)}</span></td><td>${m.playoff?'<span class="badge warn">Playoffs</span>':'Regular'}</td></tr>`))}</div>`;
      return;
    }
    const filtered=rivalries.filter(r=>(!a||r.a===a||r.b===a)&&(!b||r.a===b||r.b===b)).slice(0,100);
    const rows=filtered.map(r=>`<tr><td><strong>${esc(latestTeamById(r.a))}</strong> vs <strong>${esc(latestTeamById(r.b))}</strong><br><span class="muted">${esc(latestManagerById(r.a))} vs ${esc(latestManagerById(r.b))}</span></td><td>${r.games}</td><td>${r.aWins}-${r.bWins}-${r.ties}</td><td>${fmt(r.aPoints,2)} – ${fmt(r.bPoints,2)}</td><td>${r.playoffGames}</td></tr>`);
    panel.innerHTML=`<h2>${a||b?'Rivalries involving selected team':'Most-Played Rivalries'}</h2>${table(['Matchup','Games','Record (left-right-ties)','Total Points','Playoff Meetings'],rows)}`;
  };
  $('#rivalA').addEventListener('change',draw);$('#rivalB').addEventListener('change',draw);draw();
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
  const stealRows=(A.topSteals||[]).slice(0,25).map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x['Player Name'])}</strong><br><span class="muted">${x.Season} • Pick ${x['Overall Pick']} • ${esc(x.Position||'')}</span></td><td>${fmt(x.ActualPoints,1)}</td><td>${fmt(x.ExpectedSlotPoints,1)}</td><td class="good"><strong>${signed(x.ValueAboveSlot)}</strong></td><td>${displayTeamOwner(x['Owner(s)'],x['Team Name'])}</td></tr>`);
  const bustRows=(A.topBusts||[]).slice(0,25).map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x['Player Name'])}</strong><br><span class="muted">${x.Season} • Pick ${x['Overall Pick']} • ${esc(x.Position||'')}</span></td><td>${fmt(x.ActualPoints,1)}</td><td>${fmt(x.ExpectedSlotPoints,1)}</td><td class="bad"><strong>${signed(x.ValueAboveSlot)}</strong></td><td>${displayTeamOwner(x['Owner(s)'],x['Team Name'])}</td></tr>`);
  const renderTab=tab=>{
    document.querySelectorAll('#draftTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    if(tab==='steals') panel.innerHTML=`<div class="grid-2"><div class="card"><h2>Biggest Steals</h2>${table(['#','Player','Actual','Expected','Value','Manager'],stealRows)}</div><div class="card"><h2>Biggest Busts</h2>${table(['#','Player','Actual','Expected','Value','Manager'],bustRows)}</div></div>`;
    if(tab==='classes'){
      panel.innerHTML=`<div class="controls"><label>Season <select id="classSeason">${years.map(y=>`<option>${y}</option>`).join('')}</select></label></div><div id="classTable"></div><div class="grid-2 section-gap"><div class="card"><h2>Best Classes Ever</h2>${table(['Year','Grade','Team / Manager','Avg Value','Total Value','Coverage'],(A.bestClasses||[]).slice(0,20).map(x=>`<tr><td>${x.Season}</td><td><span class="badge ${gradeTone(x.Grade)}">${esc(x.Grade)}</span></td><td><strong>${esc(x['Team Name'])}</strong><br><span class="muted">${esc(x.Owner)}</span></td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${fmt(x.CoveragePct,1)}%</td></tr>`))}</div><div class="card"><h2>Worst Classes Ever</h2>${table(['Year','Grade','Team / Manager','Avg Value','Total Value','Coverage'],(A.worstClasses||[]).slice(0,20).map(x=>`<tr><td>${x.Season}</td><td><span class="badge ${gradeTone(x.Grade)}">${esc(x.Grade)}</span></td><td><strong>${esc(x['Team Name'])}</strong><br><span class="muted">${esc(x.Owner)}</span></td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${fmt(x.CoveragePct,1)}%</td></tr>`))}</div></div>`;
      const draw=()=>{const y=Number($('#classSeason').value);const rows=(A.classes||[]).filter(x=>Number(x.Season)===y).sort((a,b)=>b.RawScore-a.RawScore).map((x,i)=>`<tr><td>${i+1}</td><td><span class="badge ${gradeTone(x.Grade)}"><strong>${esc(x.Grade)}</strong></span></td><td><strong>${esc(x['Team Name'])}</strong><br><span class="muted">${esc(x.Owner)}</span></td><td>${x['Graded Picks']}/${x.Picks}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${fmt(x.HitRatePct,1)}%</td><td>${fmt(x.BustRatePct,1)}%</td></tr>`);$('#classTable').innerHTML=table(['#','Grade','Team / Manager','Graded','Avg Value','Total Value','Steal %','Bust %'],rows);};$('#classSeason').addEventListener('change',draw);draw();
    }
    if(tab==='managers'){
      const careers=franchiseDraftCareers();
      panel.innerHTML=`<div class="card"><h2>Franchise Draft Careers</h2><p class="muted">Known ESPN aliases are merged. Team name is shown first; manager identity is secondary.</p>${table(['#','Franchise / Manager','Seasons','Graded Picks','Avg Value / Pick','Total Value','A Classes'],careers.map((x,i)=>`<tr><td>${i+1}</td><td>${displayFranchise(x.TeamID,x.Team,x.Manager)}</td><td>${x.Seasons}</td><td>${x.GradedPicks}</td><td class="${valueTone(x.AvgValuePerPick)}"><strong>${signed(x.AvgValuePerPick)}</strong></td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${x.AorBetter}</td></tr>`))}</div>`;
    }
    if(tab==='positions') panel.innerHTML=`<div class="grid-2"><div class="card"><h2>Value by Position</h2><p class="muted">Compared against the historical expectation for the same position and round.</p>${table(['Position','Picks','Actual','Expected','Value','Steal %','Bust %'],(A.positionValue||[]).map(x=>`<tr><td><strong>${esc(x.Position)}</strong></td><td>${x.Picks}</td><td>${fmt(x.AvgActual,1)}</td><td>${fmt(x.AvgExpected,1)}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td>${fmt(x.HitRatePct,1)}%</td><td>${fmt(x.BustRatePct,1)}%</td></tr>`))}</div><div class="card"><h2>Value by Round</h2>${table(['Round','Picks','Actual','Expected','Value','Steal %','Bust %'],(A.roundValue||[]).map(x=>`<tr><td><strong>${x.Round}</strong></td><td>${x.Picks}</td><td>${fmt(x.AvgActual,1)}</td><td>${fmt(x.AvgExpected,1)}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td>${fmt(x.HitRatePct,1)}%</td><td>${fmt(x.BustRatePct,1)}%</td></tr>`))}</div></div>`;
    if(tab==='all'){
      panel.innerHTML=`<div class="controls"><input id="draftSearch" placeholder="Search player, manager or team"><select id="draftSeason"><option value="">All seasons</option>${years.map(y=>`<option>${y}</option>`).join('')}</select><select id="draftPos"><option value="">All positions</option>${[...new Set((A.picks||[]).map(x=>x.Position).filter(Boolean))].sort().map(p=>`<option>${p}</option>`).join('')}</select></div><div id="draftTable"></div>`;
      const draw=()=>{const q=$('#draftSearch').value.toLowerCase(),sy=$('#draftSeason').value,pos=$('#draftPos').value;const xs=(A.picks||[]).filter(x=>(!sy||String(x.Season)===sy)&&(!pos||x.Position===pos)&&(!q||JSON.stringify(x).toLowerCase().includes(q))).sort((a,b)=>Number(b.Season)-Number(a.Season)||Number(a['Overall Pick'])-Number(b['Overall Pick'])).slice(0,600);$('#draftTable').innerHTML=table(['Year','Pick','Rnd','Player','Pos','Manager / Team','Actual','Expected','Value'],xs.map(x=>`<tr><td>${x.Season}</td><td>${x['Overall Pick']}</td><td>${x.Round}</td><td><strong>${esc(x['Player Name']||'Unknown')}</strong></td><td>${esc(x.Position||'')}</td><td>${displayTeamOwner(x['Owner(s)'],x['Team Name'])}</td><td>${fmt(x.ActualPoints,1)}</td><td>${fmt(x.ExpectedSlotPoints,1)}</td><td class="${valueTone(x.ValueAboveSlot)}"><strong>${signed(x.ValueAboveSlot)}</strong></td></tr>`));};$('#draftSearch').addEventListener('input',draw);$('#draftSeason').addEventListener('change',draw);$('#draftPos').addEventListener('change',draw);draw();
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
  setHeader('Injury Room','Fantasy-season injury games missed by year and across a player’s career. Bye weeks and NFL playoffs are excluded.');
  const A=DATA.injuryAnalytics||{}, players=A.players||[];
  if(!players.length){
    $('#content').innerHTML=`<div class="hero"><h2>Injury data needs to be rebuilt.</h2><p>The corrected model uses NFL schedules, weekly rosters, snap counts and injury reports so bye weeks and NFL postseason games are not treated as missed fantasy-season games.</p></div>`;return;
  }

  // Backward-compatible warning if the old rough 16/17-games-minus-GP model is still loaded.
  if(Number(A.version||0)<2){
    const row=x=>`<tr><td>${x.Season}</td><td><strong>${esc(x.Player)}</strong><br><span class="muted">Pick ${x.OverallPick} • ${esc(x.Position||'')}</span></td><td>${x.GamesPlayed??'—'}</td><td>${x.GamesMissed??'—'}</td><td>${x.InjuryWeeks??'—'}</td><td class="${valueTone(x.DraftValue)}">${signed(x.DraftValue)}</td></tr>`;
    $('#content').innerHTML=`<div class="hero"><h2>Old injury model detected</h2><p>This dataset still uses the rough full-season estimate. Run the Injury Room v2 rebuild before relying on these totals.</p><span class="badge warn">Rebuild required</span></div><div class="card section-gap"><h2>Existing Data</h2>${table(['Year','Player','GP','Old Missed','Inj Weeks','Draft Value'],(A.mostMissed||players).slice(0,50).map(row))}</div>`;
    return;
  }

  const careers=A.career||[], seasons=A.bySeason||[];
  const totalInjury=players.reduce((n,x)=>n+Number(x.InjuryGamesMissed||0),0);
  const totalOther=players.reduce((n,x)=>n+Number(x.OtherOrUnknownGamesMissed||0),0);
  const affected=players.filter(x=>Number(x.InjuryGamesMissed||0)>0).length;
  const careerLeader=(A.careerMostMissed||careers)[0];
  const worstSeason=seasons.slice().sort((a,b)=>Number(b.InjuryGamesMissed||0)-Number(a.InjuryGamesMissed||0))[0];
  const years=[...new Set(players.map(x=>Number(x.Season)))].filter(Boolean).sort((a,b)=>b-a);
  const quality=A.coverage||{};

  $('#content').innerHTML=`
    <div class="metrics">
      ${metric('Injury games missed',fmt(totalInjury),`${affected} drafted player-seasons affected`)}
      ${metric('Career leader',careerLeader?careerLeader.InjuryGamesMissed:'—',careerLeader?careerLeader.Player:'injury-related misses')}
      ${metric('Most injury-heavy season',worstSeason?worstSeason.Season:'—',worstSeason?`${worstSeason.InjuryGamesMissed} injury games missed`: '')}
      ${metric('High-quality rows',quality.highQualityPct!=null?`${quality.highQualityPct}%`:'—',`${quality.validPlayerSeasonRows??players.length} usable player-seasons`)}
    </div>
    <div class="hero"><h2>What counts as a missed game?</h2><p><strong>Primary number: Injury Games Missed.</strong> A week counts only when the player's NFL team actually had a regular-season game during this league's fantasy-season window and injury-report or IR/PUP/NFI evidence supports the absence. Bye weeks and NFL playoff games are excluded. Suspensions and unexplained/healthy non-participation are shown separately.</p></div>
    <div class="tabs" id="injuryTabs">
      <button class="active" data-tab="career">Career Leaders</button>
      <button data-tab="season">By Season</button>
      <button data-tab="busts">Injury Busts</button>
      <button data-tab="all">All Player-Seasons</button>
      <button data-tab="method">Methodology</button>
    </div>
    <div id="injuryPanel"></div>`;

  const panel=$('#injuryPanel');
  const playerCell=x=>`<strong>${esc(x.Player)}</strong><br><span class="muted">${esc(x.Position||'')} ${x.OverallPick?`• Pick ${x.OverallPick}`:''}${x.DraftedByTeam?` • ${esc(x.DraftedByTeam)}`:''}</span>`;
  const qualityBadge=x=>`<span class="badge ${x==='High'?'good':x==='Low'?'bad':'warn'}">${esc(x||'—')}</span>`;

  const draw=tab=>{
    document.querySelectorAll('#injuryTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    if(tab==='career'){
      const rows=(A.careerMostMissed||careers).slice(0,100).map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.Player)}</strong><br><span class="muted">${esc(x.Position||'')} • drafted ${x.DraftedSeasons} season${x.DraftedSeasons===1?'':'s'}</span></td><td><strong>${x.InjuryGamesMissed}</strong></td><td>${x.SeasonsWithInjuryMiss}</td><td>${x.GamesPlayed}/${x.EligibleFantasySeasonGames}</td><td>${x.InjuryWeeks}</td><td>${x.SuspensionGamesMissed||0}</td><td>${x.OtherOrUnknownGamesMissed||0}</td></tr>`);
      panel.innerHTML=`<div class="card"><h2>Career Injury Games Missed</h2><p class="muted">Totals only include seasons in which the player was drafted in the LFL. Other/unknown and suspension absences are not included in the injury total.</p>${table(['#','Player','Injury Missed','Affected Seasons','Played / Eligible','Injury Report Weeks','Susp.','Other / Unknown'],rows)}</div>`;
    }
    if(tab==='season'){
      panel.innerHTML=`<div class="controls"><label>Season <select id="injurySeason">${years.map(y=>`<option>${y}</option>`).join('')}</select></label></div><div id="injurySeasonPanel"></div><div class="card section-gap"><h2>League Injury Totals by Season</h2>${table(['Season','Fantasy Ends','Player-Seasons','Players w/ Injury Miss','Injury Missed','Susp.','Other / Unknown','Reported Injury Weeks'],seasons.slice().sort((a,b)=>b.Season-a.Season).map(x=>`<tr><td><strong>${x.Season}</strong></td><td>Week ${x.FantasyEndWeek}</td><td>${x.PlayerSeasons}</td><td>${x.PlayersWithInjuryMiss}</td><td><strong>${x.InjuryGamesMissed}</strong></td><td>${x.SuspensionGamesMissed||0}</td><td>${x.OtherOrUnknownGamesMissed||0}</td><td>${x.ReportedInjuryWeeks||0}</td></tr>`))}</div>`;
      const drawSeason=()=>{
        const y=Number($('#injurySeason').value);
        const xs=players.filter(x=>Number(x.Season)===y).sort((a,b)=>Number(b.InjuryGamesMissed||0)-Number(a.InjuryGamesMissed||0)||Number(a.OverallPick||999)-Number(b.OverallPick||999));
        $('#injurySeasonPanel').innerHTML=`<div class="card"><h2>${y} Player Availability</h2>${table(['Player','Eligible Games','Played','Injury Missed','Susp.','Other / Unknown','Injury','Quality'],xs.map(x=>`<tr><td>${playerCell(x)}</td><td>${x.EligibleFantasySeasonGames}</td><td>${x.GamesPlayed}</td><td><strong>${x.InjuryGamesMissed}</strong>${x.InjuryMissedWeeks?.length?`<br><span class="muted">W${x.InjuryMissedWeeks.join(', W')}</span>`:''}</td><td>${x.SuspensionGamesMissed||0}</td><td>${x.OtherOrUnknownGamesMissed||0}</td><td>${esc((x.InjuryTypes||[]).join(', ')||'—')}</td><td>${qualityBadge(x.DataQuality)}</td></tr>`))}</div>`;
      };
      $('#injurySeason').addEventListener('change',drawSeason);drawSeason();
    }
    if(tab==='busts'){
      const bust=(A.injuryBusts||[]).map((x,i)=>`<tr><td>${i+1}</td><td>${x.Season}</td><td>${playerCell(x)}</td><td><strong>${x.InjuryGamesMissed}</strong></td><td>${esc((x.InjuryTypes||[]).join(', ')||'—')}</td><td>${fmt(x.ActualPoints,1)}</td><td>${fmt(x.ExpectedSlotPoints,1)}</td><td class="bad"><strong>${signed(x.DraftValue)}</strong></td></tr>`);
      const iron=(A.ironMen||[]).slice(0,40).map((x,i)=>`<tr><td>${i+1}</td><td>${x.Season}</td><td>${playerCell(x)}</td><td>${x.GamesPlayed}/${x.EligibleFantasySeasonGames}</td><td class="good"><strong>${signed(x.DraftValue)}</strong></td></tr>`);
      panel.innerHTML=`<div class="grid-2"><div class="card"><h2>Injury-Driven Draft Busts</h2><p class="muted">Negative slot value with at least two injury-supported missed games.</p>${table(['#','Year','Player','Injury Missed','Injury','Actual','Expected','Draft Value'],bust)}</div><div class="card"><h2>Iron-Men Steals</h2><p class="muted">Positive-value picks that did not miss an eligible fantasy-season NFL game.</p>${table(['#','Year','Player','Played / Eligible','Draft Value'],iron)}</div></div>`;
    }
    if(tab==='all'){
      const rows=players.slice().sort((a,b)=>b.Season-a.Season||Number(b.InjuryGamesMissed||0)-Number(a.InjuryGamesMissed||0)).map(x=>`<tr><td>${x.Season}</td><td>${playerCell(x)}</td><td>${x.EligibleFantasySeasonGames}</td><td>${x.GamesPlayed}</td><td><strong>${x.InjuryGamesMissed}</strong></td><td>${x.SuspensionGamesMissed||0}</td><td>${x.OtherOrUnknownGamesMissed||0}</td><td>${x.InjuryWeeks||0}</td><td>${qualityBadge(x.DataQuality)}</td></tr>`);
      panel.innerHTML=`<div class="card"><h2>All Drafted Player-Seasons</h2>${table(['Year','Player','Eligible','Played','Injury Missed','Susp.','Other / Unknown','Injury Weeks','Quality'],rows)}</div>`;
    }
    if(tab==='method'){
      const m=A.methodology||{};
      panel.innerHTML=`<div class="grid-2"><div class="card"><h2>Counting Rules</h2><p><strong>Fantasy window:</strong> ${esc(m.fantasyWindow||'Saved fantasy season window.')}</p><p><strong>Bye weeks:</strong> ${esc(m.byeWeeks||'Excluded.')}</p><p><strong>NFL postseason:</strong> ${esc(m.nflPostseason||'Excluded.')}</p><p><strong>Participation:</strong> ${esc(m.participation||'Weekly participation data.')}</p></div><div class="card"><h2>Absence Classification</h2><p><strong>Injury:</strong> ${esc(m.injuryClassification||'Requires injury evidence.')}</p><p><strong>Non-injury:</strong> ${esc(m.nonInjury||'Kept separate.')}</p><p class="muted">This is deliberately conservative: if the data cannot support calling an absence an injury, the site does not label it one.</p></div></div>${A.unmapped?.length?`<div class="card section-gap"><h2>Unmapped Draft Player-Seasons</h2><p class="muted">${A.unmapped.length} draft entries could not be joined to an NFL player ID and are excluded from injury totals.</p></div>`:''}`;
    }
  };
  document.querySelectorAll('#injuryTabs button').forEach(b=>b.addEventListener('click',()=>draw(b.dataset.tab)));
  draw('career');
  setStatus(`Injury model v2 • ${players.length} player-seasons • bye weeks and NFL playoffs excluded`,'good');
}

function renderRules(){
  setHeader('League Rules','2026 Lakelands Fantasy League settings and scoring reference.');

  const rows=(items)=>items.map(([a,b,c])=>`<tr><td><strong>${esc(a)}</strong></td><td>${esc(b)}</td>${c!==undefined?`<td>${esc(c)}</td>`:''}</tr>`).join('');
  const two=(title,items,note='')=>`<details class="rules-section" open><summary>${esc(title)}</summary>${note?`<p class="muted rules-note">${esc(note)}</p>`:''}<div class="table-wrap"><table class="table rules-table"><thead><tr><th>Rule</th><th>Setting</th></tr></thead><tbody>${rows(items)}</tbody></table></div></details>`;
  const three=(title,items,headers=['Position','Starters','Maximum'])=>`<details class="rules-section"><summary>${esc(title)}</summary><div class="table-wrap"><table class="table rules-table"><thead><tr>${headers.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows(items)}</tbody></table></div></details>`;
  const score=(title,items)=>two(title,items);

  $('#content').innerHTML=`
    <div class="hero"><h2>Lakelands Fantasy League (LFL)</h2><p>This is a quick-reference snapshot of the league's <strong>2026 ESPN settings</strong>. Historical seasons may have used different rules, so these settings are not automatically applied backward to 2013–2025 analytics.</p></div>

    <div class="metrics">
      ${metric('Teams','12')}
      ${metric('Scoring','Head-to-Head PPR')}
      ${metric('Regular season','14 matchups')}
      ${metric('Playoff teams','6')}
    </div>

    <div class="rules-grid">
      ${two('League Format',[
        ['League name','Lakelands Fantasy League (LFL)'],
        ['Number of teams','12'],
        ['Scoring type','Head to Head Points, Point Per Reception'],
        ['Format','League Manager'],
        ['League viewable to public','No'],
        ['Auto reactivate','No'],
        ['Lineup protection','Off']
      ])}

      ${two('Draft',[
        ['Draft type','Snake'],
        ['Draft date','Sep 5, 2026 @ 6:30 PM EDT'],
        ['Time per pick','90 seconds'],
        ['Draft order','Manually set by League Manager'],
        ['Draft-pick trading','No']
      ])}

      ${two('Roster Summary',[
        ['Roster size','16'],
        ['Total starters','9'],
        ['Bench','7'],
        ['Injured reserve','1']
      ])}

      ${three('Roster Positions',[
        ['Quarterback (QB)','1','4'],
        ['Running Back (RB)','2','8'],
        ['Wide Receiver (WR)','2','8'],
        ['Tight End (TE)','1','3'],
        ['Flex (FLEX)','1','N/A'],
        ['Team Defense/Special Teams (D/ST)','1','3'],
        ['Place Kicker (K)','1','3'],
        ['Bench (BE)','7','N/A'],
        ['Injured Reserve (IR)','1','N/A']
      ])}

      ${two('Player / Waiver Rules',[
        ["ESPN undroppable list",'Yes'],
        ['Player universe','NFL'],
        ['Lineup changes','Lock individually at scheduled gametime'],
        ['Acquisition system','Waivers'],
        ['Season acquisition limit','No limit'],
        ['Waiver period','1 day'],
        ['Waiver order','Reset each week to inverse order of standings'],
        ['Eliminated-team transactions','Not locked during playoffs']
      ])}

      ${two('Trades',[
        ['Trade limit','No limit'],
        ['Trade deadline','Dec 4, 2026 @ 3:00 AM EST'],
        ['Trade review period','1 day'],
        ['Trade veto','League Manager only']
      ])}

      ${two('Keepers',[
        ['Use keepers for 2026','No'],
        ['Use keepers for 2027','No']
      ])}

      ${two('Regular Season',[
        ['Start','NFL Week 1'],
        ['Weeks per matchup','1'],
        ['Regular-season matchups','14'],
        ['Matchup tiebreaker','None'],
        ['Home-field advantage','None'],
        ['Bonus wins/losses','No']
      ])}

      ${two('Playoffs',[
        ['Playoff teams','6'],
        ['Round 1','1 week'],
        ['Round 2','1 week'],
        ['Championship round','1 week'],
        ['Seeding tiebreaker','Total Points For'],
        ['Home-field advantage','None'],
        ['Bracket reseeding','Off'],
        ['Eliminated-team transactions','Not locked'],
        ['Consolation ladder','Yes']
      ])}
    </div>

    <div class="card section-gap"><h2>Scoring</h2><p class="muted">Expand each category for the exact 2026 ESPN scoring values.</p>
      ${score('Passing',[
        ['Passing Yards (PY)','0.05 per yard'],['TD Pass (PTD)','4'],['Interceptions Thrown (INT)','-2'],['2pt Passing Conversion (2PC)','2'],['300–399 passing yards (P300)','3'],['400+ passing yards (P400)','4']
      ])}
      ${score('Rushing',[
        ['Rushing Yards (RY)','0.1 per yard'],['TD Rush (RTD)','6'],['2pt Rushing Conversion (2PR)','2'],['100–199 rushing yards (RY100)','3'],['200+ rushing yards (RY200)','4']
      ])}
      ${score('Receiving',[
        ['Receiving Yards (REY)','0.1 per yard'],['Reception (REC)','1'],['TD Reception (RETD)','6'],['2pt Receiving Conversion (2PRE)','2'],['100–199 receiving yards (REY100)','3'],['200+ receiving yards (REY200)','4']
      ])}
      ${score('Kicking',[
        ['PAT Made (PAT)','1'],['Field Goal Missed (FGM)','-1'],['FG Made 0–39 yards (FG0)','3'],['FG Made 40–49 yards (FG40)','4'],['FG Made 50–59 yards (FG50)','6'],['FG Made 60+ yards (FG60)','6']
      ])}
      ${score('Defense / Special Teams',[
        ['Kickoff Return TD (KRTD)','6'],['Punt Return TD (PRTD)','6'],['Interception Return TD (INTTD)','6'],['Fumble Return TD (FRTD)','6'],['Blocked Punt/FG Return TD (BLKKRTD)','6'],['Sack (SK)','1'],['Blocked Punt/PAT/FG (BLKK)','2'],['Interception (INT)','2'],['Fumble Recovered (FR)','2'],['Safety (SF)','2'],['0 points allowed (PA0)','7'],['1–6 points allowed (PA1)','5'],['7–13 points allowed (PA7)','3'],['14–17 points allowed (PA14)','1'],['28–34 points allowed (PA28)','-1'],['35–45 points allowed (PA35)','-3'],['46+ points allowed (PA46)','-5'],['<100 total yards allowed (YA100)','5'],['100–199 yards allowed (YA199)','3'],['200–299 yards allowed (YA299)','2'],['400–449 yards allowed (YA449)','-1'],['450–499 yards allowed (YA499)','-3'],['500–549 yards allowed (YA549)','-5'],['550+ yards allowed (YA550)','-7']
      ])}
      ${score('Miscellaneous',[
        ['Kickoff Return TD (KRTD)','6'],['Punt Return TD (PRTD)','6'],['Fumble Recovered for TD (FTD)','6'],['Fumbles Lost (FUML)','-2'],['Interception Return TD (INTTD)','6'],['Fumble Return TD (FRTD)','6'],['Blocked Punt/FG Return TD (BLKKRTD)','6']
      ])}
    </div>

    <div class="grid-2 section-gap">
      <div class="card"><h2>2026 Divisions</h2>
        <div class="division-grid">
          <div><h3>East</h3><p>PocketAces<br>hairy butt<br>The Flock<br>The Schwappaports<br>Jeanty's Hammer<br>The Money Team</p></div>
          <div><h3>West</h3><p>Click Clack<br>I love big TD's<br>Team Man clan<br>Big Puppy<br>The Losers<br>The Wagon</p></div>
        </div>
      </div>
      <div class="card"><h2>Rules Notes</h2><div class="feature-list">
        <div class="feature"><strong>Current snapshot</strong><span class="muted">These settings were copied from ESPN for the 2026 season.</span></div>
        <div class="feature"><strong>Historical accuracy</strong><span class="muted">If older seasons used different scoring, roster, waiver or playoff rules, we should add a rules-history timeline rather than assume today's settings.</span></div>
        <div class="feature"><strong>League-specific constitution</strong><span class="muted">Any off-ESPN rules, dues, payouts, punishments, side rules or commissioner procedures can be added here too.</span></div>
      </div></div>
    </div>`;
  setStatus('2026 league rules loaded','good');
}

function renderData(){
  setHeader('Data Health','What is complete, enriched, live or still waiting on source recovery.');
  const draft=DATA.draftAnalytics||{}, injury=DATA.injuryAnalytics||{}, trade=DATA.tradeAnalytics||{};
  const items=[
    ['Historical seasons 2013–2025','Complete','good'],
    ['Teams / standings','Complete','good'],
    ['Historical matchups','Complete','good'],
    ['Manager aliases / franchise identity','Known merges applied','good'],
    ['Draft picks','Complete IDs + names','good'],
    ['Draft actual season points',`${draft.coveragePct??'—'}% coverage`,Number(draft.coveragePct)>=99?'good':'warn'],
    ['Draft Lab value model',draft.topSteals?.length?'Live':'Pending',draft.topSteals?.length?'good':'warn'],
    ['Live 2026 matchups / standings / rosters','Server-side ESPN connection','good'],
    ['Historical individual trades',(trade.trades||[]).length?`${trade.trades.length} recovered`:'Historical pull currently 0',(trade.trades||[]).length?'good':'warn'],
    ['Injury / availability enrichment',(injury.players||[]).length?`${injury.players.length} player-season rows`:'Pending',(injury.players||[]).length?'good':'warn'],
    ['League rules','2026 settings loaded','good']
  ];
  $('#content').innerHTML=`<div class="card"><h2>Coverage Matrix</h2>${table(['Dataset','Status','Coverage'],items.map(x=>`<tr><td><strong>${x[0]}</strong></td><td><span class="badge ${x[2]}">${x[1]}</span></td><td>${x[2]==='good'?'Ready':'Next work item'}</td></tr>`))}</div>
  <div class="hero" style="margin-top:16px"><h2>Provenance first</h2><p>The site keeps raw ESPN history intact and applies identity cleanup as a transparent presentation layer. Trade rankings remain hidden until the actual historical packages are recovered.</p></div>`;
}

const pages={home:renderHome,live:renderLive,history:renderHistory,managers:renderManagers,rivalries:renderRivalries,records:renderRecords,draft:renderDraft,trades:renderTrades,injuries:renderInjuries,rules:renderRules,data:renderData};
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
