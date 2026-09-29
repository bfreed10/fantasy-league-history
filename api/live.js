const LEAGUE_ID = "1147670";

const now = new Date();
const LIVE_SEASON = String(process.env.LIVE_SEASON || (
  now.getUTCMonth() >= 6
    ? now.getUTCFullYear()
    : now.getUTCFullYear() - 1
));

const POSITIONS = {1:"QB",2:"RB",3:"WR",4:"TE",5:"K",16:"D/ST"};
const SLOTS = {0:"QB",2:"RB",4:"WR",6:"TE",16:"D/ST",17:"K",20:"Bench",21:"IR",23:"Flex"};

function teamName(team) {
  if (!team) return "";
  if (team.name) return team.name;
  return `${team.location || ""} ${team.nickname || ""}`.trim() || `Team ${team.id || ""}`;
}
function overallRecord(team){
  const r = team?.record?.overall || team?.record || {};
  return {wins:Number(r.wins||0),losses:Number(r.losses||0),ties:Number(r.ties||0),pointsFor:Number(r.pointsFor||team?.points||0),pointsAgainst:Number(r.pointsAgainst||0)};
}
function playerObj(entry){ return entry?.playerPoolEntry?.player || entry?.player || entry?.playerPoolEntry || {}; }
function safeDate(v){ if(!v) return null; const n=Number(v); return Number.isFinite(n)?n:null; }
function playerValue(entry,week){
  const p=playerObj(entry), stats=[...(p.stats||[]),...(entry?.playerPoolEntry?.stats||[])];
  const score=s=>Number(s?.appliedTotal ?? s?.appliedStatTotal);
  const valid=s=>(s?.appliedTotal ?? s?.appliedStatTotal)!=null && Number.isFinite(score(s)) && score(s)>=0;
  const projected=stats.find(s=>Number(s.scoringPeriodId)===Number(week) && Number(s.statSourceId)===1 && valid(s));
  const actual=stats.filter(s=>Number(s.statSourceId)===0 && Number(s.scoringPeriodId)>0 && Number(s.scoringPeriodId)<Number(week) && valid(s))
    .sort((a,b)=>Number(a.scoringPeriodId)-Number(b.scoringPeriodId));
  const recent=actual.slice(-3);
  const recentAverage=recent.length>=2?recent.reduce((n,s)=>n+score(s),0)/recent.length:null;
  const upcoming=stats.filter(s=>Number(s.statSourceId)===1 &&
    Number(s.scoringPeriodId)>Number(week)&&Number(s.scoringPeriodId)<=Number(week)+4&&valid(s))
    .sort((a,b)=>Number(a.scoringPeriodId)-Number(b.scoringPeriodId));
  const futureAverage=upcoming.length>=2?upcoming.reduce((n,s)=>n+score(s),0)/upcoming.length:null;
  const weeklyValue=projected?score(projected):recentAverage;
  const rosWeeklyValue=futureAverage!=null
    ? (recentAverage!=null?futureAverage*.8+recentAverage*.2:futureAverage)
    : (weeklyValue!=null&&recentAverage!=null?weeklyValue*.55+recentAverage*.45:weeklyValue);
  return {weeklyValue:weeklyValue??null,rosWeeklyValue:rosWeeklyValue??null,
    valueSource:futureAverage!=null?`ESPN next ${upcoming.length} weeks + recent form`:
      projected?(recentAverage!=null?"ESPN projection + recent form":"ESPN weekly projection"):
      recentAverage!=null?`Last ${recent.length} completed weeks`:null,
    byeWeek:Number(p.byeWeek)||null};
}

export default async function handler(req, res) {
  try {
    const espnS2 = (process.env.ESPN_S2 || "").trim();
    const swid = (process.env.SWID || "").trim();
    if (!espnS2 || !swid) return res.status(503).json({error:"Server environment variables ESPN_S2 and SWID are not configured."});

    const requestedSeason=Number(req?.query?.season);
    const season=Number.isInteger(requestedSeason)&&requestedSeason>=2026&&requestedSeason<=Number(LIVE_SEASON)
      ? requestedSeason:Number(LIVE_SEASON);
    const base = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}`;
    const params = new URLSearchParams();
    ["mTeam","mRoster","mMatchup","mMatchupScore","mSettings","mSchedule","mTransactions2","mDraftDetail"].forEach(v=>params.append("view",v));
    const headers = {"User-Agent":"Mozilla/5.0","Accept":"application/json","Cookie":`espn_s2=${espnS2}; SWID=${swid}`};
    const response = await fetch(`${base}?${params.toString()}`, {headers});
    if (!response.ok) return res.status(502).json({error:`ESPN returned HTTP ${response.status}: ${(await response.text()).slice(0,180)}`});
    const data = await response.json();
    const currentWeek = data.status?.currentMatchupPeriod || data.status?.currentScoringPeriod || data.status?.latestScoringPeriod || null;
    const draftDetail = data.draftDetail || {};
const rawDraftPicks = Array.isArray(draftDetail.picks) ? draftDetail.picks : [];

    const members = {};
    for (const m of data.members || []) members[m.id] = m.displayName || m.id;
    const teams = {};
    const rosterOutput=[];
    const injuries=[];
    const playerNames={};
    const scoringSamples=[];

    for (const t of data.teams || []) {
      const owner=(t.owners||[]).map(x=>members[x]||x).join(", ");
      const name=teamName(t); const rec=overallRecord(t);
      teams[t.id]={name,owner,...rec};
      const players=[];
      for(const e of t?.roster?.entries || []){
        const p=playerObj(e); const pid=p.id ?? e.playerId ?? e?.playerPoolEntry?.id;
        const pname=p.fullName || p.name || (pid?`Player ${pid}`:"Unknown");
        if(pid) playerNames[pid]=pname;
        for(const stat of (p.stats||[]).filter(s=>Number(s.scoringPeriodId)>0).slice(0,2)){
          const applied=stat.appliedTotal??stat.appliedStatTotal;
          if(Number(stat.scoringPeriodId)>0 && stat.stats && applied!=null && Number.isFinite(Number(applied)) && scoringSamples.length<60)
            scoringSamples.push({position:p.defaultPositionId,stats:stat.stats,appliedTotal:Number(applied)});
        }
        const status=p.injuryStatus || (p.injured?"INJURED":"ACTIVE");
        const position=POSITIONS[p.defaultPositionId] || "";
        const slot=SLOTS[e.lineupSlotId] || `Slot ${e.lineupSlotId ?? ""}`;
        players.push({player:pname,playerId:pid,position,slot,injuryStatus:status,...playerValue(e,currentWeek)});
        if(status && !["ACTIVE","NORMAL","HEALTHY"].includes(String(status).toUpperCase())) injuries.push({player:pname,playerId:pid,position,team:name,status});
      }
      const counter=t.transactionCounter;
      rosterOutput.push({teamId:t.id,team:name,owner,players,transactionCounts:{
        acquisitions:Number(counter?.acquisitions ?? counter?.acquisition ?? 0),
        drops:Number(counter?.drops ?? 0),
        trades:Number(counter?.trades ?? 0)
      },transactionCountsAvailable:Boolean(counter)});
    }
    if(season===Number(LIVE_SEASON) && currentWeek && rosterOutput.some(t=>t.players.some(p=>p.weeklyValue==null))){
      try{
        const q=new URLSearchParams({scoringPeriodId:String(currentWeek)});
        q.append("view","mBoxscore");
        const r=await fetch(`${base}?${q}`,{headers:{...headers,"x-fantasy-filter":JSON.stringify({
          schedule:{filterMatchupPeriodIds:{value:[Number(currentWeek)]}}
        })}});
        if(r.ok){
          const box=await r.json(), values=new Map();
          for(const game of box.schedule||[])for(const side of [game.home,game.away])
            for(const e of side?.rosterForCurrentScoringPeriod?.entries||side?.rosterForMatchupPeriod?.entries||[]){
              const id=playerObj(e).id ?? e.playerId;
              if(id!=null)values.set(String(id),playerValue(e,currentWeek));
            }
          for(const team of rosterOutput)for(const player of team.players){
            if(player.rosWeeklyValue==null && values.get(String(player.playerId))?.rosWeeklyValue!=null)
              Object.assign(player,values.get(String(player.playerId)));
          }
        }
      }catch(_){/* Current roster remains available without player projections. */}
    }

    const status = data.status || {};
    const matchups=[];
    const completedMatchups=[];
    for(const game of data.schedule || []){
      const week=game.matchupPeriodId;
      const home=game.home||{}, away=game.away||{};
      const item={id:game.id,week,homeTeamId:home.teamId,awayTeamId:away.teamId,homeTeam:teams[home.teamId]?.name||"",homeOwner:teams[home.teamId]?.owner||"",homeScore:home.totalPoints??null,awayTeam:teams[away.teamId]?.name||"",awayOwner:teams[away.teamId]?.owner||"",awayScore:away.totalPoints??null,winner:game.winner||"UNDECIDED",playoffTierType:game.playoffTierType||"NONE"};
      if(week===currentWeek)matchups.push(item);
      if((season<Number(LIVE_SEASON)||week<currentWeek) && home.teamId!=null && away.teamId!=null && ["HOME","AWAY","TIE"].includes(item.winner) && item.homeScore!=null && item.awayScore!=null)completedMatchups.push(item);
    }

    let standings=Object.entries(teams).map(([id,t])=>({teamId:Number(id),team:t.name,owner:t.owner,wins:t.wins,losses:t.losses,ties:t.ties,pointsFor:t.pointsFor,pointsAgainst:t.pointsAgainst}));
    standings.sort((a,b)=>{const ga=a.wins+a.losses+a.ties,gb=b.wins+b.losses+b.ties;const wa=ga?(a.wins+.5*a.ties)/ga:0,wb=gb?(b.wins+.5*b.ties)/gb:0;return wb-wa||b.pointsFor-a.pointsFor;});
    const maxPF=Math.max(1,...standings.map(x=>x.pointsFor));
    for(const s of standings){const g=s.wins+s.losses+s.ties;const wp=g?(s.wins+.5*s.ties)/g:.5;const pf=g?s.pointsFor/maxPF:.5;s.powerScore=Math.round((55*wp+45*pf)*10)/10;}
    standings.sort((a,b)=>b.wins-a.wins||b.ties-a.ties||b.pointsFor-a.pointsFor);

    const rawTx=(data.transactions||[])
  .filter(t=>String(t.status||'').toUpperCase()==='EXECUTED')
  .filter(t=>{
    const type=String(t.type||t.executionType||'').toUpperCase();

    // Never expose lineup changes, pending/proposed activity,
    // failed waivers, or draft bookkeeping in Recent League Activity.
    if(type==='ROSTER' || type.includes('LINEUP')) return false;
    if(type==='DRAFT') return false;
    if(type.includes('PROPOSAL')) return false;
    if(type.includes('PENDING')) return false;
    if(type.includes('WAIVER_ERROR')) return false;

    if(type.includes('WAIVER') && !t.processDate) return false;
    return true;
  })
  .slice()
  .sort((a,b)=>
    (safeDate(b.processDate||b.proposedDate)||0)-
    (safeDate(a.processDate||a.proposedDate)||0)
  )
  .slice(0,50);
    const missingPlayerIds = [...new Set([
  ...rawTx.flatMap(t => (t.items || []).map(i => i.playerId)),
  ...rawDraftPicks.map(p => p.playerId)
].filter(Boolean).filter(id => !playerNames[id]))];
    if(missingPlayerIds.length){
      try{
        const f={players:{filterIds:{value:missingPlayerIds.slice(0,100)},filterStatsForTopScoringPeriodIds:{value:currentWeek||1,additionalValue:[`00${LIVE_SEASON}`,`10${LIVE_SEASON}`]}}};
        const pc=await fetch(`${base}?view=kona_playercard`,{headers:{...headers,"x-fantasy-filter":JSON.stringify(f)}});
        if(pc.ok){const pd=await pc.json();for(const row of pd.players||[]){const p=playerObj(row);const id=p.id||row.id;if(id)playerNames[id]=p.fullName||p.name||`Player ${id}`;}}
      }catch(_){ }
    }
    const draftPicks = rawDraftPicks.map(p => ({
  overallPick: Number(p.overallPickNumber ?? p.overallPick ?? 0),
  round: Number(p.roundId ?? p.round ?? 0),
  roundPick: Number(p.roundPickNumber ?? p.roundPick ?? 0),
  teamId: Number(p.teamId ?? 0),
  team: teams[p.teamId]?.name || `Team ${p.teamId || ""}`,
  owner: teams[p.teamId]?.owner || "",
  playerId: p.playerId ?? null,
  player: playerNames[p.playerId] || `Player ${p.playerId || ""}`,
  keeper: Boolean(p.keeper)
})).sort((a,b) => a.overallPick - b.overallPick);
    const transactions=rawTx.map(t=>({date:safeDate(t.processDate||t.proposedDate),team:teams[t.teamId]?.name||"League",type:t.type||"",status:t.status||"",items:(t.items||[]).map(i=>({type:i.type||"",action:i.type||"",playerId:i.playerId,player:playerNames[i.playerId]||`Player ${i.playerId||""}`,fromTeam:teams[i.fromTeamId]?.name||"",toTeam:teams[i.toTeamId]?.name||""}))}));

    res.setHeader("Cache-Control","no-store");
    return res.status(200).json({leagueId:LEAGUE_ID,season,leagueName:data.name||"",currentWeek,draftPicks,matchups,completedMatchups,standings,rosters:rosterOutput,transactions,injuries,scoringSettings:data.settings?.scoringSettings||null,scoringSamples,finalScoringPeriod:Number(data.status?.finalScoringPeriod||data.status?.finalScoringPeriodId||18),updatedAt:new Date().toISOString()});
  } catch (error) {
    return res.status(503).json({error:error.message||"Unknown server error"});
  }
}
