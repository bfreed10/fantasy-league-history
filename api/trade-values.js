import liveHandler from './live.js';
import values from '../lib/trade-values.cjs';
import fs from 'node:fs';
import path from 'node:path';
let sleeperCache=null;
export default async function handler(req,res){
  let status=200,live;
  await liveHandler(req,{setHeader(){},status(code){status=code;return this;},json(data){live=data;return data;}});
  if(status!==200)return res.status(status).json(live);
  let feeds={sources:{}};
  try{feeds=JSON.parse(fs.readFileSync(path.join(process.cwd(),'data/trade_projection_feeds.json'),'utf8'));}catch{}
  feeds.sources ??= {};
  // Administrators may supply normalized, authorized feeds. Never forward ESPN cookies.
  const feedResults=await Promise.allSettled(values.sources.map(async source=>{
    const url=process.env[`TRADE_${source.toUpperCase()}_FEED_URL`];
    if(!url)return;
    const parsed=new URL(url);if(parsed.protocol!=='https:')throw Error('Feed must use HTTPS');
    const response=await fetch(url,{signal:AbortSignal.timeout(8000)});
    if(!response.ok)throw Error(`HTTP ${response.status}`);
    feeds.sources[source]=await response.json();
  }));
  const feedErrors=Object.fromEntries(feedResults.map((r,i)=>[values.sources[i],r.status==='rejected'?'Configured feed unavailable':null]));
  let sleeperStatus='Unavailable',players={};
  try{
    if(!sleeperCache||Date.now()-sleeperCache.at>86400000){
      const response=await fetch('https://api.sleeper.app/v1/players/nfl',{signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw Error('Sleeper unavailable');
      sleeperCache={at:Date.now(),data:await response.json()};
    }
    players=Object.fromEntries(Object.values(sleeperCache.data).filter(p=>p.espn_id!=null).map(p=>[String(p.espn_id),p]));
    sleeperStatus='Player metadata connected';
  }catch{}
  const rosters=live.rosters.map(t=>({...t,players:t.players.map(p=>({...values.blendPlayer(p,feeds,live.season,live.currentWeek),
    platformIds:{espn:p.playerId,sleeper:players[String(p.playerId)]?.player_id??null,yahoo:players[String(p.playerId)]?.yahoo_id??null},
    sleeperInjuryStatus:players[String(p.playerId)]?.injury_status??null}))}));
  const sourceStatus=[{source:'ESPN',status:'Connected',players:rosters.flatMap(t=>t.players).filter(p=>p.valuationSources.some(s=>s.source==='ESPN')).length},
    ...values.sources.map(source=>({source,status:values.usable(feeds.sources?.[source],live.season,live.currentWeek)?'Projection feed active':'Projection feed not connected',
      error:feedErrors[source],metadata:source==='Sleeper'?sleeperStatus:null,updatedAt:feeds.sources?.[source]?.updatedAt??null,
      players:rosters.flatMap(t=>t.players).filter(p=>p.valuationSources.some(s=>s.source===source)).length}))];
  res.setHeader('Cache-Control','no-store');
  res.status(200).json({...live,rosters,sourceStatus,valuationScoring:{ppr:1,passTd:4,horizon:'ros_weekly'},valuationNote:'Equal-weight mean of available matching player estimates. Only current-week, current-season feeds with matching PPR/4-point passing-TD scoring and a common rest-of-season weekly horizon are included. Missing sources contribute no weight.'});
}
