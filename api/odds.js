const LEAGUE_ID="1147670";
const seasonNow=()=>{const d=new Date();return String(d.getUTCMonth()>=6?d.getUTCFullYear():d.getUTCFullYear()-1)};
const num=v=>Number.isFinite(Number(v))?Number(v):0;
const american=p=>{p=Math.max(.01,Math.min(.99,p));return p>=.5?Math.round(-100*p/(1-p)):Math.round(100*(1-p)/p)};
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const sd=a=>{if(a.length<2)return Math.max(10,avg(a)*.18);const m=avg(a);return Math.max(8,Math.sqrt(avg(a.map(x=>(x-m)**2))))};
function rng(seed){let x=seed>>>0;return()=>{x=(x*1664525+1013904223)>>>0;return x/4294967296}};
function normal(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}

module.exports=async(req,res)=>{try{
 const season=String(process.env.LIVE_SEASON||seasonNow()),s2=(process.env.ESPN_S2||'').trim(),swid=(process.env.SWID||'').trim();
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
 const scored=Object.values(teams).flatMap(t=>t.scores);
 const leagueMean=scored.length?avg(scored):110;
 const leagueSd=scored.length>3?sd(scored):28;
 for(const t of Object.values(teams)){const n=t.scores.length;t.mean=(t.scores.reduce((a,b)=>a+b,0)+4*leagueMean)/(n+4);t.sd=Math.max(16,Math.min(55,n>=3?Math.sqrt((n*sd(t.scores)**2+4*leagueSd**2)/(n+4)):leagueSd))}
 const tm=new Map(Object.values(teams).map(t=>[t.id,t])), future=[];
 for(const g of schedule){const w=num(g.matchupPeriodId),h=tm.get(g.home?.teamId),a=tm.get(g.away?.teamId);if(h&&a&&w>=currentWeek&&w<=regular)future.push({week:w,home:h,away:a})}
 const byWeek={};future.forEach(g=>(byWeek[g.week]??=[]).push(g));
 const N=6000,r=rng(currentWeek*10007+Number(season)),all=Object.values(teams),nPlay=Math.min(6,all.length);
 const P={},C={},F={},first={},last={},mostPF={},tenWins={},twelveWins={},winOut={},topThree={},fewestPF={};for(const t of all){P[t.id]=C[t.id]=F[t.id]=first[t.id]=last[t.id]=mostPF[t.id]=tenWins[t.id]=twelveWins[t.id]=winOut[t.id]=topThree[t.id]=fewestPF[t.id]=0}
 for(let s=0;s<N;s++){
  const rec=Object.fromEntries(all.map(t=>[t.id,{w:t.wins+.5*t.ties,pf:num(data.teams?.find(x=>num(x.id)===t.id)?.record?.overall?.pointsFor)}]));
  for(let w=currentWeek;w<=regular;w++)for(const g of byWeek[w]||[]){const hs=Math.max(0,g.home.mean+g.home.sd*normal(r)),as=Math.max(0,g.away.mean+g.away.sd*normal(r));rec[g.home.id].pf+=hs;rec[g.away.id].pf+=as;if(hs>as)rec[g.home.id].w++;else if(as>hs)rec[g.away.id].w++;else{rec[g.home.id].w+=.5;rec[g.away.id].w+=.5}}
  const st=all.slice().sort((a,b)=>rec[b.id].w-rec[a.id].w||rec[b.id].pf-rec[a.id].pf);st.slice(0,nPlay).forEach(t=>P[t.id]++);st.slice(0,3).forEach(t=>topThree[t.id]++);const lowPF=all.slice().sort((a,b)=>rec[a.id].pf-rec[b.id].pf)[0];if(lowPF)fewestPF[lowPF.id]++;
  for(const t of all){if(rec[t.id].w>=12)twelveWins[t.id]++;const remaining=future.filter(g=>g.home.id===t.id||g.away.id===t.id).length;if(remaining>0&&rec[t.id].w>=t.wins+.5*t.ties+remaining)winOut[t.id]++;}if(st[0])first[st[0].id]++;if(st.at(-1))last[st.at(-1).id]++;for(const t of all)if(rec[t.id].w>=10)tenWins[t.id]++;const topPF=all.slice().sort((a,b)=>rec[b.id].pf-rec[a.id].pf)[0];if(topPF)mostPF[topPF.id]++;
  const pool=st.slice(0,nPlay);let finalists=[];
  const win=(a,b)=>Math.max(0,a.mean+a.sd*normal(r))>=Math.max(0,b.mean+b.sd*normal(r))?a:b;
  if(pool.length>=6){
    const q1=win(pool[2],pool[5]),q2=win(pool[3],pool[4]);
    finalists=[win(pool[0],q2),win(pool[1],q1)];
  }else if(pool.length>=4){
    finalists=[win(pool[0],pool[3]),win(pool[1],pool[2])];
  }
  if(finalists.length===2){F[finalists[0].id]++;F[finalists[1].id]++;const a=finalists[0],b=finalists[1];const pa=a.mean+a.sd*normal(r),pb=b.mean+b.sd*normal(r);C[(pa>=pb?a:b).id]++}else if(pool.length){F[pool[0].id]++;C[pool[0].id]++}
 }
 const rows=all.map(t=>{const p=P[t.id]/N,c=C[t.id]/N,f=F[t.id]/N,fp=first[t.id]/N,lp=last[t.id]/N,mp=mostPF[t.id]/N;return{id:t.id,name:t.name,wins:t.wins,losses:t.losses,ties:t.ties,avgPoints:+t.mean.toFixed(1),twelveWinsProbability:twelveWins[t.id]/N,twelveWinsOdds:american(twelveWins[t.id]/N),winOutProbability:winOut[t.id]/N,winOutOdds:american(winOut[t.id]/N),topThreeProbability:topThree[t.id]/N,topThreeOdds:american(topThree[t.id]/N),fewestPointsProbability:fewestPF[t.id]/N,fewestPointsOdds:american(fewestPF[t.id]/N),playoffProbability:p,championshipProbability:c,finalProbability:f,firstPlaceProbability:fp,lastPlaceProbability:lp,mostPointsProbability:mp,mostPointsOdds:american(mp),missPlayoffsProbability:1-p,missPlayoffsOdds:american(1-p),tenWinsProbability:tenWins[t.id]/N,tenWinsOdds:american(tenWins[t.id]/N),playoffOdds:american(p),championshipOdds:american(c),finalOdds:american(f),firstPlaceOdds:american(fp),lastPlaceOdds:american(lp)}}).sort((a,b)=>b.championshipProbability-a.championshipProbability);
 const currentBoxParams=new URLSearchParams();['mMatchupScore','mBoxscore'].forEach(v=>currentBoxParams.append('view',v));
 currentBoxParams.set('scoringPeriodId',String(currentWeek));
 const projections={};
 try{
  const br=await fetch(`${base}?${currentBoxParams}`,{headers:{...headers,'x-fantasy-filter':JSON.stringify({schedule:{filterMatchupPeriodIds:{value:[currentWeek]}}})}});
  if(br.ok){const bd=await br.json();for(const g of bd.schedule||[])for(const side of [g.home,g.away]){
   const id=num(side?.teamId),projection=Number(side?.totalProjectedPointsLive);
   if(id&&Number.isFinite(projection)&&projection>0)projections[id]=projection;
  }}
 }catch(_){/* Historical model remains available when ESPN projections fail. */}
 const cdf=z=>{const sign=z<0?-1:1,x=Math.abs(z)/Math.SQRT2,t=1/(1+.3275911*x),erf=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);return .5*(1+sign*erf)};
 const priced=p=>american(Math.max(.01,Math.min(.99,p*1.045)));
 const lines=future.map(g=>{
  const current=g.week===currentWeek;
  const hm=current&&projections[g.home.id]?projections[g.home.id]*.8+g.home.mean*.2:g.home.mean;
  const am=current&&projections[g.away.id]?projections[g.away.id]*.8+g.away.mean*.2:g.away.mean;
  const sdDiff=Math.hypot(g.home.sd,g.away.sd),diff=hm-am,total=hm+am;
  const hw=cdf(diff/sdDiff),homeSpread=Math.round(diff*2)/2,overProbability=cdf((total-(Math.round(total*2)/2))/sdDiff);
  const altSpreads=[-20,-10,0,10,20].map(line=>({line,homeCoverProbability:cdf((diff-line)/sdDiff),homeOdds:priced(cdf((diff-line)/sdDiff)),awayOdds:priced(1-cdf((diff-line)/sdDiff))}));
  const altTotals=[-20,-10,0,10,20].map(offset=>{const line=Math.round((total+offset)*2)/2,p=cdf((total-line)/sdDiff);return{line,overProbability:p,overOdds:priced(p),underOdds:priced(1-p)}});
  return{week:g.week,home:{id:g.home.id,name:g.home.name},away:{id:g.away.id,name:g.away.name},homeProjected:+hm.toFixed(1),awayProjected:+am.toFixed(1),projectionSource:current&&projections[g.home.id]&&projections[g.away.id]?'ESPN live projections + scoring history':'Scoring history',spread:homeSpread,total:Math.round(total*2)/2,homeWinProbability:hw,awayWinProbability:1-hw,homeMoneyline:priced(hw),awayMoneyline:priced(1-hw),homeSpreadOdds:priced(cdf((diff-homeSpread)/sdDiff)),awaySpreadOdds:priced(1-cdf((diff-homeSpread)/sdDiff)),overOdds:priced(overProbability),underOdds:priced(1-overProbability),altSpreads,altTotals};
 });
 const weeklyFun={};
 for(const [week,games] of Object.entries(byWeek)){
  const high={},blowout={},closest={},score150={},score200={},under70={},lowest={},shootout={};let over=0,anyUpset=0,anyThirty=0,anyFive=0,anyThreeHundred=0;
  const model=lines.filter(x=>x.week===Number(week));
  const B=3000,threshold=Math.round(model.reduce((n,x)=>n+x.homeProjected+x.awayProjected,0)/10)*10;
  for(let k=0;k<B;k++){
    let bestScore=-1,bestId=null,big=-1,bigId=null,close=Infinity,closeId=null,leagueTotal=0,upset=false,thirty=false,tight=false,threeHundred=false,lowScore=Infinity,lowId=null,bestTotal=-1,bestTotalId=null;
    for(const g of games){const line=model.find(x=>x.home.id===g.home.id&&x.away.id===g.away.id);
      const h=Math.max(0,(line?.homeProjected??g.home.mean)+g.home.sd*normal(r));
      const a=Math.max(0,(line?.awayProjected??g.away.mean)+g.away.sd*normal(r));
      leagueTotal+=h+a;
      for(const [id,score] of [[g.home.id,h],[g.away.id,a]]){if(score>=200)score200[id]=(score200[id]||0)+1;if(score<70)under70[id]=(under70[id]||0)+1;if(score<lowScore){lowScore=score;lowId=id}}
      if(h+a>bestTotal){bestTotal=h+a;bestTotalId=g.home.id+'-'+g.away.id}
      if(h+a>=300)threeHundred=true;if(Math.abs(h-a)<=5)tight=true;
      if(h>=150)score150[g.home.id]=(score150[g.home.id]||0)+1;
      if(a>=150)score150[g.away.id]=(score150[g.away.id]||0)+1;
      if(Math.abs(h-a)>=30)thirty=true;
      if((line?.homeWinProbability>=.65&&a>h)||(line?.awayWinProbability>=.65&&h>a))upset=true;
      for(const [id,score] of [[g.home.id,h],[g.away.id,a]])if(score>bestScore){bestScore=score;bestId=id}
      const margin=Math.abs(h-a);if(margin>big){big=margin;bigId=g.home.id+'-'+g.away.id}if(margin<close){close=margin;closeId=g.home.id+'-'+g.away.id}
    }
    if(bestId!=null)high[bestId]=(high[bestId]||0)+1;
    if(lowId!=null)lowest[lowId]=(lowest[lowId]||0)+1;if(bestTotalId)shootout[bestTotalId]=(shootout[bestTotalId]||0)+1;
    if(tight)anyFive++;if(threeHundred)anyThreeHundred++;
    if(bigId)blowout[bigId]=(blowout[bigId]||0)+1;
    if(closeId)closest[closeId]=(closest[closeId]||0)+1;
    if(leagueTotal>threshold)over++;if(upset)anyUpset++;if(thirty)anyThirty++;
  }
  const pick=(counts,key)=>Object.entries(counts).map(([id,n])=>({id,probability:n/B,odds:priced(n/B),name:key==='team'?tm.get(Number(id))?.name:games.find(g=>id===g.home.id+'-'+g.away.id)?.home.name+' vs '+games.find(g=>id===g.home.id+'-'+g.away.id)?.away.name})).sort((a,b)=>b.probability-a.probability).slice(0,3);
  weeklyFun[week]={highestScorer:pick(high,'team'),biggestBlowout:pick(blowout,'game'),closestGame:pick(closest,'game'),leagueTotal:threshold,overProbability:over/B,overOdds:priced(over/B),underOdds:priced(1-over/B),anyUpsetProbability:anyUpset/B,anyUpsetOdds:priced(anyUpset/B),anyThirtyProbability:anyThirty/B,anyThirtyOdds:priced(anyThirty/B),score150:pick(score150,'team'),score200:pick(score200,'team'),under70:pick(under70,'team'),lowestScorer:pick(lowest,'team'),highestCombined:pick(shootout,'game'),anyFiveProbability:anyFive/B,anyFiveOdds:priced(anyFive/B),anyThreeHundredProbability:anyThreeHundred/B,anyThreeHundredOdds:priced(anyThreeHundred/B)};
 }
 const scorer=all.slice().sort((a,b)=>b.mean-a.mean);const played=all.reduce((x,t)=>x+t.scores.length,0)/2,total=all.reduce((x,t)=>x+t.scores.reduce((a,b)=>a+b,0),0);
 res.setHeader('Cache-Control','no-store');res.status(200).json({season:Number(season),currentWeek,regularSeasonWeeks:regular,hypothetical:true,updatedAt:new Date().toISOString(),simulations:N,teams:rows,weeklyLines:lines,weeklyFun,currentLines:lines.filter(x=>x.week===currentWeek),fun:{highestScoringTeam:scorer[0]?{name:scorer[0].name,avgPoints:+scorer[0].mean.toFixed(1)}:null,lowestScoringTeam:scorer.at(-1)?{name:scorer.at(-1).name,avgPoints:+scorer.at(-1).mean.toFixed(1)}:null,leagueAverageScore:played?+(total/played).toFixed(1):100},note:'Entertainment-only estimates. Current week blends ESPN live projections with scoring history when available; future weeks use regressed team scoring. Approximate 4.5% pricing margin. No real wagers.'});
}catch(e){res.status(500).json({error:e.message||'Odds calculation failed'})}};
