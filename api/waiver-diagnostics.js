import { timingSafeEqual } from "node:crypto";

const LEAGUE_ID = "1147670";
const isEqual = (a, b) => {
  const x = Buffer.from(a || "");
  const y = Buffer.from(b || "");
  return x.length === y.length && timingSafeEqual(x, y);
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "private, no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = process.env.WAIVER_DIAGNOSTIC_TOKEN;
  const authorization = req.headers.authorization || "";
  if (!token || !isEqual(authorization, `Bearer ${token}`))
    return res.status(401).json({ error: "Unauthorized" });

  const espnS2 = process.env.ESPN_S2 || process.env.ESPN_S2_COOKIE;
  const swid = process.env.ESPN_SWID || process.env.SWID;
  if (!espnS2 || !swid) return res.status(503).json({ error: "ESPN credentials not configured" });

  const season = Number(process.env.LIVE_SEASON || new Date().getUTCFullYear());
  const base = `https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/${season}/segments/0/leagues/${LEAGUE_ID}`;
  const params = new URLSearchParams();
  params.append("view", "mTransactions2");
  params.append("view", "mTeam");
  try {
    const response = await fetch(`${base}?${params}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json",
        Cookie: `espn_s2=${espnS2}; SWID=${swid}`
      }
    });
    if (!response.ok) return res.status(502).json({ error: `ESPN HTTP ${response.status}` });
    const data = await response.json();
    const names = Object.fromEntries((data.teams || []).map(t => [t.id, t.name || `${t.location || ""} ${t.nickname || ""}`.trim() || `Team ${t.id}`]));
    const transactions = (data.transactions || [])
      .filter(t => String(t.status || "").toUpperCase() !== "EXECUTED")
      .filter(t => /WAIVER|PENDING|PROPOSED/i.test([t.type, t.status].join(" ")))
      .map(t => ({
        team: names[t.teamId] || `Team ${t.teamId}`,
        status: t.status || null,
        type: t.type || null,
        proposedDate: t.proposedDate || null,
        processDate: t.processDate || null,
        items: (t.items || []).map(i => ({
          action: i.type || null,
          playerId: i.playerId || null,
          fromTeam: names[i.fromTeamId] || null,
          toTeam: names[i.toTeamId] || null
        }))
      }));
    return res.status(200).json({
      season,
      count: transactions.length,
      transactions,
      note: "Only non-executed waiver-related transactions returned by ESPN are shown. Missing claims cannot be inferred."
    });
  } catch {
    return res.status(502).json({ error: "ESPN request failed" });
  }
}
