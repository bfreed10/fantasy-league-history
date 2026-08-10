const LEAGUE_ID = "1147670";
const LIVE_SEASON = process.env.LIVE_SEASON || "2026";

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

export default async function handler(req, res) {
  try {
    const espnS2 = (process.env.ESPN_S2 || "").trim();
    const swid = (process.env.SWID || "").trim();
    if (!espnS2 || !swid) return res.status(503).json({error:"Server environment variables ESPN_S2 and SWID are not configured."});

    const base = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${LIVE_SEASON}/segments/0/leagues/${LEAGUE_ID}`;
    const params = new URLSearchParams();
    ["mTeam","mRoster","mMatchup","mMatchupScore","mSettings","mSchedule","mTransactions2"].forEach(v=>params.append("view",v));
    const headers = {"User-Agent":"Mozilla/5.0","Accept":"application/json","Cookie":`espn_s2=${espnS2}; SWID=${swid}`};
    const response = await fetch(`${base}?${params.toString()}`, {headers});
    if (!response.ok) return res.status(502).json({error:`ESPN returned HTTP ${response.status}: ${(await response.text()).slice(0,180)}`});
    const data = await response.json();

    const members = {};
    for (const m of data.members || []) members[m.id] = m.displayName || m.id;
    const teams = {};
    const rosterOutput=[];
    const injuries=[];
    const playerNames={};

    for (const t of data.teams || []) {
      const owner=(t.owners||[]).map(x=>members[x]||x).join(", ");
      const name=teamName(t); const rec=overallRecord(t);
      teams[t.id]={name,owner,...rec};
      const players=[];
      for(const e of t?.roster?.entries || []){
        const p=playerObj(e); const pid=p.id ?? e.playerId ?? e?.playerPoolEntry?.id;
        const pname=p.fullName || p.name || (pid?`Player ${pid}`:"Unknown");
        if(pid) playerNames[pid]=pname;
        const status=p.injuryStatus || (p.injured?"INJURED":"ACTIVE");
        const position=POSITIONS[p.defaultPositionId] || "";
        const slot=SLOTS[e.lineupSlotId] || `Slot ${e.lineupSlotId ?? ""}`;
        players.push({player:pname,playerId:pid,position,slot,injuryStatus:status});
        if(status && !["ACTIVE","NORMAL","HEALTHY"].includes(String(status).toUpperCase())) injuries.push({player:pname,playerId:pid,position,team:name,status});
      }
      rosterOutput.push({teamId:t.id,team:name,owner,players});
    }

    const status = data.status || {};
    const currentWeek = status.currentMatchupPeriod || status.currentScoringPeriod || status.latestScoringPeriod || null;
    const matchups=[];
    for(const game of data.schedule || []){
      const week=game.matchupPeriodId;
      if(currentWeek && week!==currentWeek) continue;
      const home=game.home||{}, away=game.away||{};
      matchups.push({week,homeTeam:teams[home.teamId]?.name||"",homeOwner:teams[home.teamId]?.owner||"",homeScore:home.totalPoints??null,awayTeam:teams[away.teamId]?.name||"",awayOwner:teams[away.teamId]?.owner||"",awayScore:away.totalPoints??null});
    }

    let standings=Object.entries(teams).map(([id,t])=>({teamId:Number(id),team:t.name,owner:t.owner,wins:t.wins,losses:t.losses,ties:t.ties,pointsFor:t.pointsFor,pointsAgainst:t.pointsAgainst}));
    standings.sort((a,b)=>{const ga=a.wins+a.losses+a.ties,gb=b.wins+b.losses+b.ties;const wa=ga?(a.wins+.5*a.ties)/ga:0,wb=gb?(b.wins+.5*b.ties)/gb:0;return wb-wa||b.pointsFor-a.pointsFor;});
    const maxPF=Math.max(1,...standings.map(x=>x.pointsFor));
    for(const s of standings){const g=s.wins+s.losses+s.ties;const wp=g?(s.wins+.5*s.ties)/g:.5;const pf=g?s.pointsFor/maxPF:.5;s.powerScore=Math.round((55*wp+45*pf)*10)/10;}
    standings.sort((a,b)=>b.wins-a.wins||b.ties-a.ties||b.pointsFor-a.pointsFor);

    const rawTx=(data.transactions||[]).slice().sort((a,b)=>(safeDate(b.processDate||b.proposedDate)||0)-(safeDate(a.processDate||a.proposedDate)||0)).slice(0,50);
    const txIds=[...new Set(rawTx.flatMap(t=>(t.items||[]).map(i=>i.playerId).filter(Boolean)).filter(id=>!playerNames[id]))];
    if(txIds.length){
      try{
        const f={players:{filterIds:{value:txIds.slice(0,100)},filterStatsForTopScoringPeriodIds:{value:currentWeek||1,additionalValue:[`00${LIVE_SEASON}`,`10${LIVE_SEASON}`]}}};
        const pc=await fetch(`${base}?view=kona_playercard`,{headers:{...headers,"x-fantasy-filter":JSON.stringify(f)}});
        if(pc.ok){const pd=await pc.json();for(const row of pd.players||[]){const p=playerObj(row);const id=p.id||row.id;if(id)playerNames[id]=p.fullName||p.name||`Player ${id}`;}}
      }catch(_){ }
    }
    const transactions=rawTx.map(t=>({date:safeDate(t.processDate||t.proposedDate),team:teams[t.teamId]?.name||"League",type:t.type||"",status:t.status||"",items:(t.items||[]).map(i=>({type:i.type||"",action:i.type||"",playerId:i.playerId,player:playerNames[i.playerId]||`Player ${i.playerId||""}`,fromTeam:teams[i.fromTeamId]?.name||"",toTeam:teams[i.toTeamId]?.name||""}))}));

    res.setHeader("Cache-Control","no-store");
    return res.status(200).json({leagueId:LEAGUE_ID,season:Number(LIVE_SEASON),leagueName:data.name||"",currentWeek,matchups,standings,rosters:rosterOutput,transactions,injuries,updatedAt:new Date().toISOString()});
  } catch (error) {
    return res.status(503).json({error:error.message||"Unknown server error"});
  }
}
