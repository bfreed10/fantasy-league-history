import liveHandler from './live.js';

// ESPN player-pool stats remain accessible after a player leaves league rosters.
export default async function handler(req,res) {
  let status=200,snapshot;
  await liveHandler(req,{setHeader(){},status(code){status=code;return this;},json(data){snapshot=data;return data;}});
  if(status!==200)return res.status(status).json(snapshot);
  const weeks=[...new Set((snapshot.completedMatchups||[]).map(g=>Number(g.week)))].sort((a,b)=>a-b);
  const ids=[...new Set(snapshot.draftPicks.map(p=>p.playerId).filter(id=>id!=null))];
  const byWeek=new Map(weeks.map(w=>[w,new Map()])),warnings=[];
  const headers={'Accept':'application/json','User-Agent':'Mozilla/5.0','Cookie':`espn_s2=${process.env.ESPN_S2}; SWID=${process.env.SWID}`};
  const base=`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${snapshot.season}/segments/0/leagues/1147670`;
  if(weeks.length)for(let start=0;start<ids.length;start+=60){
    try{
      const filter={players:{filterIds:{value:ids.slice(start,start+60)},filterStatsForTopScoringPeriodIds:{value:18,additionalValue:[`00${snapshot.season}`,`10${snapshot.season}`]}}};
      const response=await fetch(`${base}?view=kona_player_info&scoringPeriodId=${weeks.at(-1)}`,{headers:{...headers,'x-fantasy-filter':JSON.stringify(filter)},signal:AbortSignal.timeout(12000)});
      if(!response.ok)throw Error(`HTTP ${response.status}`);
      const data=await response.json();
      for(const pool of data.players||[]){
        const player=pool.player||pool,id=player.id??pool.id;
        if(!ids.some(x=>String(x)===String(id)))continue;
        const stats=[...(player.stats||[]),...(pool.stats||[])];
        for(const week of weeks){
          const actual=stats.find(s=>Number(s.scoringPeriodId)===week&&Number(s.statSourceId)===0);
          const projected=stats.find(s=>Number(s.scoringPeriodId)===week&&Number(s.statSourceId)===1);
          const score=s=>{const value=s?.appliedTotal??s?.appliedStatTotal;return value!=null&&Number.isFinite(Number(value))?Number(value):null;};
          if(score(actual)==null)continue;
          byWeek.get(week).set(String(id),{playerId:id,player:player.fullName,points:score(actual),projectedPoints:score(projected),historySource:'ESPN player pool'});
        }
      }
    }catch(error){warnings.push(`Player-history batch ${Math.floor(start/60)+1} unavailable (${error.message}); roster history used where available.`);}
  }
  const count=[...byWeek.values()].reduce((n,m)=>n+m.size,0);
  if(weeks.length && count===0)warnings.push('ESPN returned no drafted-player weekly history; roster box-score coverage remains the fallback.');
  res.setHeader('Cache-Control','no-store');
  return res.status(200).json({...snapshot,playerHistoryBoxes:[...byWeek.entries()].map(([selectedWeek,players])=>({selectedWeek,matchups:[{boxscore:{home:{players:[...players.values()]},away:{players:[]}}}]})),
    historyCoverage:{playerWeeks:count,possiblePlayerWeeks:ids.length*weeks.length,completedWeeks:weeks.length,draftedPlayers:ids.length},historyWarnings:warnings});
}
