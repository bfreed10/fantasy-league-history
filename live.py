import json
import os
import time
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse

import requests

LEAGUE_ID = "1147670"
LIVE_SEASON = int(os.environ.get("LIVE_SEASON", "2026"))

def team_name(team):
    if not team:
        return ""
    return (
        team.get("name")
        or (str(team.get("location", "")) + " " + str(team.get("nickname", ""))).strip()
        or f"Team {team.get('id', '')}"
    )

def get_live_payload():
    espn_s2 = os.environ.get("ESPN_S2", "").strip()
    swid = os.environ.get("SWID", "").strip()

    if not espn_s2 or not swid:
        raise RuntimeError(
            "Server environment variables ESPN_S2 and SWID are not configured."
        )

    url = (
        "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/"
        f"seasons/{LIVE_SEASON}/segments/0/leagues/{LEAGUE_ID}"
    )
    views = ["mTeam", "mRoster", "mMatchup", "mMatchupScore", "mSettings", "mSchedule"]
    params = [("view", v) for v in views]
    headers = {
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json",
        "Cookie": f"espn_s2={espn_s2}; SWID={swid}",
    }

    response = requests.get(url, params=params, headers=headers, timeout=20)
    if response.status_code != 200:
        raise RuntimeError(
            f"ESPN returned HTTP {response.status_code}: {response.text[:180]}"
        )

    data = response.json()

    members = {}
    for member in data.get("members", []) or []:
        members[member.get("id")] = member.get("displayName") or member.get("id")

    teams = {}
    for team in data.get("teams", []) or []:
        owner_text = ", ".join(members.get(x, x) for x in (team.get("owners") or []))
        teams[team.get("id")] = {
            "name": team_name(team),
            "owner": owner_text,
        }

    status = data.get("status") or {}
    current_week = (
        status.get("currentMatchupPeriod")
        or status.get("currentScoringPeriod")
    )

    matchups = []
    for game in data.get("schedule", []) or []:
        week = game.get("matchupPeriodId")
        if current_week and week != current_week:
            continue

        home = game.get("home") or {}
        away = game.get("away") or {}
        hid = home.get("teamId")
        aid = away.get("teamId")

        matchups.append(
            {
                "week": week,
                "homeTeam": teams.get(hid, {}).get("name"),
                "homeOwner": teams.get(hid, {}).get("owner"),
                "homeScore": home.get("totalPoints"),
                "awayTeam": teams.get(aid, {}).get("name"),
                "awayOwner": teams.get(aid, {}).get("owner"),
                "awayScore": away.get("totalPoints"),
            }
        )

    return {
        "leagueId": LEAGUE_ID,
        "season": LIVE_SEASON,
        "leagueName": data.get("name"),
        "currentWeek": current_week,
        "matchups": matchups,
        "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            payload = get_live_payload()
            body = json.dumps(payload).encode("utf-8")
            self.send_response(200)
        except Exception as exc:
            body = json.dumps({"error": str(exc)}).encode("utf-8")
            self.send_response(503)

        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
