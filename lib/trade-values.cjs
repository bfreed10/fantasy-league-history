const sources=['Yahoo','Sleeper','CBS'];
const scoring=require('./league-scoring.cjs');
function usable(feed,season,week,now=Date.now()){
  if(!feed || Number(feed.season)!==Number(season) || Number(feed.week)!==Number(week) || feed.horizon!=='ros_weekly')return false;
  if(!['league_points','espn_stat_ids'].includes(feed.format))return false;
  const age=now-Date.parse(feed.updatedAt);
  return Number.isFinite(age)&&age>=-300000&&age<=7*86400000&&Array.isArray(feed.players);
}
function blendPlayer(player,feeds,season,week,now=Date.now(),context={}){
  const estimates=[];
  if(player.rosWeeklyValue!=null&&Number.isFinite(Number(player.rosWeeklyValue)))estimates.push({source:'ESPN',value:Number(player.rosWeeklyValue)});
  for(const source of sources){const feed=feeds.sources?.[source];if(!usable(feed,season,week,now))continue;
    const rows=feed.players.filter(p=>String(p.espnId)===String(player.playerId));
    if(rows.length!==1)continue;
    const result=scoring.convertPlayer(rows[0],feed,context.profile,context.calibration,Number(week),context.endWeek);
    const value=result.value;
    if(value!=null&&Number.isFinite(Number(value))&&Number(value)>=0)estimates.push({source,value:Number(value)});
  }
  const value=estimates.length?estimates.reduce((n,p)=>n+p.value,0)/estimates.length:null;
  return {...player,espnWeeklyEstimate:player.rosWeeklyValue,rosWeeklyValue:value,valuationSources:estimates,
    valueSource:estimates.length>1?`${estimates.map(p=>p.source).join(' + ')} consensus (${estimates.length} sources)`:player.valueSource};
}
module.exports={sources,usable,blendPlayer};
