// Live roster-fit ideas complement the verified historical trade archive.
(function(){
  if(typeof pages==='undefined'||typeof pages.trades!=='function') return;
  const archive=pages.trades;
  const escTrade=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const core=['QB','RB','WR','TE'];
  function inventory(t){
    const counts=Object.fromEntries(core.map(p=>[p,0]));
    for(const p of t.players||[])if(counts[p.position]!=null && !['IR','OUT','INJURED'].includes(String(p.injuryStatus).toUpperCase()))counts[p.position]++;
    return counts;
  }
  function draw(teams,selected){
    const target=document.querySelector('#tradeHubResults');if(!target)return;
    const mine=teams.find(t=>String(t.teamId)===String(selected));if(!mine)return;
    const counts=inventory(mine);
    // Roster counts are a fit signal, not a valuation of individual players.
    const thresholds={QB:2,RB:4,WR:4,TE:2};
    const needs=core.filter(p=>counts[p]<thresholds[p]).sort((a,b)=>(counts[a]/thresholds[a])-(counts[b]/thresholds[b]));
    const depth=core.filter(p=>counts[p]>thresholds[p]);
    const partners=[];
    for(const other of teams){if(other.teamId===mine.teamId)continue;
      const theirs=inventory(other);
      for(const want of needs)for(const offer of depth){
        if(theirs[want]>thresholds[want]&&theirs[offer]<thresholds[offer])partners.push({other,want,offer,score:(theirs[want]-thresholds[want])+(thresholds[offer]-theirs[offer])});
      }
    }
    partners.sort((a,b)=>b.score-a.score);
    target.innerHTML=`<div class="metrics">${core.map(p=>`<div class="metric"><span>${p} depth</span><strong>${counts[p]}</strong><small>Guide ${thresholds[p]}</small></div>`).join('')}</div>
      <div class="grid-2 section-gap"><div class="card"><h3>Potential needs</h3><p>${needs.length?needs.map(escTrade).join(', '):'No clear shortage by roster count.'}</p><h3>Available depth</h3><p>${depth.length?depth.map(escTrade).join(', '):'No clear surplus by roster count.'}</p><p class="muted">Counts exclude players listed as injured or on IR. Starter quality, byes and trade value still matter.</p></div>
      <div class="card"><h3>Teams to talk to</h3>${partners.length?partners.slice(0,8).map(x=>`<p><strong>${escTrade(x.other.team)}</strong><br>Explore your ${escTrade(x.offer)} depth for their ${escTrade(x.want)} depth. Their roster has ${inventory(x.other)[x.want]} ${escTrade(x.want)}s. Possible players to discuss: ${escTrade((x.other.players||[]).filter(p=>p.position===x.want).map(p=>p.player).slice(0,3).join(', ')||'see roster')}.</p>`).join(''):'<p class="muted">No clear two-way positional fits from current rosters.</p>'}</div></div>`;
  }
  pages.trades=function(){
    archive();
    const content=document.querySelector('#content');if(!content)return;
    const root=document.createElement('div');root.className='card section-gap';root.innerHTML='<span class="section-eyebrow">LIVE TRADE HUB</span><h2>Roster Needs & Trade Partners</h2><p class="muted">Find complementary roster depth from current ESPN rosters. These are conversation starters, not player-for-player recommendations or value guarantees.</p><label>My team <select id="tradeHubTeam"></select></label><div id="tradeHubResults">Loading current rosters…</div>';
    content.prepend(root);
    fetch('/api/live').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d}).then(d=>{
      const teams=d.rosters||[];const picker=document.querySelector('#tradeHubTeam');if(!picker)return;
      picker.innerHTML=teams.map(t=>`<option value="${Number(t.teamId)}">${escTrade(t.team)}</option>`).join('');
      picker.addEventListener('change',()=>draw(teams,picker.value));draw(teams,picker.value);
    }).catch(e=>{const target=document.querySelector('#tradeHubResults');if(target)target.textContent=`Live roster data unavailable: ${e.message}`});
  };
})();
