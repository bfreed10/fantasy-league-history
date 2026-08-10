# League 1147670 — Vercel Deployment

This folder is safe to upload to GitHub/Vercel.

## IMPORTANT
Do NOT add your ESPN cookies to any source file.

The site expects these Vercel environment variables:
- `ESPN_S2`
- `SWID`
- optional: `LIVE_SEASON` (defaults to `2026`)

## Vercel
1. Create/import this repository as a new Vercel project.
2. Framework Preset: Other.
3. Root Directory: repository root.
4. Add `ESPN_S2` and `SWID` under Project Settings → Environment Variables.
5. Apply them to Production (and Preview if desired).
6. Redeploy after adding/changing environment variables.

## GitHub auto-deploy
When Vercel is connected to the GitHub repository, pushes to the production branch automatically create new production deployments.

## Security
`ESPN_S2` and `SWID` are read only inside `/api/live.py`.
The browser gets only sanitized live matchup JSON.
