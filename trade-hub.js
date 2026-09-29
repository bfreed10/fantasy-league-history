// Live roster-fit ideas complement the verified historical trade archive.
(function(){
  if(typeof pages==='undefined'||typeof pages.trades!=='function') return;
  const archive=pages.trades;
  const escTrade=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const core=['QB','RB','WR','TE'];
  function inventory(t){
    const counts=Object.fromEntries(core.map(p=>[p,0]));
    for(const p of t.players||[])if(counts[p.position]!=null && p.slot!=='IR'&&!['OUT','INJURED'].includes(String(p.injuryStatus).toUpperCase()))counts[p.position]++;
    return counts;
  }
  function lineupScore(players){
    const usable=(players||[]).filter(p=>core.includes(p.position)&&Number(p.weeklyValue)>=0&&p.slot!=='IR'&&!['OUT','INJURED'].includes(String(p.injuryStatus).toUpperCase()));
    const picked=new Set();let score=0;
    for(const [position,slots] of [['QB',1],['RB',2],['WR',2],['TE',1]]){
      const group=usable.filter(p=>p.position===position).sort((a,b)=>b.weeklyValue-a.weeklyValue).slice(0,slots);
      for(const p of group){picked.add(p.playerId);score+=Number(p.weeklyValue)}
    }
    const flex=usable.filter(p=>['RB','WR','TE'].includes(p.position)&&!picked.has(p.playerId)).sort((a,b)=>b.weeklyValue-a.weeklyValue)[0];
    return score+Number(flex?.weeklyValue||0);
  }
  function draw(teams,selected){
    const target=document.querySelector('#tradeHubResults');if(!target)return;
    const mine=teams.find(t=>String(t.teamId)===String(selected));if(!mine)return;
    const counts=inventory(mine);
    // Roster counts are a fit signal, not a valuation of individual players.
    const thresholds={QB:2,RB:4,WR:4,TE:2};
    const rank=core.slice().sort((a,b)=>(counts[a]/thresholds[a])-(counts[b]/thresholds[b]));
    const needs=rank.slice(0,2);
    const depth=rank.slice(-2).reverse();
    const offers=[];const mineBefore=lineupScore(mine.players);
    for(const other of teams){if(other.teamId===mine.teamId)continue;
      const theirs=inventory(other),otherBefore=lineupScore(other.players);
      for(const want of needs)for(const offer of depth){
        if(want===offer)continue;
        const fit=(theirs[want]/thresholds[want]-counts[want]/thresholds[want])+
          (counts[offer]/thresholds[offer]-theirs[offer]/thresholds[offer]);
        if(fit<=0)continue;
        const outgoing=(mine.players||[]).filter(p=>p.position===offer&&Number(p.weeklyValue)>=5&&p.slot!=='IR'&&!['OUT','INJURED'].includes(String(p.injuryStatus).toUpperCase()));
        const incoming=(other.players||[]).filter(p=>p.position===want&&Number(p.weeklyValue)>=5&&p.slot!=='IR'&&!['OUT','INJURED'].includes(String(p.injuryStatus).toUpperCase()));
        for(const give of outgoing)for(const receive of incoming){
          const gap=Math.abs(give.weeklyValue-receive.weeklyValue)/Math.max(give.weeklyValue,receive.weeklyValue);
          if(gap>.18)continue;
          const mineAfter=lineupScore([...mine.players.filter(p=>p.playerId!==give.playerId),receive]);
          const otherAfter=lineupScore([...other.players.filter(p=>p.playerId!==receive.playerId),give]);
          const myGain=mineAfter-mineBefore,theirGain=otherAfter-otherBefore;
          if(myGain<.5||theirGain<.5)continue;
          offers.push({other,give,receive,gap,fit,myGain,theirGain,score:myGain+theirGain+fit-gap*3});
        }
      }
    }
    offers.sort((a,b)=>b.score-a.score);
    const unique=[];const used=new Set();
    for(const x of offers){const key=`${x.other.teamId}|${x.give.playerId}|${x.receive.playerId}`;
      if(!used.has(key)){unique.push(x);used.add(key)}if(unique.length>=12)break;}
    target.innerHTML=`<div class="metrics">${core.map(p=>`<div class="metric"><span>${p} depth</span><strong>${counts[p]}</strong><small>Guide ${thresholds[p]}</small></div>`).join('')}</div>
      <div class="grid-2 section-gap"><div class="card"><h3>Thin positions to explore</h3><p>${needs.map(escTrade).join(', ')}</p><h3>Relative depth</h3><p>${depth.map(escTrade).join(', ')}</p><p class="muted">Counts exclude injured or IR players. ESPN weekly projections are preferred; recent actual scores are used when a projection is unavailable.</p></div>
      <div class="card"><h3>Proposed trades</h3>${unique.length?unique.slice(0,8).map(x=>`<div class="feature"><strong>Send ${escTrade(x.give.player)} (${escTrade(x.give.position)}) to ${escTrade(x.other.team)}</strong><span>Receive ${escTrade(x.receive.player)} (${escTrade(x.receive.position)})</span><span class="muted">Weekly estimate: ${Number(x.give.weeklyValue).toFixed(1)} vs ${Number(x.receive.weeklyValue).toFixed(1)} points • ${Math.round(x.gap*100)}% gap. Estimated starting-lineup gain: you +${x.myGain.toFixed(1)}, them +${x.theirGain.toFixed(1)} points per week.</span><small class="muted">${escTrade(x.give.valueSource)} / ${escTrade(x.receive.valueSource)}</small></div>`).join(''):'<p class="muted">No swap currently clears the fairness and two-sided lineup-improvement checks. More ESPN projection coverage may change this.</p>'}</div></div>`;
  }
  pages.trades=function(){
    archive();
    function showHub(d){
      const content=document.querySelector('#content');if(!content)return;
      const root=document.createElement('div');root.className='card section-gap';
      root.innerHTML='<span class="section-eyebrow">LIVE TRADE HUB</span><h2>Roster Needs & Trade Partners</h2><p class="muted">Specific player swaps must improve both projected starting lineups and have comparable weekly estimates. Review schedule, injuries and league context before offering a trade.</p><label>My team <select id="tradeHubTeam"></select></label><div id="tradeHubResults">Loading current rosters…</div>';
      content.prepend(root);
      if(!d)return;
      const teams=d.rosters||[];const picker=document.querySelector('#tradeHubTeam');
      picker.innerHTML=teams.map(t=>`<option value="${Number(t.teamId)}">${escTrade(t.team)}</option>`).join('');
      picker.addEventListener('change',()=>draw(teams,picker.value));draw(teams,picker.value);
    }
    showHub();
    fetch('/api/live').then(async r=>{const d=await r.json();if(!r.ok)throw Error(d.error||`HTTP ${r.status}`);return d}).then(d=>{
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
