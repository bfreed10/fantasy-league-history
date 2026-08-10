const LEAGUE_ID = "1147670";
const LIVE_SEASON = process.env.LIVE_SEASON || "2026";

function teamName(team) {
  if (!team) return "";

  if (team.name) return team.name;

  const combined = `${team.location || ""} ${team.nickname || ""}`.trim();

  return combined || `Team ${team.id || ""}`;
}

export default async function handler(req, res) {
  try {
    const espnS2 = (process.env.ESPN_S2 || "").trim();
    const swid = (process.env.SWID || "").trim();

    if (!espnS2 || !swid) {
      return res.status(503).json({
        error: "Server environment variables ESPN_S2 and SWID are not configured."
      });
    }

    const base =
      `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/` +
      `seasons/${LIVE_SEASON}/segments/0/leagues/${LEAGUE_ID}`;

    const views = [
      "mTeam",
      "mRoster",
      "mMatchup",
      "mMatchupScore",
      "mSettings",
      "mSchedule"
    ];

    const params = new URLSearchParams();

    for (const view of views) {
      params.append("view", view);
    }

    const response = await fetch(`${base}?${params.toString()}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Cookie": `espn_s2=${espnS2}; SWID=${swid}`
      }
    });

    if (!response.ok) {
      const text = await response.text();

      return res.status(502).json({
        error: `ESPN returned HTTP ${response.status}: ${text.slice(0, 180)}`
      });
    }

    const data = await response.json();

    const members = {};

    for (const member of data.members || []) {
      members[member.id] = member.displayName || member.id;
    }

    const teams = {};

    for (const team of data.teams || []) {
      const owners = (team.owners || [])
        .map(id => members[id] || id)
        .join(", ");

      teams[team.id] = {
        name: teamName(team),
        owner: owners
      };
    }

    const status = data.status || {};

    const currentWeek =
      status.currentMatchupPeriod ||
      status.currentScoringPeriod ||
      null;

    const matchups = [];

    for (const game of data.schedule || []) {
      const week = game.matchupPeriodId;

      if (currentWeek && week !== currentWeek) {
        continue;
      }

      const home = game.home || {};
      const away = game.away || {};

      const homeInfo = teams[home.teamId] || {};
      const awayInfo = teams[away.teamId] || {};

      matchups.push({
        week,
        homeTeam: homeInfo.name || "",
        homeOwner: homeInfo.owner || "",
        homeScore: home.totalPoints ?? null,
        awayTeam: awayInfo.name || "",
        awayOwner: awayInfo.owner || "",
        awayScore: away.totalPoints ?? null
      });
    }

    res.setHeader("Cache-Control", "no-store");

    return res.status(200).json({
      leagueId: LEAGUE_ID,
      season: Number(LIVE_SEASON),
      leagueName: data.name || "",
      currentWeek,
      matchups,
      updatedAt: new Date().toISOString()
    });

  } catch (error) {
    return res.status(503).json({
      error: error.message || "Unknown server error"
    });
  }
}
