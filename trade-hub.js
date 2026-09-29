// Live roster-fit ideas complement the verified historical trade archive.
(function(){
  if(typeof pages==='undefined'||typeof pages.trades!=='function') return;
  const archive=pages.trades;
  const escTrade=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const core=['QB','RB','WR','TE'];
  const stateKey=(season,teamId)=>`lfl-trade-feedback:${season}:${teamId}`;
  function readFeedback(season,teamId){
    try{return JSON.parse(localStorage.getItem(stateKey(season,teamId)))||{protected:[],bad:[],good:[]}}
    catch(_){return {protected:[],bad:[],good:[]}}
  }
  function saveFeedback(season,teamId,state){try{localStorage.setItem(stateKey(season,teamId),JSON.stringify(state))}catch(_){}}
  function estimate(p,week){
    let n=Number(p.rosWeeklyValue);
    if(!Number.isFinite(n)||p.rosWeeklyValue==null)return null;
    const injury=String(p.injuryStatus||'').toUpperCase();
    if(injury==='DOUBTFUL')n*=.5;
    else if(injury==='QUESTIONABLE')n*=.85;
    if(p.byeWeek>=week&&p.byeWeek<=week+4&&!String(p.valueSource||'').includes('next'))n*=.9;
    return n;
  }
  function inventory(t){
    const counts=Object.fromEntries(core.map(p=>[p,0]));
    for(const p of t.players||[])if(counts[p.position]!=null && p.slot!=='IR'&&!['OUT','INJURED'].includes(String(p.injuryStatus).toUpperCase()))counts[p.position]++;
    return counts;
  }
  function lineupScore(players,week){
    const usable=(players||[]).filter(p=>core.includes(p.position)&&estimate(p,week)!=null&&p.slot!=='IR'&&!['OUT','INJURED'].includes(String(p.injuryStatus).toUpperCase()));
    const picked=new Set();let score=0;
    for(const [position,slots] of [['QB',1],['RB',2],['WR',2],['TE',1]]){
      const group=usable.filter(p=>p.position===position).sort((a,b)=>estimate(b,week)-estimate(a,week)).slice(0,slots);
      for(const p of group){picked.add(p.playerId);score+=estimate(p,week)}
    }
    const flex=usable.filter(p=>['RB','WR','TE'].includes(p.position)&&!picked.has(p.playerId)).sort((a,b)=>estimate(b,week)-estimate(a,week))[0];
    return score+(flex?estimate(flex,week):0);
  }
  function draw(teams,selected,season,week){
    const target=document.querySelector('#tradeHubResults');if(!target)return;
    const mine=teams.find(t=>String(t.teamId)===String(selected));if(!mine)return;
    const counts=inventory(mine),feedback=readFeedback(season,selected);
    // Roster counts are a fit signal, not a valuation of individual players.
    const thresholds={QB:2,RB:4,WR:4,TE:2};
    const rank=core.slice().sort((a,b)=>(counts[a]/thresholds[a])-(counts[b]/thresholds[b]));
    const needs=rank.slice(0,2);
    const depth=rank.slice(-2).reverse();
    const offers=[];const mineBefore=lineupScore(mine.players,week);
    for(const other of teams){if(other.teamId===mine.teamId)continue;
      const theirs=inventory(other),otherBefore=lineupScore(other.players,week);
      for(const want of needs)for(const offer of depth){
        if(want===offer)continue;
        const fit=(theirs[want]/thresholds[want]-counts[want]/thresholds[want])+
          (counts[offer]/thresholds[offer]-theirs[offer]/thresholds[offer]);
        if(fit<=0)continue;
        const outgoing=(mine.players||[]).filter(p=>p.position===offer&&estimate(p,week)>=5&&p.slot!=='IR'&&!['OUT','INJURED'].includes(String(p.injuryStatus).toUpperCase()));
        const incoming=(other.players||[]).filter(p=>p.position===want&&estimate(p,week)>=5&&p.slot!=='IR'&&!['OUT','INJURED'].includes(String(p.injuryStatus).toUpperCase()));
        for(const give of outgoing)for(const receive of incoming){
          const gap=Math.abs(estimate(give,week)-estimate(receive,week))/Math.max(estimate(give,week),estimate(receive,week));
          const key=`${other.teamId}|${give.playerId}|${receive.playerId}`;
          if(gap>.18||feedback.protected?.includes(String(give.playerId))||feedback.bad?.includes(key))continue;
          const mineAfter=lineupScore([...mine.players.filter(p=>p.playerId!==give.playerId),receive],week);
          const otherAfter=lineupScore([...other.players.filter(p=>p.playerId!==receive.playerId),give],week);
          const myGain=mineAfter-mineBefore,theirGain=otherAfter-otherBefore;
          if(myGain<.5||theirGain<.5)continue;
          offers.push({key,other,give,receive,gap,fit,myGain,theirGain,score:myGain+theirGain+fit-gap*3+(feedback.good?.includes(key)?3:0)});
        }
      }
    }
    offers.push(...(window.LFLTradePackages?.propose(teams,mine,week,feedback)||[]));
    offers.sort((a,b)=>b.score-a.score);
    const unique=[];const used=new Set();
    for(const x of offers){const key=x.key;
      if(!used.has(key)){unique.push(x);used.add(key)}if(unique.length>=12)break;}
    target.innerHTML=`<div class="metrics">${core.map(p=>`<div class="metric"><span>${p} depth</span><strong>${counts[p]}</strong><small>Guide ${thresholds[p]}</small></div>`).join('')}</div>
      <div class="grid-2 section-gap"><div class="card"><h3>Thin positions to explore</h3><p>${needs.map(escTrade).join(', ')}</p><h3>Relative depth</h3><p>${depth.map(escTrade).join(', ')}</p><p class="muted">Counts exclude injured or IR players. Upcoming ESPN projections are preferred; recent form and this week’s estimate fill gaps. Bye weeks are reflected when ESPN supplies future projections.</p></div>
      <div class="card"><h3>Proposed trades</h3>${unique.length?unique.slice(0,8).map(x=>`<div class="feature"><strong>Send ${(x.givePlayers||[x.give]).map(p=>escTrade(p.player)+" ("+escTrade(p.position)+")").join(" + ")} to ${escTrade(x.other.team)}</strong><span>Receive ${(x.receivePlayers||[x.receive]).map(p=>escTrade(p.player)+" ("+escTrade(p.position)+")").join(" + ")}</span><span class="muted">Rest-of-season weekly estimate: ${(x.giveValue??estimate(x.give,week)).toFixed(1)} vs ${(x.receiveValue??estimate(x.receive,week)).toFixed(1)} points • ${Math.round(x.gap*100)}% gap. Estimated starting-lineup gain: you +${x.myGain.toFixed(1)}, them +${x.theirGain.toFixed(1)} points per week.</span><small class="muted">${x.dropMine?.length?"Your roster-space move: drop "+x.dropMine.map(p=>escTrade(p.player)).join(", ")+". ":""}${x.dropOther?.length?"Their roster-space move: drop "+x.dropOther.map(p=>escTrade(p.player)).join(", ")+". ":""}${escTrade(x.give.valueSource)} / ${escTrade(x.receive.valueSource)}${x.give.byeWeek||x.receive.byeWeek?` • Byes: W${x.give.byeWeek||'—'} / W${x.receive.byeWeek||'—'}`:''}</small><span><button type="button" data-trade-good="${escTrade(x.key)}">${feedback.good?.includes(x.key)?'✓ Good':'Good'}</button> <button type="button" data-trade-bad="${escTrade(x.key)}">Bad</button> <button type="button" data-trade-protect="${escTrade(x.give.playerId)}">Never trade ${escTrade(x.give.player)}</button></span></div>`).join(''):'<p class="muted">No swap currently clears the fairness and two-sided lineup-improvement checks. More ESPN projection coverage may change this.</p>'}</div></div><div class="card section-gap"><h4>Protected players</h4><p class="muted">Saved on this device for ${season}. These players will not be proposed as outgoing assets.</p><select id="tradeProtectPick">${(mine.players||[]).filter(p=>p.playerId!=null).map(p=>`<option value="${escTrade(p.playerId)}">${escTrade(p.player)}</option>`).join('')}</select> <button type="button" id="tradeProtectAdd">Protect player</button><br><br>${(feedback.protected||[]).length?feedback.protected.map(id=>`<button type="button" data-trade-unprotect="${escTrade(id)}">Remove ${escTrade(mine.players.find(p=>String(p.playerId)===id)?.player||id)} ×</button>`).join(' '):'<span class="muted">None yet.</span>'}</div>`;
    target.querySelector('#tradeProtectAdd')?.addEventListener('click',()=>{const state=readFeedback(season,selected),id=target.querySelector('#tradeProtectPick')?.value;if(!id)return;state.protected=[...new Set([...(state.protected||[]),id])];saveFeedback(season,selected,state);draw(teams,selected,season,week)});
    target.querySelectorAll('[data-trade-good],[data-trade-bad],[data-trade-protect],[data-trade-unprotect]').forEach(button=>button.addEventListener('click',()=>{
      const state=readFeedback(season,selected);
      if(button.dataset.tradeGood){state.good=[...new Set([...(state.good||[]),button.dataset.tradeGood])];state.bad=(state.bad||[]).filter(x=>x!==button.dataset.tradeGood)}
      if(button.dataset.tradeBad){state.bad=[...new Set([...(state.bad||[]),button.dataset.tradeBad])];state.good=(state.good||[]).filter(x=>x!==button.dataset.tradeBad)}
      if(button.dataset.tradeProtect)state.protected=[...new Set([...(state.protected||[]),button.dataset.tradeProtect])];
      if(button.dataset.tradeUnprotect)state.protected=(state.protected||[]).filter(x=>x!==button.dataset.tradeUnprotect);
      saveFeedback(season,selected,state);draw(teams,selected,season,week);
    }));
  }
  pages.trades=function(){
    archive();
    function showHub(d){
      const content=document.querySelector('#content');if(!content)return;
      const root=document.createElement('div');root.className='card section-gap';
      root.innerHTML='<span class="section-eyebrow">LIVE TRADE HUB</span><h2>Roster Needs & Trade Partners</h2><p class="muted">Specific player swaps must improve both projected starting lineups and have comparable rest-of-season estimates. Includes 1-for-1, 2-for-1 and 2-for-2 packages; any required roster-space drop is included in lineup gains. Review schedule, injuries and league context before offering a trade.</p><div id="tradeSourceStatus"></div><label>My team <select id="tradeHubTeam"></select></label><div id="tradeHubResults">Loading current rosters…</div>';
      content.prepend(root);
      if(!d)return;
      document.querySelector('#tradeSourceStatus').innerHTML=`<p class="muted">Updated ${escTrade(d.updatedAt)} • PPR / 4-point passing TD • rest-of-season weekly estimates</p>${table(['Source','Status','Players with estimates','Last feed update'],(d.sourceStatus||[]).map(s=>`<tr><td>${escTrade(s.source)}</td><td>${escTrade(s.status)}${s.metadata?'<br>'+escTrade(s.metadata):''}</td><td>${s.players}</td><td>${escTrade(s.updatedAt||'—')}</td></tr>`))}<details><summary>Player estimate breakdown</summary>${table(['Player','ESPN','Yahoo','Sleeper','CBS','Blended'],(d.rosters||[]).flatMap(t=>t.players||[]).map(p=>`<tr><td>${escTrade(p.player)}</td>${['ESPN','Yahoo','Sleeper','CBS'].map(name=>{const v=p.valuationSources?.find(s=>s.source===name)?.value;return '<td>'+(v==null?'—':v.toFixed(1))+'</td>'}).join('')}<td>${p.rosWeeklyValue==null?'—':Number(p.rosWeeklyValue).toFixed(1)}</td></tr>`))}</details>`;
      const teams=d.rosters||[];const picker=document.querySelector('#tradeHubTeam');
      picker.innerHTML=teams.map(t=>`<option value="${Number(t.teamId)}">${escTrade(t.team)}</option>`).join('');
      picker.addEventListener('change',()=>draw(teams,picker.value,d.season,d.currentWeek||1));draw(teams,picker.value,d.season,d.currentWeek||1);
    }
    showHub();
    fetch('/api/trade-values').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d}).then(d=>{
      const rows=(d.rosters||[]).filter(t=>t.transactionCountsAvailable).map(t=>({
        Season:Number(d.season),'Team ID':Number(t.teamId),'Team Name':t.team,'Owner(s)':t.owner,
        Acquisitions:t.transactionCounts.acquisitions,Drops:t.transactionCounts.drops,Trades:t.transactionCounts.trades
      }));
      window.liveTransactionTeams=rows;
      if(currentPage!=='trades')return;
      archive();showHub(d);
    }).catch(e=>{const target=document.querySelector('#tradeHubResults');if(target)target.textContent=`Live roster data unavailable: ${e.message}`});
  };
})();
