const LEAGUE_ID = "1147670";

function getSeason(){
  const now = new Date();
  return String(now.getUTCMonth() >= 6 ? now.getUTCFullYear() : now.getUTCFullYear() - 1);
}

function finite(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function americanOdds(p){
  p = Math.max(0.01, Math.min(0.99, p));
  return p >= 0.5 ? Math.round(-100 * p / (1 - p)) : Math.round(100 * (1 - p) / p);
}

module.exports = async (req, res) => {
  try {
    const season = getSeason();
    const base = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}`;
    const headers = {};
    if(process.env.ESPN_S2) headers.Cookie = `espn_s2=${process.env.ESPN_S2}; SWID=${process.env.SWID || ''}`;

    const r = await fetch(`${base}?view=mTeam&view=mSettings`, { headers });
    if(!r.ok) throw new Error(`ESPN returned ${r.status}`);
    const data = await r.json();
    const teams = (data.teams || []).map((team, i) => {
      const record = team.record || {};
      const wins = finite(record.wins ?? record.overallWins);
      const losses = finite(record.losses ?? record.overallLosses);
      const pf = finite(record.pointsFor);
      const games = wins + losses;
      return { id:String(team.id ?? i), name:team.name || team.location || team.abbrev || `Team ${i+1}`, wins, losses, pf, avg:games ? pf/games : 0 };
    });

    const strengths = teams.map(t => Math.max(1, t.avg || 100));
    const total = strengths.reduce((a,b)=>a+b,0) || 1;
    const result = teams.map((t,i) => {
      const playoffProbability = Math.min(.99, Math.max(.05, .18 + .82 * (strengths[i]/total*teams.length)));
      const championshipProbability = Math.min(.75, Math.max(.01, strengths[i]/total));
      return {...t, playoffProbability, championshipProbability, playoffOdds:americanOdds(playoffProbability), championshipOdds:americanOdds(championshipProbability)};
    }).sort((a,b)=>b.championshipProbability-a.championshipProbability);

    res.status(200).json({season:Number(season), hypothetical:true, note:'Fun, no-money fantasy football odds. These are model estimates, not real betting lines.', teams:result});
  } catch(err) {
    res.status(500).json({error:err.message});
  }
};
