const LEAGUE_ID = "1147670";

const now = new Date();
const LIVE_SEASON = String(
  now.getUTCMonth() >= 6
    ? now.getUTCFullYear()
    : now.getUTCFullYear() - 1
);

const POSITIONS = {1:"QB",2:"RB",3:"WR",4:"TE",5:"K",16:"D/ST"};
const SLOTS = {0:"QB",2:"RB",4:"WR",6:"TE",16:"D/ST",17:"K",20:"Bench",21:"IR",23:"Flex"};

function teamName(team){
  if(!team) return "";
  if(team.name) return team.name;
  return `${team.location||""} ${team.nickname||""}`.trim() || `Team ${team.id||""}`;
}

function playerObj(entry){
  return entry?.playerPoolEntry?.player || entry?.player || entry?.playerPoolEntry || {};
}

function finiteOrNull(v){
  const n=Number(v);
  return Number.isFinite(n)?n:null;
}

function rosterEntries(side){
  return side?.rosterForCurrentScoringPeriod?.entries ||
         side?.rosterForMatchupPeriod?.entries || [];
}

function weeklyProjection(entry,week){
  const pool=entry?.playerPoolEntry||{};
  const p=pool.player||{};
  const stats=[
    ...(Array.isArray(p.stats)?p.stats:[]),
    ...(Array.isArray(pool.stats)?pool.stats:[])
  ];

  const sameWeek=stats.filter(
    s=>Number(s.scoringPeriodId)===Number(week)
  );

  const projected=
    sameWeek.find(s=>Number(s.statSourceId)===1) ||
    sameWeek.find(s=>Number(s.statTypeId)===2) ||
    sameWeek.find(s=>Number(s.statTypeId)===1);

  return finiteOrNull(
    projected?.appliedTotal ??
    projected?.appliedStatTotal
  );
}

function boxTeam(side,teams,week){
  const players=rosterEntries(side).map(e=>{
    const p=playerObj(e);
    const pid=p.id ?? e.playerId ?? e?.playerPoolEntry?.id;
    const slotId=Number(e.lineupSlotId);

    return {
      playerId:pid??null,
      player:p.fullName||p.name||(pid?`Player ${pid}`:"Unknown"),
      position:POSITIONS[p.defaultPositionId]||"",
      slot:SLOTS[slotId]||`Slot ${Number.isFinite(slotId)?slotId:""}`,
      starter:![20,21].includes(slotId),
      points:finiteOrNull(
        e?.playerPoolEntry?.appliedStatTotal ??
        e?.appliedStatTotal
      ),
      projectedPoints:weeklyProjection(e,week),
      injuryStatus:
        p.injuryStatus ||
        e.injuryStatus ||
        (p.injured?"INJURED":"ACTIVE")
    };
  });

  const starterProj=players
    .filter(p=>p.starter&&p.projectedPoints!=null)
    .map(p=>p.projectedPoints);
  const starterPoints=players
  .filter(p=>p.starter&&p.points!=null)
  .map(p=>p.points);

const liveScore=starterPoints.length
  ? starterPoints.reduce((a,b)=>a+b,0)
  : null;

  return {
    teamId:Number(side?.teamId||0),
    team:teams[side?.teamId]?.name||
      (side?.teamId?`Team ${side.teamId}`:""),
    owner:teams[side?.teamId]?.owner||"",
    score:
  liveScore ??
  finiteOrNull(side?.rosterForCurrentScoringPeriod?.appliedStatTotal) ??
  finiteOrNull(side?.totalPoints),
    projectedScore:
      finiteOrNull(side?.totalProjectedPointsLive) ??
      (starterProj.length
        ? starterProj.reduce((a,b)=>a+b,0)
        : null),
    players
  };
}

export default async function handler(req,res){
  try{
    const espnS2=(process.env.ESPN_S2||"").trim();
    const swid=(process.env.SWID||"").trim();

    if(!espnS2||!swid){
      return res.status(503).json({
        error:"Server environment variables ESPN_S2 and SWID are not configured."
      });
    }

    const base=
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${LIVE_SEASON}/segments/0/leagues/${LEAGUE_ID}`;

    const headers={
      "User-Agent":"Mozilla/5.0",
      "Accept":"application/json",
      "Cookie":`espn_s2=${espnS2}; SWID=${swid}`
    };

    const metaParams=new URLSearchParams();

    ["mTeam","mSchedule"].forEach(
      v=>metaParams.append("view",v)
    );

    const metaResponse=await fetch(
      `${base}?${metaParams.toString()}`,
      {headers}
    );

    if(!metaResponse.ok){
      return res.status(502).json({
        error:`ESPN returned HTTP ${metaResponse.status}: ${(await metaResponse.text()).slice(0,180)}`
      });
    }

    const meta=await metaResponse.json();

    const members={};

    for(const m of meta.members||[]){
      members[m.id]=m.displayName||m.id;
    }

    const teams={};

    for(const t of meta.teams||[]){
      teams[t.id]={
        name:teamName(t),
        owner:(t.owners||[])
          .map(x=>members[x]||x)
          .join(", ")
      };
    }

    const currentWeek=Number(
      meta?.status?.currentMatchupPeriod ||
      meta?.status?.currentScoringPeriod ||
      meta?.status?.latestScoringPeriod ||
      1
    );

    const availableWeeks=[
      ...new Set(
        (meta.schedule||[])
          .map(g=>Number(g.matchupPeriodId))
          .filter(n=>Number.isFinite(n)&&n>0)
      )
    ].sort((a,b)=>a-b);

    const requestedWeek=Number(req?.query?.week);

    const selectedWeek=
      Number.isFinite(requestedWeek) &&
      requestedWeek>0 &&
      (!availableWeeks.length ||
       availableWeeks.includes(requestedWeek))
        ? requestedWeek
        : currentWeek;

    const boxParams=new URLSearchParams();

    [
      "mMatchupScore",
      "mBoxscore",
      "mLiveScoring",
      "mScoreboard"
    ].forEach(v=>boxParams.append("view",v));

    boxParams.set(
      "scoringPeriodId",
      String(selectedWeek)
    );

    boxParams.set(
      "matchupPeriodId",
      String(selectedWeek)
    );

    const boxResponse=await fetch(
      `${base}?${boxParams.toString()}`,
      {headers}
    );

    if(!boxResponse.ok){
      return res.status(502).json({
        error:`ESPN box score returned HTTP ${boxResponse.status}: ${(await boxResponse.text()).slice(0,180)}`
      });
    }

    const box=await boxResponse.json();

    const matchups=(box.schedule||[])
      .filter(
        g=>Number(g.matchupPeriodId)===selectedWeek
      )
      .map(game=>{
        const away=boxTeam(
          game.away||{},
          teams,
          selectedWeek
        );

        const home=boxTeam(
          game.home||{},
          teams,
          selectedWeek
        );

        return {
          id:
            game.id ??
            `${selectedWeek}-${away.teamId}-${home.teamId}`,
          week:selectedWeek,
          winner:game.winner||"UNDECIDED",
          playoffTierType:
            game.playoffTierType||"NONE",

          awayTeamId:away.teamId,
          awayTeam:away.team,
          awayOwner:away.owner,
          awayScore:away.score,
          awayProjectedScore:away.projectedScore,

          homeTeamId:home.teamId,
          homeTeam:home.team,
          homeOwner:home.owner,
          homeScore:home.score,
          homeProjectedScore:home.projectedScore,

          boxscore:{away,home}
        };
      });

    res.setHeader("Cache-Control","no-store");

    return res.status(200).json({
      season:Number(LIVE_SEASON),
      currentWeek,
      selectedWeek,
      availableWeeks,
      matchups,
      updatedAt:new Date().toISOString()
    });

  }catch(error){
    return res.status(503).json({
      error:error.message||"Unknown server error"
    });
  }
}
