(function(root){
  const value=(p,week)=>{if(p.rosWeeklyValue==null||!Number.isFinite(Number(p.rosWeeklyValue)))return null;
    let n=Number(p.rosWeeklyValue);const status=String(p.injuryStatus||'').toUpperCase();
    if(p.slot==='IR'||['OUT','INJURED','IR'].includes(status))return null;
    if(status==='DOUBTFUL')n*=.5;if(status==='QUESTIONABLE')n*=.85;
    if(p.byeWeek>=week&&p.byeWeek<=week+4&&!String(p.valueSource||'').includes('next'))n*=.9;
    return n;};
  function lineup(players,week){
    const usable=players.filter(p=>value(p,week)!=null),used=new Set();let total=0;
    for(const [pos,count] of [['QB',1],['RB',2],['WR',2],['TE',1]])for(const p of usable.filter(p=>p.position===pos).sort((a,b)=>value(b,week)-value(a,week)).slice(0,count)){used.add(String(p.playerId));total+=value(p,week);}
    const flex=usable.filter(p=>['RB','WR','TE'].includes(p.position)&&!used.has(String(p.playerId))).sort((a,b)=>value(b,week)-value(a,week))[0];
    return total+(flex?value(flex,week):0);
  }
  function combinations(players){const result=players.map(p=>[p]);for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++)result.push([players[i],players[j]]);return result;}
  function after(players,give,receive,protectedIds,week){
    const ids=new Set(give.map(p=>String(p.playerId))),incoming=new Set(receive.map(p=>String(p.playerId)));
    const roster=players.filter(p=>!ids.has(String(p.playerId))).concat(receive),drops=[];
    while(roster.length>players.length){
      const possible=roster.filter(p=>!incoming.has(String(p.playerId))&&!protectedIds.includes(String(p.playerId)))
        .sort((a,b)=>(value(a,week)??-1)-(value(b,week)??-1));
      if(!possible.length)return null;
      const drop=possible[0];roster.splice(roster.indexOf(drop),1);drops.push(drop);
    }
    return {roster,drops};
  }
  function propose(teams,mine,week,feedback={}){
    const usable=t=>(t.players||[]).filter(p=>['QB','RB','WR','TE'].includes(p.position)&&value(p,week)>=5).sort((a,b)=>value(b,week)-value(a,week)).slice(0,10);
    const mineComb=combinations(usable(mine).filter(p=>!(feedback.protected||[]).includes(String(p.playerId))));
    const before=lineup(mine.players,week),offers=[];
    for(const other of teams){if(String(other.teamId)===String(mine.teamId))continue;
      const otherBefore=lineup(other.players,week),otherComb=combinations(usable(other));
      for(const give of mineComb)for(const receive of otherComb){
        if(give.length===1&&receive.length===1)continue;
        const gv=give.reduce((n,p)=>n+value(p,week),0),rv=receive.reduce((n,p)=>n+value(p,week),0),gap=Math.abs(gv-rv)/Math.max(gv,rv);
        if(gap>.18)continue;
        const key=`${other.teamId}|${give.map(p=>p.playerId).sort().join(',')}|${receive.map(p=>p.playerId).sort().join(',')}`;
        if((feedback.bad||[]).includes(key))continue;
        const a=after(mine.players,give,receive,feedback.protected||[],week),b=after(other.players,receive,give,[],week);
        if(!a||!b)continue;
        const myGain=lineup(a.roster,week)-before,theirGain=lineup(b.roster,week)-otherBefore;
        if(myGain<.5||theirGain<.5)continue;
        offers.push({key,other,give:give[0],receive:receive[0],givePlayers:give,receivePlayers:receive,giveValue:gv,receiveValue:rv,gap,myGain,theirGain,dropMine:a.drops,dropOther:b.drops,
          score:myGain+theirGain-gap*3+((feedback.good||[]).includes(key)?3:0)});
      }
    }
    return offers.sort((a,b)=>b.score-a.score).slice(0,20);
  }
  root.LFLTradePackages={value,lineup,after,propose};
})(typeof window==='undefined'?globalThis:window);
