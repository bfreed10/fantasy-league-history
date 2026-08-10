
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
  setHeader('League Overview','The LFL trophy case, all-time leaders, and live 2026 gateway.');

  const franchises=franchiseStats();
  const champions=[...(DATA?.champions||[])].sort((a,b)=>Number(a.season)-Number(b.season));
  const defending=champions.at(-1);
  const bestScore=DATA?.records?.highestScores?.[0];
  const topTitles=[...franchises].sort((a,b)=>b.titles-a.titles||b.wins-a.wins||b.pointsFor-a.pointsFor)[0];
  const maxWins=Math.max(1,...franchises.map(x=>x.wins));
  const activeFranchises=franchises.filter(f=>f.lastSeason===2025).length || 12;

  const runningTitles=new Map();
  const bannerData=champions.map(c=>{
    const id=championTeamId(c);
    const n=(runningTitles.get(id)||0)+1;
    runningTitles.set(id,n);
    return {...c,id,titleNumber:n};
  }).reverse();

  const trophyLeaders=[...franchises]
    .filter(f=>f.titles>0)
    .sort((a,b)=>b.titles-a.titles||b.wins-a.wins||b.pointsFor-a.pointsFor);

  const trophyLeaderHtml=trophyLeaders.slice(0,6).map((f,i)=>`
    <div class="trophy-row">
      <div class="trophy-rank">${i+1}</div>
      <div class="trophy-team">
        <strong>${esc(f.currentTeam)}</strong>
        <span>${esc(f.currentManager)}</span>
      </div>
      <div class="trophy-stars" aria-label="${f.titles} championships">${'★'.repeat(f.titles)}</div>
      <strong class="trophy-count">${f.titles}</strong>
    </div>`).join('');

  const bannerHtml=bannerData.map((c,i)=>{
    const totalForFranchise=franchises.find(f=>f.id===c.id)?.titles||1;
    const record=(c.wins!=null&&c.losses!=null)?`${c.wins}-${c.losses}`:'';
    const titleLabel=totalForFranchise>1?`Title ${c.titleNumber} of ${totalForFranchise}`:'Champion';
    return `<article class="championship-banner ${i===0?'defending-banner':''}">
      <div class="banner-topline">
        <span class="banner-year">${esc(c.season)}</span>
        <span class="banner-crown">${i===0?'DEFENDING CHAMPION':'LFL CHAMPION'}</span>
      </div>
      <div class="banner-trophy">★</div>
      <h3>${esc(cleanTeam(c.team))}</h3>
      <p>${esc(canonicalOwner(c.owner))}</p>
      <div class="banner-footer">
        <span>${esc(titleLabel)}</span>
        ${record?`<strong>${esc(record)}</strong>`:''}
      </div>
    </article>`;
  }).join('');

  $('#content').innerHTML=`
    <section class="league-hero">
      <div class="league-hero-main">
        <div class="hero-eyebrow">LAKELANDS FANTASY LEAGUE • EST. 2013</div>
        <h2>13 seasons of history.<br><span>One trophy case.</span></h2>
        <p>Every completed season, franchise record, rivalry, draft class and league record in one place — with the 2026 season connected live to ESPN.</p>
        <div class="hero-actions">
          <button class="hero-action primary" onclick="navigate('live')">Open Live 2026</button>
          <button class="hero-action" onclick="navigate('draft')">Explore Draft Lab</button>
          <button class="hero-action" onclick="navigate('managers')">All-Time Leaders</button>
        </div>
      </div>
      <div class="defending-champ-card">
        <div class="defending-kicker">DEFENDING CHAMPION</div>
        <div class="defending-year">${esc(defending?.season||'2025')}</div>
        <div class="defending-star">★</div>
        <strong>${esc(cleanTeam(defending?.team||'—'))}</strong>
        <span>${esc(canonicalOwner(defending?.owner||''))}</span>
        ${defending?.wins!=null?`<div class="defending-record">${esc(defending.wins)}-${esc(defending.losses)} season record</div>`:''}
      </div>
    </section>

    <div class="metrics home-metrics">
      ${metric('Completed seasons',String(champions.length||13),'2013–2025')}
      ${metric('Current franchises',String(activeFranchises),'2025 league field')}
      ${metric('Most championships',String(topTitles?.titles??'—'),topTitles?.currentTeam||'')}
      ${metric('Record weekly score',bestScore?fmt(bestScore.highScore,2):'—',bestScore?`${bestScore.season} Week ${bestScore.week}`:'')}
    </div>

    <section class="home-section-head">
      <div>
        <span class="section-eyebrow">THE TROPHY CASE</span>
        <h2>Championship Wall</h2>
        <p>Every verified LFL champion from the inaugural 2013 season through 2025.</p>
      </div>
      <span class="championship-total">${champions.length} TITLES AWARDED</span>
    </section>
    <div class="championship-wall">${bannerHtml}</div>

    <div class="grid-2 home-bottom-grid">
      <div class="card trophy-card">
        <div class="card-heading-row">
          <div><span class="section-eyebrow">LEGACY</span><h2>Championship Leaders</h2></div>
          <span class="mini-trophy">★</span>
        </div>
        <div class="trophy-table">${trophyLeaderHtml}</div>
      </div>

      <div class="card">
        <div class="card-heading-row">
          <div><span class="section-eyebrow">LONGEVITY</span><h2>All-Time Wins</h2></div>
          <span class="muted">Franchise totals</span>
        </div>
        ${franchises.slice(0,8).map((f,i)=>`<div class="bar-row home-win-row">
          <span><strong>${i+1}.</strong> ${esc(f.currentTeam)}</span>
          <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,f.wins/maxWins*100)}%"></div></div>
          <strong>${f.wins} W</strong>
        </div>`).join('')}
      </div>
    </div>

    <div class="home-footer-note">
      <span>Franchise history is grouped by ESPN Team ID so name and account changes do not split career totals.</span>
      <button onclick="navigate('data')">View Data Health →</button>
    </div>`;

  setStatus('LFL history loaded','good');
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

function draftPlayerCareers(picks){
  const map=new Map();
  for(const p of picks||[]){
    const name=String(p['Player Name']||'Unknown').trim(), pid=Number(p['Player ID']);
    const key=Number.isFinite(pid)&&pid>0?`id:${pid}`:`name:${name.toLowerCase()}`;
    if(!map.has(key))map.set(key,{key,PlayerID:Number.isFinite(pid)?pid:null,Player:name,positions:new Map(),seasons:new Set(),picks:[],franchises:new Map(),valueTotal:0,valueCount:0,bestValue:null,worstValue:null});
    const x=map.get(key), pos=String(p.Position||'—');
    x.Player=name||x.Player;x.positions.set(pos,(x.positions.get(pos)||0)+1);x.seasons.add(Number(p.Season));x.picks.push(p);
    const id=teamId(p['Team ID']);if(id!=null){if(!x.franchises.has(id))x.franchises.set(id,[]);x.franchises.get(id).push(p);}
    if(p.ValueAboveSlot!=null){const v=Number(p.ValueAboveSlot);x.valueTotal+=v;x.valueCount++;x.bestValue=x.bestValue==null?v:Math.max(x.bestValue,v);x.worstValue=x.worstValue==null?v:Math.min(x.worstValue,v);}
  }
  return [...map.values()].map(x=>{
    const overall=x.picks.map(p=>Number(p['Overall Pick'])).filter(Number.isFinite), rounds=x.picks.map(p=>Number(p.Round)).filter(Number.isFinite);
    const fav=[...x.franchises.entries()].sort((a,b)=>b[1].length-a[1].length||a[0]-b[0])[0];
    const pos=[...x.positions.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]||'—';
    return {...x,Position:pos,TimesDrafted:x.picks.length,Seasons:x.seasons.size,AvgPick:overall.length?overall.reduce((a,b)=>a+b,0)/overall.length:null,EarliestPick:overall.length?Math.min(...overall):null,LatestPick:overall.length?Math.max(...overall):null,AvgRound:rounds.length?rounds.reduce((a,b)=>a+b,0)/rounds.length:null,AvgValue:x.valueCount?x.valueTotal/x.valueCount:null,TotalValue:x.valueCount?x.valueTotal:null,FavoriteTeamId:fav?.[0]??null,FavoriteTeamCount:fav?.[1]?.length??0,FranchiseCount:x.franchises.size};
  }).sort((a,b)=>b.TimesDrafted-a.TimesDrafted||(a.AvgPick??999)-(b.AvgPick??999)||a.Player.localeCompare(b.Player));
}
function draftFranchiseProfiles(picks,classes=[]){
  const map=new Map();
  for(const p of picks||[]){
    const id=teamId(p['Team ID']);if(id==null)continue;
    if(!map.has(id))map.set(id,{TeamID:id,seasons:new Set(),picks:[],values:[],steals:0,busts:0,positions:new Map(),players:new Map(),firstRound:0});
    const x=map.get(id);x.seasons.add(Number(p.Season));x.picks.push(p);if(Number(p.Round)===1)x.firstRound++;
    const pos=String(p.Position||'—');x.positions.set(pos,(x.positions.get(pos)||0)+1);
    const pk=Number(p['Player ID'])>0?`id:${p['Player ID']}`:`name:${String(p['Player Name']||'').toLowerCase()}`;
    if(!x.players.has(pk))x.players.set(pk,{name:p['Player Name']||'Unknown',picks:[]});x.players.get(pk).picks.push(p);
    if(p.ValueAboveSlot!=null){const v=Number(p.ValueAboveSlot);x.values.push(v);if(v>=35)x.steals++;if(v<=-35)x.busts++;}
  }
  return [...map.values()].map(x=>{
    const pos=[...x.positions.entries()].sort((a,b)=>b[1]-a[1])[0];
    const repeat=[...x.players.values()].sort((a,b)=>b.picks.length-a.picks.length||a.name.localeCompare(b.name))[0];
    const cls=classes.filter(c=>teamId(c['Team ID'])===x.TeamID), aClasses=cls.filter(c=>String(c.Grade||'').startsWith('A')).length;
    const total=x.values.reduce((a,b)=>a+b,0);
    return {...x,Team:latestTeamById(x.TeamID),Manager:latestManagerById(x.TeamID),Seasons:x.seasons.size,GradedPicks:x.values.length,AvgValue:x.values.length?total/x.values.length:null,TotalValue:x.values.length?total:null,StealRate:x.values.length?x.steals/x.values.length:0,BustRate:x.values.length?x.busts/x.values.length:0,FavoritePosition:pos?.[0]||'—',FavoritePositionCount:pos?.[1]||0,MostDraftedPlayer:repeat?.name||'—',MostDraftedPlayerCount:repeat?.picks.length||0,AClasses:aClasses};
  }).sort((a,b)=>(b.AvgValue??-999)-(a.AvgValue??-999));
}
function repeatDraftees(picks){
  const players=draftPlayerCareers(picks), out=[];
  for(const p of players){
    for(const [id,ps] of p.franchises.entries()){
      if(ps.length<2)continue;
      const nums=ps.map(x=>Number(x['Overall Pick'])).filter(Number.isFinite), vals=ps.map(x=>x.ValueAboveSlot==null?null:Number(x.ValueAboveSlot)).filter(x=>x!=null);
      out.push({Player:p.Player,Position:p.Position,TeamID:id,Count:ps.length,Years:ps.map(x=>Number(x.Season)).sort((a,b)=>a-b),AvgPick:nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:null,AvgValue:vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null,BestValue:vals.length?Math.max(...vals):null});
    }
  }
  return out.sort((a,b)=>b.Count-a.Count||(a.AvgPick??999)-(b.AvgPick??999)||a.Player.localeCompare(b.Player));
}

function renderDraft(){
  setHeader('Draft Lab','Draft boards, franchise tendencies, career ADP and pick-value analytics across 2013–2025.');
  const A=DATA.draftAnalytics||{}, picks=A.picks||[];
  if(!picks.length){ $('#content').innerHTML='<div class="empty">Draft analytics have not been built yet.</div>'; return; }
  const years=[...new Set(picks.map(x=>Number(x.Season)).filter(Boolean))].sort((a,b)=>b-a);
  const positions=[...new Set(picks.map(x=>x.Position).filter(Boolean))].sort();
  const playerCareers=draftPlayerCareers(picks), profiles=draftFranchiseProfiles(picks,A.classes||[]), repeats=repeatDraftees(picks);
  const top=(A.topSteals||[])[0]||picks.filter(x=>x.ValueAboveSlot!=null).sort((a,b)=>Number(b.ValueAboveSlot)-Number(a.ValueAboveSlot))[0];
  const best=(A.bestClasses||[])[0];
  const coverage=A.coveragePct!=null?Number(A.coveragePct):picks.filter(x=>x.ValueAboveSlot!=null).length/picks.length*100;
  $('#content').innerHTML=`
    <div class="metrics">
      ${metric('Draft picks',fmt(A.totalPicks||picks.length),`${years.at(-1)}–${years[0]}`)}
      ${metric('Pick-value coverage',`${fmt(coverage,1)}%`,`${fmt(A.gradedPicks||picks.filter(x=>x.ValueAboveSlot!=null).length)} graded picks`)}
      ${metric('Biggest steal',top?top['Player Name']:'—',top?`${top.Season} • Pick ${top['Overall Pick']} • ${signed(top.ValueAboveSlot)} pts`:'')}
      ${metric('Most re-drafted',playerCareers[0]?.Player||'—',playerCareers[0]?`${playerCareers[0].TimesDrafted} league drafts • ADP ${fmt(playerCareers[0].AvgPick,1)}`:'')}
    </div>
    <div class="hero"><h2>Draft history, not just draft grades.</h2><p><strong>Slot Value = actual season fantasy points − historical expected points at that overall pick.</strong> The expanded lab also tracks every season's board, each franchise's drafting DNA, league-wide career ADP, repeat-player loyalty, and full pick histories. Negative slot value can be injury-driven, so “bust” here means draft-slot outcome rather than a judgment about the player.</p></div>
    <div class="tabs" id="draftTabs">
      <button class="active" data-tab="steals">Steals & Busts</button>
      <button data-tab="board">Draft Board</button>
      <button data-tab="classes">Draft Classes</button>
      <button data-tab="franchises">Franchise Profiles</button>
      <button data-tab="adp">Career ADP</button>
      <button data-tab="loyalty">Repeat Draftees</button>
      <button data-tab="positions">Position / Round</button>
      <button data-tab="all">All Picks</button>
    </div><div id="draftPanel"></div>`;
  const panel=$('#draftPanel');
  const playerCell=x=>`<strong>${esc(x['Player Name']||x.Player||'Unknown')}</strong><br><span class="muted">${esc(x.Position||'')} ${x.Season?`• ${x.Season}`:''}${x['Overall Pick']?` • Pick ${x['Overall Pick']}`:''}</span>`;
  const pickValue=x=>x.ValueAboveSlot==null?'—':`<span class="${valueTone(x.ValueAboveSlot)}"><strong>${signed(x.ValueAboveSlot)}</strong></span>`;
  const stealRows=(A.topSteals||picks.filter(x=>Number(x.ValueAboveSlot)>=35).sort((a,b)=>b.ValueAboveSlot-a.ValueAboveSlot)).slice(0,25).map((x,i)=>`<tr><td>${i+1}</td><td>${playerCell(x)}</td><td>${fmt(x.ActualPoints,1)}</td><td>${fmt(x.ExpectedSlotPoints,1)}</td><td class="good"><strong>${signed(x.ValueAboveSlot)}</strong></td><td>${displayFranchise(x['Team ID'],x['Team Name'],x['Owner(s)'])}</td></tr>`);
  const bustRows=(A.topBusts||picks.filter(x=>Number(x.ValueAboveSlot)<=-35).sort((a,b)=>a.ValueAboveSlot-b.ValueAboveSlot)).slice(0,25).map((x,i)=>`<tr><td>${i+1}</td><td>${playerCell(x)}</td><td>${fmt(x.ActualPoints,1)}</td><td>${fmt(x.ExpectedSlotPoints,1)}</td><td class="bad"><strong>${signed(x.ValueAboveSlot)}</strong></td><td>${displayFranchise(x['Team ID'],x['Team Name'],x['Owner(s)'])}</td></tr>`);

  const renderTab=tab=>{
    document.querySelectorAll('#draftTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    if(tab==='steals'){
      const bestFranchises=profiles.slice(0,8).map((x,i)=>`<tr><td>${i+1}</td><td>${displayFranchise(x.TeamID,x.Team,x.Manager)}</td><td>${x.GradedPicks}</td><td class="${valueTone(x.AvgValue)}"><strong>${signed(x.AvgValue)}</strong></td><td>${fmt(x.StealRate*100,1)}%</td><td>${x.AClasses}</td></tr>`);
      panel.innerHTML=`<div class="grid-2"><div class="card"><h2>Biggest Steals</h2>${table(['#','Player','Actual','Expected','Value','Franchise'],stealRows)}</div><div class="card"><h2>Biggest Slot-Value Busts</h2>${table(['#','Player','Actual','Expected','Value','Franchise'],bustRows)}</div></div><div class="card section-gap"><h2>Best Drafting Franchises by Average Pick Value</h2><p class="muted">Uses all graded picks across the franchise's history.</p>${table(['#','Franchise / Manager','Graded Picks','Avg Value / Pick','Steal %','A Classes'],bestFranchises)}</div>`;
    }
    if(tab==='board'){
      panel.innerHTML=`<div class="controls"><label>Season <select id="boardSeason">${years.map(y=>`<option>${y}</option>`).join('')}</select></label></div><div id="draftBoard"></div>`;
      const draw=()=>{
        const y=Number($('#boardSeason').value), ys=picks.filter(x=>Number(x.Season)===y).sort((a,b)=>Number(a['Overall Pick'])-Number(b['Overall Pick']));
        const firstByTeam=new Map();for(const p of ys){const id=teamId(p['Team ID']);if(id!=null&&!firstByTeam.has(id))firstByTeam.set(id,Number(p['Overall Pick']));}
        const ids=[...firstByTeam.entries()].sort((a,b)=>a[1]-b[1]).map(x=>x[0]);
        const maxRound=Math.max(...ys.map(x=>Number(x.Round)||0));
        const cells=new Map();for(const p of ys){const key=`${p.Round}|${teamId(p['Team ID'])}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(p);}
        const rows=[];for(let r=1;r<=maxRound;r++)rows.push(`<tr><td><strong>${r}</strong></td>${ids.map(id=>{const xs=cells.get(`${r}|${id}`)||[];return `<td>${xs.map(p=>`<div style="min-width:125px"><strong>${esc(p['Player Name']||'Unknown')}</strong><br><span class="muted">#${p['Overall Pick']} • ${esc(p.Position||'')}</span><br>${pickValue(p)}</div>`).join('<hr>')||'—'}</td>`;}).join('')}</tr>`);
        const classes=(A.classes||[]).filter(x=>Number(x.Season)===y).sort((a,b)=>Number(b.RawScore||0)-Number(a.RawScore||0));
        $('#draftBoard').innerHTML=`<div class="card"><h2>${y} Draft Board</h2><p class="muted">Columns follow each franchise's first pick order; the board remains tied to stable franchise IDs even when team names changed.</p>${table(['Round',...ids.map(id=>latestTeamById(id))],rows)}</div><div class="card section-gap"><h2>${y} Draft Class Results</h2>${table(['#','Grade','Franchise / Manager','Picks','Avg Value','Total Value','Steal %','Bust %'],classes.map((x,i)=>`<tr><td>${i+1}</td><td><span class="badge ${gradeTone(x.Grade)}">${esc(x.Grade)}</span></td><td>${displayFranchise(x['Team ID'],x['Team Name'],x.Owner)}</td><td>${x['Graded Picks']}/${x.Picks}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${fmt(x.HitRatePct,1)}%</td><td>${fmt(x.BustRatePct,1)}%</td></tr>`))}</div>`;
      };$('#boardSeason').addEventListener('change',draw);draw();
    }
    if(tab==='classes'){
      panel.innerHTML=`<div class="controls"><label>Season <select id="classSeason">${years.map(y=>`<option>${y}</option>`).join('')}</select></label></div><div id="classTable"></div><div class="grid-2 section-gap"><div class="card"><h2>Best Classes Ever</h2>${table(['Year','Grade','Franchise / Manager','Avg Value','Total Value','Coverage'],(A.bestClasses||[]).slice(0,20).map(x=>`<tr><td>${x.Season}</td><td><span class="badge ${gradeTone(x.Grade)}">${esc(x.Grade)}</span></td><td>${displayFranchise(x['Team ID'],x['Team Name'],x.Owner)}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${fmt(x.CoveragePct,1)}%</td></tr>`))}</div><div class="card"><h2>Worst Classes Ever</h2>${table(['Year','Grade','Franchise / Manager','Avg Value','Total Value','Coverage'],(A.worstClasses||[]).slice(0,20).map(x=>`<tr><td>${x.Season}</td><td><span class="badge ${gradeTone(x.Grade)}">${esc(x.Grade)}</span></td><td>${displayFranchise(x['Team ID'],x['Team Name'],x.Owner)}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${fmt(x.CoveragePct,1)}%</td></tr>`))}</div></div>`;
      const draw=()=>{const y=Number($('#classSeason').value);const rows=(A.classes||[]).filter(x=>Number(x.Season)===y).sort((a,b)=>Number(b.RawScore||0)-Number(a.RawScore||0)).map((x,i)=>`<tr><td>${i+1}</td><td><span class="badge ${gradeTone(x.Grade)}"><strong>${esc(x.Grade)}</strong></span></td><td>${displayFranchise(x['Team ID'],x['Team Name'],x.Owner)}</td><td>${x['Graded Picks']}/${x.Picks}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${fmt(x.HitRatePct,1)}%</td><td>${fmt(x.BustRatePct,1)}%</td></tr>`);$('#classTable').innerHTML=table(['#','Grade','Franchise / Manager','Graded','Avg Value','Total Value','Steal %','Bust %'],rows);};$('#classSeason').addEventListener('change',draw);draw();
    }
    if(tab==='franchises'){
      const ids=profiles.map(x=>x.TeamID).sort((a,b)=>latestTeamById(a).localeCompare(latestTeamById(b)));
      panel.innerHTML=`<div class="controls"><label>Franchise <select id="draftFranchise">${ids.map(id=>`<option value="${id}">${esc(latestTeamById(id))} — ${esc(latestManagerById(id))}</option>`).join('')}</select></label></div><div id="franchiseDraftPanel"></div><div class="card section-gap"><h2>Franchise Career Rankings</h2>${table(['#','Franchise / Manager','Seasons','Graded Picks','Avg Value','Total Value','Steal %','Bust %','A Classes'],profiles.map((x,i)=>`<tr><td>${i+1}</td><td>${displayFranchise(x.TeamID,x.Team,x.Manager)}</td><td>${x.Seasons}</td><td>${x.GradedPicks}</td><td class="${valueTone(x.AvgValue)}"><strong>${signed(x.AvgValue)}</strong></td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${fmt(x.StealRate*100,1)}%</td><td>${fmt(x.BustRate*100,1)}%</td><td>${x.AClasses}</td></tr>`))}</div>`;
      const draw=()=>{const id=Number($('#draftFranchise').value), prof=profiles.find(x=>x.TeamID===id), xs=picks.filter(x=>teamId(x['Team ID'])===id), vals=xs.filter(x=>x.ValueAboveSlot!=null);const bestP=[...vals].sort((a,b)=>b.ValueAboveSlot-a.ValueAboveSlot).slice(0,8), worstP=[...vals].sort((a,b)=>a.ValueAboveSlot-b.ValueAboveSlot).slice(0,8);const pos=[...prof.positions.entries()].sort((a,b)=>b[1]-a[1]);const rep=[...prof.players.values()].filter(x=>x.picks.length>1).sort((a,b)=>b.picks.length-a.picks.length||a.name.localeCompare(b.name)).slice(0,12);const cls=(A.classes||[]).filter(c=>teamId(c['Team ID'])===id).sort((a,b)=>b.Season-a.Season);$('#franchiseDraftPanel').innerHTML=`<div class="metrics">${metric('Career picks',prof.picks.length,`${prof.Seasons} seasons`)}${metric('Avg slot value',signed(prof.AvgValue),`${prof.GradedPicks} graded picks`)}${metric('Favorite position',prof.FavoritePosition,`${prof.FavoritePositionCount} selections`)}${metric('Most re-drafted',prof.MostDraftedPlayer,`${prof.MostDraftedPlayerCount} times`)}</div><div class="grid-2"><div class="card"><h2>Best Picks</h2>${table(['Year / Pick','Player','Value'],bestP.map(p=>`<tr><td>${p.Season} • #${p['Overall Pick']}</td><td>${playerCell(p)}</td><td class="good"><strong>${signed(p.ValueAboveSlot)}</strong></td></tr>`))}</div><div class="card"><h2>Worst Slot Outcomes</h2>${table(['Year / Pick','Player','Value'],worstP.map(p=>`<tr><td>${p.Season} • #${p['Overall Pick']}</td><td>${playerCell(p)}</td><td class="bad"><strong>${signed(p.ValueAboveSlot)}</strong></td></tr>`))}</div></div><div class="grid-2 section-gap"><div class="card"><h2>Position Tendencies</h2>${table(['Position','Picks','Share'],pos.map(([p,n])=>`<tr><td><strong>${esc(p)}</strong></td><td>${n}</td><td>${fmt(n/prof.picks.length*100,1)}%</td></tr>`))}</div><div class="card"><h2>Favorite Repeat Players</h2>${rep.length?table(['Player','Times','Years','Avg Pick'],rep.map(x=>{const nums=x.picks.map(p=>Number(p['Overall Pick']));return `<tr><td><strong>${esc(x.name)}</strong></td><td>${x.picks.length}</td><td>${x.picks.map(p=>p.Season).sort().join(', ')}</td><td>${fmt(nums.reduce((a,b)=>a+b,0)/nums.length,1)}</td></tr>`;})):'<p class="muted">No player was drafted by this franchise more than once.</p>'}</div></div><div class="card section-gap"><h2>Draft Classes by Year</h2>${table(['Year','Grade','Picks','Avg Value','Total Value','Steal %','Bust %'],cls.map(x=>`<tr><td>${x.Season}</td><td><span class="badge ${gradeTone(x.Grade)}">${esc(x.Grade)}</span></td><td>${x['Graded Picks']}/${x.Picks}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td class="${valueTone(x.TotalValue)}">${signed(x.TotalValue)}</td><td>${fmt(x.HitRatePct,1)}%</td><td>${fmt(x.BustRatePct,1)}%</td></tr>`))}</div>`;};$('#draftFranchise').addEventListener('change',draw);draw();
    }
    if(tab==='adp'){
      panel.innerHTML=`<div class="controls"><input id="adpSearch" placeholder="Search player"><select id="adpPos"><option value="">All positions</option>${positions.map(p=>`<option>${esc(p)}</option>`).join('')}</select><select id="adpTimes"><option value="1">Drafted at least once</option><option value="2">2+ drafts</option><option value="3">3+ drafts</option><option value="5">5+ drafts</option></select></div><div id="adpTable"></div>`;
      const draw=()=>{const q=$('#adpSearch').value.toLowerCase(),pos=$('#adpPos').value,min=Number($('#adpTimes').value);const xs=playerCareers.filter(x=>x.TimesDrafted>=min&&(!pos||x.Position===pos)&&(!q||x.Player.toLowerCase().includes(q))).slice(0,600);$('#adpTable').innerHTML=`<div class="card"><h2>League Career ADP</h2><p class="muted">ADP is calculated only from this LFL's historical drafts, not public ESPN ADP.</p>${table(['Player','Pos','Times Drafted','Seasons','Career ADP','Earliest','Latest','Avg Round','Most Loyal Franchise','Avg Value'],xs.map(x=>`<tr><td><strong>${esc(x.Player)}</strong></td><td>${esc(x.Position)}</td><td><strong>${x.TimesDrafted}</strong></td><td>${x.Seasons}</td><td><strong>${fmt(x.AvgPick,1)}</strong></td><td>#${x.EarliestPick}</td><td>#${x.LatestPick}</td><td>${fmt(x.AvgRound,1)}</td><td>${x.FavoriteTeamId!=null?`${displayFranchise(x.FavoriteTeamId)}<span class="muted">${x.FavoriteTeamCount} draft${x.FavoriteTeamCount===1?'':'s'}</span>`:'—'}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td></tr>`))}</div>`;};['adpSearch','adpPos','adpTimes'].forEach(id=>$('#'+id).addEventListener(id==='adpSearch'?'input':'change',draw));draw();
    }
    if(tab==='loyalty'){
      const topLeague=playerCareers.filter(x=>x.TimesDrafted>=2).slice(0,30);
      panel.innerHTML=`<div class="grid-2"><div class="card"><h2>League Favorites</h2><p class="muted">Players selected in the most separate LFL drafts, regardless of franchise.</p>${table(['#','Player','Pos','Times Drafted','Career ADP','Different Franchises'],topLeague.map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.Player)}</strong></td><td>${esc(x.Position)}</td><td>${x.TimesDrafted}</td><td>${fmt(x.AvgPick,1)}</td><td>${x.FranchiseCount}</td></tr>`))}</div><div class="card"><h2>Franchise Loyalty</h2><p class="muted">The same franchise drafting the same player in multiple seasons.</p>${table(['#','Player','Franchise / Manager','Times','Years','Avg Pick','Avg Value'],repeats.slice(0,40).map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.Player)}</strong><br><span class="muted">${esc(x.Position)}</span></td><td>${displayFranchise(x.TeamID)}</td><td><strong>${x.Count}</strong></td><td>${x.Years.join(', ')}</td><td>${fmt(x.AvgPick,1)}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td></tr>`))}</div></div>`;
    }
    if(tab==='positions'){
      const byProfile=profiles.map(x=>`<tr><td>${displayFranchise(x.TeamID)}</td><td>${esc(x.FavoritePosition)}</td><td>${x.FavoritePositionCount}</td><td>${fmt(x.FavoritePositionCount/x.picks.length*100,1)}%</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td></tr>`);
      panel.innerHTML=`<div class="grid-2"><div class="card"><h2>Value by Position</h2><p class="muted">Compared against the historical expectation for the same position and round.</p>${table(['Position','Picks','Actual','Expected','Value','Steal %','Bust %'],(A.positionValue||[]).map(x=>`<tr><td><strong>${esc(x.Position)}</strong></td><td>${x.Picks}</td><td>${fmt(x.AvgActual,1)}</td><td>${fmt(x.AvgExpected,1)}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td>${fmt(x.HitRatePct,1)}%</td><td>${fmt(x.BustRatePct,1)}%</td></tr>`))}</div><div class="card"><h2>Value by Round</h2>${table(['Round','Picks','Actual','Expected','Value','Steal %','Bust %'],(A.roundValue||[]).map(x=>`<tr><td><strong>${x.Round}</strong></td><td>${x.Picks}</td><td>${fmt(x.AvgActual,1)}</td><td>${fmt(x.AvgExpected,1)}</td><td class="${valueTone(x.AvgValue)}">${signed(x.AvgValue)}</td><td>${fmt(x.HitRatePct,1)}%</td><td>${fmt(x.BustRatePct,1)}%</td></tr>`))}</div></div><div class="card section-gap"><h2>Franchise Position DNA</h2>${table(['Franchise / Manager','Most Drafted Position','Picks','Share','Career Avg Value'],byProfile)}</div>`;
    }
    if(tab==='all'){
      panel.innerHTML=`<div class="controls"><input id="draftSearch" placeholder="Search player, manager or team"><select id="draftSeason"><option value="">All seasons</option>${years.map(y=>`<option>${y}</option>`).join('')}</select><select id="draftPos"><option value="">All positions</option>${positions.map(p=>`<option>${esc(p)}</option>`).join('')}</select></div><div id="draftTable"></div>`;
      const draw=()=>{const q=$('#draftSearch').value.toLowerCase(),sy=$('#draftSeason').value,pos=$('#draftPos').value;const xs=picks.filter(x=>(!sy||String(x.Season)===sy)&&(!pos||x.Position===pos)&&(!q||`${x['Player Name']} ${x['Team Name']} ${x['Owner(s)']} ${canonicalOwner(x['Owner(s)'])}`.toLowerCase().includes(q))).sort((a,b)=>Number(b.Season)-Number(a.Season)||Number(a['Overall Pick'])-Number(b['Overall Pick'])).slice(0,800);$('#draftTable').innerHTML=table(['Year','Pick','Rnd','Player','Pos','Franchise / Manager','Actual','Expected','Value'],xs.map(x=>`<tr><td>${x.Season}</td><td>${x['Overall Pick']}</td><td>${x.Round}</td><td><strong>${esc(x['Player Name']||'Unknown')}</strong></td><td>${esc(x.Position||'')}</td><td>${displayFranchise(x['Team ID'],x['Team Name'],x['Owner(s)'])}</td><td>${fmt(x.ActualPoints,1)}</td><td>${fmt(x.ExpectedSlotPoints,1)}</td><td>${pickValue(x)}</td></tr>`));};$('#draftSearch').addEventListener('input',draw);$('#draftSeason').addEventListener('change',draw);$('#draftPos').addEventListener('change',draw);draw();
    }
  };
  document.querySelectorAll('#draftTabs button').forEach(b=>b.addEventListener('click',()=>renderTab(b.dataset.tab)));renderTab('steals');
}


function transactionSummary(){
  const seasonMap=new Map(), franchiseMap=new Map();

  for(const x of DATA?.teams||[]){
    const season=Number(x.Season), id=teamId(x['Team ID']);
    const acquisitions=Number(x.Acquisitions||0);
    const drops=Number(x.Drops||0);
    const trades=Number(x.Trades||0);

    if(!seasonMap.has(season)) seasonMap.set(season,{Season:season,Acquisitions:0,Drops:0,TradeParticipations:0});
    const s=seasonMap.get(season);
    s.Acquisitions+=acquisitions;
    s.Drops+=drops;
    s.TradeParticipations+=trades;

    if(id!=null){
      if(!franchiseMap.has(id)) franchiseMap.set(id,{TeamID:id,Seasons:new Set(),Acquisitions:0,Drops:0,TradeParticipations:0,rows:[]});
      const f=franchiseMap.get(id);
      f.Seasons.add(season);
      f.Acquisitions+=acquisitions;
      f.Drops+=drops;
      f.TradeParticipations+=trades;
      f.rows.push({Season:season,Acquisitions:acquisitions,Drops:drops,Trades:trades,TeamName:cleanTeam(x['Team Name']),Owner:x['Owner(s)']});
    }
  }

  const seasons=[...seasonMap.values()].map(s=>({
    ...s,
    CompletedTrades:s.TradeParticipations/2,
    Activity:s.Acquisitions+s.TradeParticipations
  })).sort((a,b)=>a.Season-b.Season);

  const franchises=[...franchiseMap.values()].map(f=>({
    ...f,
    Seasons:f.Seasons.size,
    Team:latestTeamById(f.TeamID),
    Manager:latestManagerById(f.TeamID),
    Activity:f.Acquisitions+f.TradeParticipations,
    rows:f.rows.sort((a,b)=>a.Season-b.Season)
  })).sort((a,b)=>b.Activity-a.Activity||b.TradeParticipations-a.TradeParticipations);

  return {
    seasons,
    franchises,
    acquisitions:seasons.reduce((n,x)=>n+x.Acquisitions,0),
    drops:seasons.reduce((n,x)=>n+x.Drops,0),
    tradeParticipations:seasons.reduce((n,x)=>n+x.TradeParticipations,0),
    completedTrades:seasons.reduce((n,x)=>n+x.CompletedTrades,0)
  };
}

function tradeCountText(n){
  const v=Number(n||0);
  return Number.isInteger(v)?fmt(v):fmt(v,1);
}

function transactionBars(rows,key,labelKey,maxRows=12){
  const xs=[...rows].sort((a,b)=>Number(b[key]||0)-Number(a[key]||0)).slice(0,maxRows);
  const max=Math.max(1,...xs.map(x=>Number(x[key]||0)));
  return xs.map((x,i)=>`<div class="bar-row transaction-bar">
    <span><strong>${i+1}.</strong> ${esc(x[labelKey]||'—')}</span>
    <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100,Number(x[key]||0)/max*100)}%"></div></div>
    <strong>${fmt(x[key]||0)}</strong>
  </div>`).join('');
}


function renderTrades(){
  setHeader('Transactions & Trades','Historical roster activity, official ESPN trade counts, and the parked trade-package recovery in one hub.');

  const T=transactionSummary();
  const A=DATA.tradeAnalytics||{}, recovered=A.trades||[];
  const seasons=[...T.seasons].sort((a,b)=>b.Season-a.Season);
  const franchises=T.franchises;
  const busiest=[...T.seasons].sort((a,b)=>b.Acquisitions-a.Acquisitions)[0];
  const tradePeak=[...T.seasons].sort((a,b)=>b.CompletedTrades-a.CompletedTrades)[0];
  const acquisitionLeader=[...franchises].sort((a,b)=>b.Acquisitions-a.Acquisitions)[0];
  const tradeLeader=[...franchises].sort((a,b)=>b.TradeParticipations-a.TradeParticipations)[0];

  $('#content').innerHTML=`
    <div class="metrics">
      ${metric('Historical acquisitions',fmt(T.acquisitions),'ESPN team counters • 2013–2025')}
      ${metric('Completed trades',tradeCountText(T.completedTrades),`${fmt(T.tradeParticipations)} team participations`)}
      ${metric('Most active add season',busiest?.Season??'—',busiest?`${fmt(busiest.Acquisitions)} acquisitions`:'')}
      ${metric('Highest trade season',tradePeak?.Season??'—',tradePeak?`${tradeCountText(tradePeak.CompletedTrades)} completed trades`:'')}
    </div>

    <div class="hero transaction-hero">
      <h2>What is verified vs. what is still parked</h2>
      <p><strong>Verified:</strong> every franchise-season's ESPN acquisition, drop and trade counters. Those counters reconcile to the league-level totals shown here. <strong>Still parked:</strong> individual historical trade packages (which exact players moved in each deal) until the player-card recovery is fully validated. Nothing below invents missing packages.</p>
      <div class="transaction-status-row">
        <span class="badge good">2013–2025 summary counters ready</span>
        <span class="badge ${recovered.length?'good':'warn'}">${recovered.length?`${recovered.length} trade packages loaded`:'Individual trade packages parked'}</span>
        <button class="inline-action" onclick="navigate('live')">Open live 2026 activity →</button>
      </div>
    </div>

    <div class="tabs" id="transactionTabs">
      <button class="active" data-tab="overview">Overview</button>
      <button data-tab="seasons">Season Explorer</button>
      <button data-tab="franchises">Franchise Activity</button>
      <button data-tab="trades">Trade Archive</button>
    </div>
    <div id="transactionPanel"></div>`;

  const panel=$('#transactionPanel');

  const drawTab=tab=>{
    document.querySelectorAll('#transactionTabs button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));

    if(tab==='overview'){
      const seasonTradeRows=seasons.map(x=>`<tr>
        <td><strong>${x.Season}</strong></td>
        <td>${fmt(x.Acquisitions)}</td>
        <td>${fmt(x.Drops)}</td>
        <td>${fmt(x.TradeParticipations)}</td>
        <td><strong>${tradeCountText(x.CompletedTrades)}</strong></td>
      </tr>`);

      const topActivity=[...franchises].sort((a,b)=>b.Activity-a.Activity).slice(0,10).map((x,i)=>`<tr>
        <td>${i+1}</td>
        <td>${displayFranchise(x.TeamID,x.Team,x.Manager)}</td>
        <td>${x.Seasons}</td>
        <td>${fmt(x.Acquisitions)}</td>
        <td>${fmt(x.TradeParticipations)}</td>
        <td><strong>${fmt(x.Activity)}</strong></td>
      </tr>`);

      panel.innerHTML=`
        <div class="grid-2">
          <div class="card">
            <div class="card-heading-row"><div><span class="section-eyebrow">WAIVERS + FREE AGENCY</span><h2>Acquisition Leaders</h2></div><span class="muted">${fmt(T.acquisitions)} total</span></div>
            ${transactionBars(franchises,'Acquisitions','Team')}
          </div>
          <div class="card">
            <div class="card-heading-row"><div><span class="section-eyebrow">TRADE MARKET</span><h2>Most Frequent Traders</h2></div><span class="muted">${tradeCountText(T.completedTrades)} league trades</span></div>
            ${transactionBars(franchises,'TradeParticipations','Team')}
            <p class="muted transaction-footnote">Franchise values are ESPN team-level trade participations: one completed two-team trade increments both participating franchises.</p>
          </div>
        </div>

        <div class="grid-2 section-gap">
          <div class="card">
            <h2>League Activity by Season</h2>
            <p class="muted">Completed league trades are calculated from the saved ESPN team counters: total trade participations ÷ 2.</p>
            ${table(['Season','Acquisitions','Drops','Trade Participations','Completed Trades'],seasonTradeRows)}
          </div>
          <div class="card">
            <h2>All-Time Activity Index</h2>
            <p class="muted">Activity Index = acquisitions + trade participations. Drops are shown separately because most acquisitions naturally create a corresponding drop.</p>
            ${table(['#','Franchise / Manager','Seasons','Acquisitions','Trade Parts.','Activity'],topActivity)}
          </div>
        </div>

        <div class="grid-2 section-gap">
          <div class="card mini-card"><span class="section-eyebrow">ACQUISITION KING</span><div class="transaction-callout">${acquisitionLeader?displayFranchise(acquisitionLeader.TeamID,acquisitionLeader.Team,acquisitionLeader.Manager):'—'}<strong>${fmt(acquisitionLeader?.Acquisitions||0)} acquisitions</strong></div></div>
          <div class="card mini-card"><span class="section-eyebrow">TRADE KING</span><div class="transaction-callout">${tradeLeader?displayFranchise(tradeLeader.TeamID,tradeLeader.Team,tradeLeader.Manager):'—'}<strong>${fmt(tradeLeader?.TradeParticipations||0)} trade participations</strong></div></div>
        </div>`;
    }

    if(tab==='seasons'){
      panel.innerHTML=`
        <div class="controls">
          <label>Season <select id="transactionSeason">${seasons.map(x=>`<option value="${x.Season}">${x.Season}</option>`).join('')}</select></label>
        </div>
        <div id="transactionSeasonPanel"></div>`;

      const draw=()=>{
        const year=Number($('#transactionSeason').value);
        const s=T.seasons.find(x=>x.Season===year);
        const rows=(DATA?.teams||[])
          .filter(x=>Number(x.Season)===year)
          .map(x=>({
            TeamID:teamId(x['Team ID']),
            Team:cleanTeam(x['Team Name']),
            Manager:canonicalOwner(x['Owner(s)']),
            Acquisitions:Number(x.Acquisitions||0),
            Drops:Number(x.Drops||0),
            Trades:Number(x.Trades||0)
          }))
          .sort((a,b)=>(b.Acquisitions+b.Trades)-(a.Acquisitions+a.Trades)||b.Trades-a.Trades);

        const leader=rows[0], topTrader=[...rows].sort((a,b)=>b.Trades-a.Trades||b.Acquisitions-a.Acquisitions)[0];
        $('#transactionSeasonPanel').innerHTML=`
          <div class="metrics">
            ${metric('Acquisitions',fmt(s?.Acquisitions||0),'league total')}
            ${metric('Drops',fmt(s?.Drops||0),'league total')}
            ${metric('Completed trades',tradeCountText(s?.CompletedTrades||0),`${fmt(s?.TradeParticipations||0)} team participations`)}
            ${metric('Most active franchise',leader?.Team||'—',leader?`${fmt(leader.Acquisitions+leader.Trades)} activity index`:'')}
          </div>
          <div class="grid-2">
            <div class="card">
              <h2>${year} Transaction Table</h2>
              ${table(['#','Franchise / Manager','Acquisitions','Drops','Trades','Activity'],rows.map((x,i)=>`<tr>
                <td>${i+1}</td>
                <td>${displayFranchise(x.TeamID,x.Team,x.Manager)}</td>
                <td>${x.Acquisitions}</td>
                <td>${x.Drops}</td>
                <td><strong>${x.Trades}</strong></td>
                <td>${x.Acquisitions+x.Trades}</td>
              </tr>`))}
            </div>
            <div class="card">
              <h2>${year} Snapshot</h2>
              <div class="feature-list">
                <div class="feature"><strong>Most acquisitions</strong><span class="muted">${esc([...rows].sort((a,b)=>b.Acquisitions-a.Acquisitions)[0]?.Team||'—')} • ${fmt([...rows].sort((a,b)=>b.Acquisitions-a.Acquisitions)[0]?.Acquisitions||0)}</span></div>
                <div class="feature"><strong>Most trade participations</strong><span class="muted">${esc(topTrader?.Team||'—')} • ${fmt(topTrader?.Trades||0)}</span></div>
                <div class="feature"><strong>League trades</strong><span class="muted">${tradeCountText(s?.CompletedTrades||0)} completed two-team trades</span></div>
                <div class="feature"><strong>Package-level detail</strong><span class="muted">${recovered.length?'Loaded where available in Trade Archive.':'Still parked; summary counts remain verified.'}</span></div>
              </div>
            </div>
          </div>`;
      };
      $('#transactionSeason').addEventListener('change',draw);
      draw();
    }

    if(tab==='franchises'){
      const ids=[...franchises].sort((a,b)=>a.Team.localeCompare(b.Team));
      panel.innerHTML=`
        <div class="controls">
          <label>Franchise <select id="transactionFranchise">${ids.map(x=>`<option value="${x.TeamID}">${esc(x.Team)} — ${esc(x.Manager)}</option>`).join('')}</select></label>
        </div>
        <div id="transactionFranchisePanel"></div>
        <div class="card section-gap">
          <h2>Career Transaction Rankings</h2>
          ${table(['#','Franchise / Manager','Seasons','Acquisitions','Drops','Trade Parts.','Activity'],franchises.map((x,i)=>`<tr>
            <td>${i+1}</td>
            <td>${displayFranchise(x.TeamID,x.Team,x.Manager)}</td>
            <td>${x.Seasons}</td>
            <td>${fmt(x.Acquisitions)}</td>
            <td>${fmt(x.Drops)}</td>
            <td><strong>${fmt(x.TradeParticipations)}</strong></td>
            <td>${fmt(x.Activity)}</td>
          </tr>`))}
        </div>`;

      const draw=()=>{
        const id=Number($('#transactionFranchise').value);
        const f=franchises.find(x=>x.TeamID===id);
        const bestAcq=[...f.rows].sort((a,b)=>b.Acquisitions-a.Acquisitions)[0];
        const bestTrade=[...f.rows].sort((a,b)=>b.Trades-a.Trades)[0];
        $('#transactionFranchisePanel').innerHTML=`
          <div class="metrics">
            ${metric('Career acquisitions',fmt(f.Acquisitions),`${f.Seasons} seasons`)}
            ${metric('Career drops',fmt(f.Drops),'ESPN counter')}
            ${metric('Trade participations',fmt(f.TradeParticipations),'team-side count')}
            ${metric('Most active season',bestAcq?.Season??'—',bestAcq?`${fmt(bestAcq.Acquisitions)} acquisitions`:'')}
          </div>
          <div class="grid-2">
            <div class="card">
              <h2>${esc(f.Team)} Transaction History</h2>
              ${table(['Season','Team Name','Acquisitions','Drops','Trades','Activity'],[...f.rows].sort((a,b)=>b.Season-a.Season).map(x=>`<tr>
                <td><strong>${x.Season}</strong></td>
                <td>${esc(x.TeamName)}</td>
                <td>${x.Acquisitions}</td>
                <td>${x.Drops}</td>
                <td><strong>${x.Trades}</strong></td>
                <td>${x.Acquisitions+x.Trades}</td>
              </tr>`))}
            </div>
            <div class="card">
              <h2>Franchise Tendencies</h2>
              <div class="feature-list">
                <div class="feature"><strong>Acquisitions per season</strong><span class="muted">${fmt(f.Acquisitions/f.Seasons,1)}</span></div>
                <div class="feature"><strong>Trade participations per season</strong><span class="muted">${fmt(f.TradeParticipations/f.Seasons,1)}</span></div>
                <div class="feature"><strong>Biggest acquisition season</strong><span class="muted">${bestAcq?.Season||'—'} • ${fmt(bestAcq?.Acquisitions||0)}</span></div>
                <div class="feature"><strong>Biggest trade season</strong><span class="muted">${bestTrade?.Season||'—'} • ${fmt(bestTrade?.Trades||0)} participations</span></div>
              </div>
            </div>
          </div>`;
      };
      $('#transactionFranchise').addEventListener('change',draw);
      draw();
    }

    if(tab==='trades'){
      if(recovered.length){
        const fleece=(A.biggestFleeces||[]).slice(0,20), balanced=(A.mostBalanced||[]).slice(0,20);
        const tr=x=>`<tr><td>${x.Season} W${x.Week}</td><td><strong>${esc(x.TeamA)}</strong><br>${esc((x.TeamAPlayers||[]).join(', '))}</td><td><strong>${esc(x.TeamB)}</strong><br>${esc((x.TeamBPlayers||[]).join(', '))}</td><td class="${valueTone(x.ValueGap)}">${signed(x.ValueGap)}</td></tr>`;
        panel.innerHTML=`
          <div class="metrics">
            ${metric('Recovered packages',recovered.length,'validated trade rows')}
            ${metric('Official league trades',tradeCountText(T.completedTrades),'2013–2025 counter total')}
            ${metric('Biggest value gap',fleece[0]?signed(fleece[0].ValueGap):'—')}
            ${metric('Managers graded',(A.managerCareer||[]).length)}
          </div>
          <div class="grid-2">
            <div class="card"><h2>Biggest Fleeces</h2>${table(['When','Side A','Side B','Value Gap'],fleece.map(tr))}</div>
            <div class="card"><h2>Most Balanced</h2>${table(['When','Side A','Side B','Value Gap'],balanced.map(tr))}</div>
          </div>
          <div class="card section-gap"><h2>Recovered Trade Timeline</h2>${table(['When','Side A','Side B','Value Gap'],recovered.slice().sort((a,b)=>b.Timestamp-a.Timestamp).map(tr))}</div>`;
      }else{
        const yearRows=seasons.map(x=>`<tr><td><strong>${x.Season}</strong></td><td>${fmt(x.TradeParticipations)}</td><td><strong>${tradeCountText(x.CompletedTrades)}</strong></td><td><span class="badge good">Count verified</span></td><td><span class="badge warn">Package parked</span></td></tr>`);
        const tradeFranchises=[...franchises].sort((a,b)=>b.TradeParticipations-a.TradeParticipations).map((x,i)=>`<tr><td>${i+1}</td><td>${displayFranchise(x.TeamID,x.Team,x.Manager)}</td><td>${x.Seasons}</td><td><strong>${fmt(x.TradeParticipations)}</strong></td><td>${fmt(x.TradeParticipations/x.Seasons,1)}</td></tr>`);
        panel.innerHTML=`
          <div class="trade-recovery-banner">
            <div>
              <span class="section-eyebrow">HISTORICAL TRADE RECOVERY</span>
              <h2>Counts are live. Player packages remain parked.</h2>
              <p>We recovered and validated the official number of trades each franchise made in every season. We are deliberately not publishing player-by-player historical deals until the ESPN player-card reconstruction passes the same checksum.</p>
            </div>
            <div class="trade-recovery-number"><strong>${tradeCountText(T.completedTrades)}</strong><span>verified league trades</span></div>
          </div>
          <div class="grid-2">
            <div class="card">
              <h2>Verified Trade Volume by Season</h2>
              ${table(['Season','Team Participations','Completed Trades','Count Status','Package Status'],yearRows)}
            </div>
            <div class="card">
              <h2>Most Frequent Traders</h2>
              ${table(['#','Franchise / Manager','Seasons','Trade Parts.','Per Season'],tradeFranchises)}
            </div>
          </div>
          <div class="identity-note section-gap">
            <span class="badge warn">Parked recovery</span>
            <div><strong>No fabricated trade packages</strong><span class="muted">When we return to the ESPN player-card recovery, this page is already structured to switch automatically from count-only mode to recovered trade packages and realized-value grading.</span></div>
          </div>`;
      }
    }
  };

  document.querySelectorAll('#transactionTabs button').forEach(b=>b.addEventListener('click',()=>drawTab(b.dataset.tab)));
  drawTab('overview');
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
    ['Historical transaction summary counters','Acquisitions / drops / trade counts complete','good'],
    ['Historical individual trade packages',(trade.trades||[]).length?`${trade.trades.length} recovered`:'Recovery parked pending validation',(trade.trades||[]).length?'good':'warn'],
    ['Injury / availability enrichment',(injury.players||[]).length?`${injury.players.length} player-season rows`:'Pending',(injury.players||[]).length?'good':'warn'],
    ['League rules','2026 settings loaded','good']
  ];
  $('#content').innerHTML=`<div class="card"><h2>Coverage Matrix</h2>${table(['Dataset','Status','Coverage'],items.map(x=>`<tr><td><strong>${x[0]}</strong></td><td><span class="badge ${x[2]}">${x[1]}</span></td><td>${x[2]==='good'?'Ready':'Next work item'}</td></tr>`))}</div>
  <div class="hero" style="margin-top:16px"><h2>Provenance first</h2><p>The site keeps raw ESPN history intact and applies identity cleanup as a transparent presentation layer. Historical acquisition, drop and trade-count summaries are shown from saved ESPN counters; package-level trade grading remains hidden until the individual deals are fully validated.</p></div>`;
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
