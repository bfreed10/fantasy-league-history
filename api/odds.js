const LEAGUE_ID="1147670";
const seasonNow=()=>{const d=new Date();return String(d.getUTCMonth()>=6?d.getUTCFullYear():d.getUTCFullYear()-1)};
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const american=p=>{p=Math.max(.01,Math.min(.99,p));return p>=.5?Math.round(-100*p/(1-p)):Math.round(100*(1-p)/p)};
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const sd=a=>{if(a.length<2)return Math.max(10,avg(a)*.18);const m=avg(a);return Math.max(8,Math.sqrt(avg(a.map(x=>(x-m)**2))))};
function rng(seed){let x=seed>>>0;return()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296}};
function normal(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}

module.exports=async(req,res)=>{try{
 const season=seasonNow(),s2=(process.env.ESPN_S2||'').trim(),swid=(process.env.SWID||'').trim();
 if(!s2||!swid)return res.status(503).json({error:'ESPN credentials are not configured.'});
 const base=`https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}`;
 const headers={"User-Agent":"Mozilla/5.0","Accept":"application/json","Cookie":`espn_s2=${s2}; SWID=${swid}`};
 const q=new URLSearchParams();['mTeam','mSettings','mSchedule','mMatchup','mMatchupScore'].forEach(v=>q.append('view',v));
 const rr=await fetch(`${base}?${q}`,{headers});if(!rr.ok)throw Error(`ESPN returned HTTP ${rr.status}`);const data=await rr.json();
 const currentWeek=num(data.status?.currentMatchupPeriod||data.status?.currentScoringPeriod||1)||1;
 const teams={};
 for(const t of data.teams||[]){const rec=t.record?.overall||t.record||{};const id=num(t.id);teams[id]={id,name:t.name||`${t.location||''} ${t.nickname||''}`.trim()||`Team ${id}`,wins:num(rec.wins),losses:num(rec.losses),ties:num(rec.ties),scores:[]}}
 const schedule=Array.isArray(data.schedule)?data.schedule:[];
 for(const g of schedule){const h=teams[g.home?.teamId],a=teams[g.away?.teamId];if(!h||!a)continue;const hs=num(g.home?.totalPoints),as=num(g.away?.totalPoints);if(g.matchupPeriodId<currentWeek&&(hs||as)){h.scores.push(hs);a.scores.push(as)}}
 const regular=num(data.settings?.scheduleSettings?.numberOfRegularSeasonMatchups||data.settings?.scheduleSettings?.numRegularSeasonMatchups)||14;
 for(const t of Object.values(teams)){t.mean=t.scores.length?avg(t.scores):100;t.mean=Math.max(50,t.mean);t.sd=sd(t.scores)}
 const tm=new Map(Object.values(teams).map(t=>[t.id,t])), future=[];
 for(const g of schedule){const w=num(g.matchupPeriodId),h=tm.get(g.home?.teamId),a=tm.get(g.away?.teamId);if(h&&a&&w>=currentWeek&&w<=regular)future.push({week:w,home:h,away:a})}
 const byWeek={};future.forEach(g=>(byWeek[g.week]??=[]).push(g));
 const N=6000,r=rng(currentWeek*10007+Number(season)),all=Object.values(teams),nPlay=Math.min(6,all.length);
 const P={},C={},F={},first={},last={};for(const t of all){P[t.id]=C[t.id]=F[t.id]=first[t.id]=last[t.id]=0}
 for(let s=0;s<N;s++){
  const rec=Object.fromEntries(all.map(t=>[t.id,{w:t.wins,pf:t.scores.reduce((a,b)=>a+b,0)}]));
  for(let w=currentWeek;w<=regular;w++)for(const g of byWeek[w]||[]){const hs=Math.max(0,g.home.mean+g.home.sd*normal(r)),as=Math.max(0,g.away.mean+g.away.sd*normal(r));rec[g.home.id].pf+=hs;rec[g.away.id].pf+=as;if(hs>as)rec[g.home.id].w++;else if(as>hs)rec[g.away.id].w++;else{rec[g.home.id].w+=.5;rec[g.away.id].w+=.5}}
  const st=all.slice().sort((a,b)=>rec[b.id].w-rec[a.id].w||rec[b.id].pf-rec[a.id].pf);st.slice(0,nPlay).forEach(t=>P[t.id]++);if(st[0])first[st[0].id]++;if(st.at(-1))last[st.at(-1).id]++;
  const pool=st.slice(0,nPlay);let finalists=[];
  if(pool.length>=4){const pairs=pool.length>=6?[[pool[2],pool[5]],[pool[3],pool[4]]]:[[pool[0],pool[3]],[pool[1],pool[2]]];for(const [a,b] of pairs){const pa=a.mean+a.sd*normal(r),pb=b.mean+b.sd*normal(r);finalists.push(pa>=pb?a:b)}}
  if(finalists.length===2){F[finalists[0].id]++;F[finalists[1].id]++;const a=finalists[0],b=finalists[1];const pa=a.mean+a.sd*normal(r),pb=b.mean+b.sd*normal(r);C[(pa>=pb?a:b).id]++}else if(pool.length){F[pool[0].id]++;C[pool[0].id]++}
 }
 const rows=all.map(t=>{const p=P[t.id]/N,c=C[t.id]/N,f=F[t.id]/N,fp=first[t.id]/N,lp=last[t.id]/N;return{id:t.id,name:t.name,wins:t.wins,losses:t.losses,ties:t.ties,avgPoints:+t.mean.toFixed(1),playoffProbability:p,championshipProbability:c,finalProbability:f,firstPlaceProbability:fp,lastPlaceProbability:lp,playoffOdds:american(p),championshipOdds:american(c),finalOdds:american(f),firstPlaceOdds:american(fp),lastPlaceOdds:american(lp)}}).sort((a,b)=>b.championshipProbability-a.championshipProbability);
 const lines=future.map(g=>{const diff=g.home.mean-g.away.mean,total=g.home.mean+g.away.mean;const hw=1/(1+Math.exp(-diff/Math.max(10,(g.home.sd+g.away.sd)/2)));return{week:g.week,home:{id:g.home.id,name:g.home.name},away:{id:g.away.id,name:g.away.name},homeProjected:+g.home.mean.toFixed(1),awayProjected:+g.away.mean.toFixed(1),spread:+diff.toFixed(1),total:+total.toFixed(1),homeWinProbability:hw,awayWinProbability:1-hw,homeMoneyline:american(hw),awayMoneyline:american(1-hw)}});
 const scorer=all.slice().sort((a,b)=>b.mean-a.mean);const played=all.reduce((x,t)=>x+t.scores.length,0)/2,total=all.reduce((x,t)=>x+t.scores.reduce((a,b)=>a+b,0),0);
 res.setHeader('Cache-Control','no-store');res.status(200).json({season:Number(season),currentWeek,regularSeasonWeeks:regular,hypothetical:true,simulations:N,teams:rows,weeklyLines:lines,currentLines:lines.filter(x=>x.week===currentWeek),fun:{highestScoringTeam:scorer[0]?{name:scorer[0].name,avgPoints:+scorer[0].mean.toFixed(1)}:null,lowestScoringTeam:scorer.at(-1)?{name:scorer.at(-1).name,avgPoints:+scorer.at(-1).mean.toFixed(1)}:null,leagueAverageScore:played?+(total/played).toFixed(1):100},note:'Hypothetical no-money fantasy odds using current records, scoring history and remaining ESPN schedule.'});
}catch(e){res.status(500).json({error:e.message||'Odds calculation failed'})}};
