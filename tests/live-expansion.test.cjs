const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..'),history=JSON.parse(fs.readFileSync(path.join(root,'data/history_SAFE_MERGED_v10_4.json')));
(async()=>{
 const c={window:{},DATA:history};vm.createContext(c);vm.runInContext('const pages={injuries:()=>{}}',c);vm.runInContext(fs.readFileSync(path.join(root,'injury-room-audit.js'),'utf8'),c);
 const rows=c.window.LFLInjuryAudit.rows();const julio=rows.find(r=>r.Season===2013&&r.Player==='Julio Jones'),cobb=rows.find(r=>r.Season===2013&&r.Player==='Randall Cobb');
 assert(julio.TailExtended);assert(julio.SupportedInjuryGamesMissed>0);assert(cobb.UnverifiedTail);assert(!cobb.AvailabilityVerified);
 const live={season:2026,currentWeek:3,draftPicks:[{playerId:1},{playerId:2}],completedMatchups:[{week:1},{week:2}],rosters:[]};
 const pool={players:[{player:{id:2,fullName:'Dropped Player',stats:[{scoringPeriodId:1,statSourceId:0,appliedTotal:15},{scoringPeriodId:1,statSourceId:1,appliedTotal:12},{scoringPeriodId:2,statSourceId:0,appliedTotal:0}]}}]};
 const d={liveHandler:async(req,res)=>res.status(200).json(live),process:{env:{ESPN_S2:'test',SWID:'test'}},AbortSignal,fetch:async()=>({ok:true,json:async()=>pool}),console};vm.createContext(d);
 const source=fs.readFileSync(path.join(root,'api/draft-performance.js'),'utf8').replace("import liveHandler from './live.js';",'').replace('export default async function handler','async function handler');vm.runInContext(source,d);
 let payload;await d.handler({}, {status(code){assert.equal(code,200);return this;},setHeader(){},json(data){payload=data;}});
 assert.equal(payload.historyCoverage.playerWeeks,2);assert.equal(payload.playerHistoryBoxes[0].matchups[0].boxscore.home.players[0].playerId,2);assert.equal(payload.playerHistoryBoxes[1].matchups[0].boxscore.home.players[0].points,0);assert.equal(payload.playerHistoryBoxes[1].matchups[0].boxscore.home.players[0].projectedPoints,null);
 const teams=Array.from({length:6},(_,i)=>({id:i+1,name:'Team '+(i+1),record:{overall:{wins:i%3,losses:3-i%3,ties:0,pointsFor:300+i*20}}}));
 const schedule=[];for(let week=1;week<=14;week++)for(let i=0;i<6;i+=2)schedule.push({matchupPeriodId:week,home:{teamId:i+1,totalPoints:100+i,totalProjectedPointsLive:110+i},away:{teamId:i+2,totalPoints:95+i,totalProjectedPointsLive:105+i},winner:week<4?'HOME':'UNDECIDED'});
 const api=require(path.join(root,'api/odds.js'));const oldFetch=global.fetch;const oldS2=process.env.ESPN_S2,oldSwid=process.env.SWID;process.env.ESPN_S2='test';process.env.SWID='test';
 global.fetch=async()=>({ok:true,json:async()=>({teams,schedule,status:{currentMatchupPeriod:4},settings:{scheduleSettings:{numberOfRegularSeasonMatchups:14}}})});
 let odds;try{await api({}, {status(code){assert.equal(code,200);return this;},setHeader(){},json(data){odds=data;}});}finally{global.fetch=oldFetch;if(oldS2==null)delete process.env.ESPN_S2;else process.env.ESPN_S2=oldS2;if(oldSwid==null)delete process.env.SWID;else process.env.SWID=oldSwid;}
 assert(!odds.error);assert(odds.updatedAt);assert(odds.teams.every(t=>t.twelveWinsProbability>=0&&t.twelveWinsProbability<=1&&t.topThreeProbability>=0&&t.topThreeProbability<=1));
 for(const fun of Object.values(odds.weeklyFun)){assert(fun.anyFiveProbability>=0&&fun.anyFiveProbability<=1);assert(fun.anyThreeHundredProbability>=0&&fun.anyThreeHundredProbability<=1);assert(fun.lowestScorer.length>0);assert(fun.highestCombined.length>0);}
 console.log('PASS: reserve-tail repair, unverified injury windows, dropped-player history, zero vs missing stats, new futures and weekly probabilities.');
})().catch(e=>{console.error(e);process.exit(1)});
