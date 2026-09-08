let liveSelectedWeek=null;
let liveOpenMatchupId=null;

(()=>{
  if(document.getElementById('live2026EnhancementStyles')) return;
  const style=document.createElement('style');
  style.id='live2026EnhancementStyles';
  style.textContent=`
    .live-toolbar{display:flex;align-items:end;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:14px}
    .live-week-note{font-size:.9rem}
    .live-matchup-card{cursor:pointer;transition:transform .15s ease,box-shadow .15s ease;position:relative}
    .live-matchup-card:hover,.live-matchup-card:focus{transform:translateY(-2px);outline:2px solid currentColor;outline-offset:2px}
    .live-matchup-card.live-selected{outline:2px solid currentColor;outline-offset:2px}
    .live-matchup-hint{margin-top:8px;font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
    .live-team-score{display:flex;align-items:center;gap:8px}
    .live-team-score small{font-weight:400}
    .live-boxscore{margin-top:16px}
    .live-boxscore-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:12px}
    .live-boxscore-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
    .live-box-team-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px}
    .live-box-team-score{text-align:right}
    .live-box-team-score strong{display:block;font-size:1.65rem}
    .live-box-bench{margin-top:14px}
    .live-box-bench h4{margin:0 0 8px}
    .live-draft-results summary{cursor:pointer;font-weight:800;font-size:1.05rem}
    .live-draft-results[open] summary{margin-bottom:14px}
    @media(max-width:900px){.live-boxscore-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);
})();

function livePoints(v,d=2){
  return v==null?'—':fmt(v,d);
}

function livePlayerRows(players){
  return (players||[]).map(p=>`<tr>
    <td>${esc(p.slot||'')}</td>
    <td><strong>${esc(p.player||'Unknown')}</strong>${p.injuryStatus&&!["ACTIVE","NORMAL","HEALTHY"].includes(String(p.injuryStatus).toUpperCase())?`<br><span class="badge warn">${esc(p.injuryStatus)}</span>`:''}</td>
    <td>${esc(p.position||'')}</td>
    <td><strong>${livePoints(p.points,2)}</strong></td>
    <td>${livePoints(p.projectedPoints,2)}</td>
  </tr>`);
}

function liveTeamBox(team){
  if(!team) return '<div class="card"><div class="empty">Lineup unavailable.</div></div>';
  const starters=(team.players||[]).filter(p=>p.starter);
  const bench=(team.players||[]).filter(p=>!p.starter);
  return `<div class="card">
    <div class="live-box-team-head">
      <div><h3>${esc(team.team||'TBD')}</h3><span class="muted">${esc(canonicalOwner(team.owner||''))}</span></div>
      <div class="live-box-team-score"><strong>${livePoints(team.score,2)}</strong><span class="muted">Proj ${livePoints(team.projectedScore,2)}</span></div>
    </div>
    <h4>Starters</h4>
    ${starters.length?table(['Slot','Player','Pos','Pts','Proj'],livePlayerRows(starters)):'<div class="empty">No starters returned.</div>'}
    <div class="live-box-bench"><h4>Bench / IR</h4>${bench.length?table(['Slot','Player','Pos','Pts','Proj'],livePlayerRows(bench)):'<div class="empty">No bench players returned.</div>'}</div>
  </div>`;
}

function drawLiveBoxscore(data,matchupId,scroll=false){
  const area=$('#liveBoxscoreArea');
  if(!area) return;
  const m=(data.matchups||[]).find(x=>String(x.id)===String(matchupId));
  document.querySelectorAll('.live-matchup-card').forEach(el=>el.classList.toggle('live-selected',String(el.dataset.matchupId)===String(matchupId)));
  if(!m){area.innerHTML='';return;}
  liveOpenMatchupId=String(matchupId);
  const stage=m.playoffTierType&&m.playoffTierType!=='NONE'?m.playoffTierType.replaceAll('_',' '):'Regular Season';
  area.innerHTML=`<div class="card live-boxscore">
    <div class="live-boxscore-head">
      <div><span class="section-eyebrow">WEEK ${esc(m.week)} BOX SCORE</span><h2>${esc(m.awayTeam||'TBD')} vs ${esc(m.homeTeam||'TBD')}</h2><span class="muted">${esc(stage)}</span></div>
      <button id="closeLiveBoxscore" type="button">Close</button>
    </div>
    <div class="live-boxscore-grid">${liveTeamBox(m.boxscore?.away)}${liveTeamBox(m.boxscore?.home)}</div>
  </div>`;
  $('#closeLiveBoxscore')?.addEventListener('click',()=>{
    liveOpenMatchupId=null;
    area.innerHTML='';
    document.querySelectorAll('.live-matchup-card').forEach(el=>el.classList.remove('live-selected'));
  });
  if(scroll) area.scrollIntoView({behavior:'smooth',block:'start'});
}

async function refreshLive(){
  try{
    const [liveResponse,boxResponse]=await Promise.all([
      fetch('/api/live'),
      fetch(`/api/boxscore${liveSelectedWeek?`?week=${encodeURIComponent(liveSelectedWeek)}`:''}`)
    ]);
    const d=await liveResponse.json();
    const b=await boxResponse.json();
    if(!liveResponse.ok||d.error) throw new Error(d.error||`Live API HTTP ${liveResponse.status}`);
    if(!boxResponse.ok||b.error) throw new Error(b.error||`Box score API HTTP ${boxResponse.status}`);

    liveSelectedWeek=Number(b.selectedWeek||liveSelectedWeek||b.currentWeek||d.currentWeek||1);
    const liveSeason=Number(d.season||b.season||new Date().getFullYear());

const liveNav=document.querySelector('nav button[data-page="live"]');
if(liveNav) liveNav.innerHTML=`Live ${liveSeason} <span class="live-dot"></span>`;

setHeader(
  `Live ${liveSeason}`,
  `Current ${liveSeason} standings, rosters, matchups, transactions, draft results and injuries from ESPN.`
);
    const weeks=(b.availableWeeks||[]).length?b.availableWeeks:[liveSelectedWeek];
    setStatus(`Live • Week ${b.currentWeek||d.currentWeek||'—'}${liveSelectedWeek!==Number(b.currentWeek||d.currentWeek)?` • Viewing W${liveSelectedWeek}`:''}`,'good');

    const matchupCards=(b.matchups||[]).map(m=>`<div class="matchup-card live-matchup-card${String(liveOpenMatchupId)===String(m.id)?' live-selected':''}" data-matchup-id="${esc(m.id)}" role="button" tabindex="0">
      <div class="teamrow"><span><strong>${esc(m.awayTeam||'TBD')}</strong><br><small class="muted">${esc(canonicalOwner(m.awayOwner||''))}</small></span><span class="live-team-score"><strong>${livePoints(m.awayScore,2)}</strong>${m.awayProjectedScore!=null?`<small class="muted">Proj ${livePoints(m.awayProjectedScore,1)}</small>`:''}</span></div>
      <div class="teamrow"><span><strong>${esc(m.homeTeam||'TBD')}</strong><br><small class="muted">${esc(canonicalOwner(m.homeOwner||''))}</small></span><span class="live-team-score"><strong>${livePoints(m.homeScore,2)}</strong>${m.homeProjectedScore!=null?`<small class="muted">Proj ${livePoints(m.homeProjectedScore,1)}</small>`:''}</span></div>
      <div class="matchup-meta">Week ${esc(m.week)} • Updated ${new Date(b.updatedAt||d.updatedAt).toLocaleTimeString()}</div>
      <div class="live-matchup-hint">Open box score →</div>
    </div>`).join('');

    const standingRows=(d.standings||[]).map((x,i)=>`<tr><td>${i+1}</td><td><strong>${esc(x.team)}</strong><br><span class="muted">${esc(canonicalOwner(x.owner||''))}</span></td><td>${x.wins}-${x.losses}-${x.ties}</td><td>${fmt(x.pointsFor,1)}</td><td>${fmt(x.pointsAgainst,1)}</td><td>${fmt(x.powerScore,1)}</td></tr>`);
    const injuryRows=(d.injuries||[]).slice(0,40).map(x=>`<tr><td><strong>${esc(x.player)}</strong></td><td>${esc(x.position||'')}</td><td>${esc(x.team||'')}</td><td><span class="badge warn">${esc(x.status||'')}</span></td></tr>`);
    const txRows=(d.transactions||[]).slice(0,40).map(x=>`<tr><td>${x.date?new Date(x.date).toLocaleDateString():'—'}</td><td><strong>${esc(x.team||'League')}</strong></td><td>${esc(x.type||'')}</td><td>${esc((x.items||[]).map(i=>`${i.action||i.type||''} ${i.player||''}`).join(' • '))}</td></tr>`);
    const rosterTeams=d.rosters||[];
    const rosterOptions=rosterTeams.map((t,i)=>`<option value="${i}">${esc(t.team)}</option>`).join('');
    const draftRows=(d.draftPicks||[]).map(p=>`<tr><td><strong>#${p.overallPick||'—'}</strong><br><span class="muted">R${p.round||'—'}.${p.roundPick||'—'}</span></td><td><strong>${esc(p.player||'Unknown')}</strong></td><td><strong>${esc(p.team||'')}</strong><br><span class="muted">${esc(canonicalOwner(p.owner||''))}</span></td><td>${p.keeper?'<span class="badge warn">Keeper</span>':'Drafted'}</td></tr>`);

    $('#liveArea').className='';
    $('#liveArea').innerHTML=`
      <div class="live-toolbar">
        <div class="controls"><label>Matchup week <select id="liveWeekPick">${weeks.map(w=>`<option value="${w}" ${Number(w)===liveSelectedWeek?'selected':''}>Week ${w}${Number(w)===Number(b.currentWeek||d.currentWeek)?' • Current':''}</option>`).join('')}</select></label></div>
        <span class="muted live-week-note">Click any matchup to open the full player box score.</span>
      </div>
      <div class="metrics">
        ${metric('Current week',b.currentWeek||d.currentWeek||'—')}
        ${metric('Viewing week',liveSelectedWeek||'—')}
        ${metric('Teams',(d.standings||[]).length||'—')}
        ${metric(`${liveSeason} draft picks`,(d.draftPicks||[]).length||'—','live ESPN draft board')}
      </div>
      <div class="card"><h2>Week ${liveSelectedWeek} Matchups</h2><div class="scoreboard">${matchupCards||'<div class="empty">No matchups returned for this week.</div>'}</div></div>
      <div id="liveBoxscoreArea"></div>
      <details class="card section-gap live-draft-results">
        <summary>${liveSeason} Draft Results • ${(d.draftPicks||[]).length} picks</summary>
        ${draftRows.length?table(['Pick','Player','Team / Manager','Type'],draftRows):'<div class="empty">Draft results are not available yet.</div>'}
      </details>
      <div class="grid-2 section-gap">
        <div class="card"><h2>Current Standings + Power Score</h2>${standingRows.length?table(['#','Team / Manager','Record','PF','PA','Power'],standingRows):'<div class="empty">Standings not available yet.</div>'}</div>
        <div class="card"><h2>Current Injuries</h2>${injuryRows.length?table(['Player','Pos','Team','Status'],injuryRows):'<div class="empty">No injured roster players returned.</div>'}</div>
      </div>
      <div class="grid-2 section-gap">
        <div class="card"><h2>Recent League Activity</h2>${txRows.length?table(['Date','Team','Type','Players'],txRows):'<div class="empty">No recent transactions returned.</div>'}</div>
        <div class="card"><h2>Current Rosters</h2>${rosterTeams.length?`<div class="controls"><select id="liveRosterPick">${rosterOptions}</select></div><div id="liveRosterTable"></div>`:'<div class="empty">Rosters not available.</div>'}</div>
      </div>`;

    $('#liveWeekPick')?.addEventListener('change',async e=>{
      liveSelectedWeek=Number(e.target.value)||Number(b.currentWeek||d.currentWeek)||1;
      liveOpenMatchupId=null;
      await refreshLive();
    });

    document.querySelectorAll('.live-matchup-card').forEach(card=>{
      const open=()=>drawLiveBoxscore(b,card.dataset.matchupId,true);
      card.addEventListener('click',open);
      card.addEventListener('keydown',e=>{
        if(e.key==='Enter'||e.key===' '){
          e.preventDefault();
          open();
        }
      });
    });

    if(rosterTeams.length){
      const drawRoster=()=>{
        const t=rosterTeams[Number($('#liveRosterPick').value)||0];
        $('#liveRosterTable').innerHTML=table(
          ['Slot','Player','Pos','Status'],
          (t.players||[]).map(p=>`<tr><td>${esc(p.slot||'')}</td><td><strong>${esc(p.player||'')}</strong></td><td>${esc(p.position||'')}</td><td>${p.injuryStatus&&p.injuryStatus!=='ACTIVE'?`<span class="badge warn">${esc(p.injuryStatus)}</span>`:'Active'}</td></tr>`)
        );
      };
      $('#liveRosterPick').addEventListener('change',drawRoster);
      drawRoster();
    }

    if(liveOpenMatchupId && (b.matchups||[]).some(m=>String(m.id)===String(liveOpenMatchupId))){
      drawLiveBoxscore(b,liveOpenMatchupId,false);
    }

  }catch(e){
    setStatus('Live connection needs setup','warn');
    $('#liveArea').className='empty';
    $('#liveArea').innerHTML=`<strong>Live ESPN connection isn't active.</strong><br><br>${esc(e.message)}`;
  }
}
