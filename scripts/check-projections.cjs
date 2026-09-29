// Daily probe: refresh configured feeds through the live API and retain a health report.
const fs=require('node:fs');
async function get(url,headers={}){const r=await fetch(url,{headers,signal:AbortSignal.timeout(60000)});if(!r.ok)throw Error(`Request failed: HTTP ${r.status}`);return r.json();}
async function siteUrl(){
  if(process.env.PROJECTION_SITE_URL)return process.env.PROJECTION_SITE_URL;
  const repo=process.env.GITHUB_REPOSITORY,token=process.env.GITHUB_TOKEN;
  if(!repo||!token)throw Error('Set PROJECTION_SITE_URL to the production website URL.');
  const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json'};
  const deployments=await get(`https://api.github.com/repos/${repo}/deployments?per_page=20`,headers);
  for(const d of deployments.filter(d=>d.production_environment||String(d.environment).toLowerCase()==='production')){
    const statuses=await get(`https://api.github.com/repos/${repo}/deployments/${d.id}/statuses`,headers);
    const status=statuses.find(s=>s.state==='success'&&s.environment_url);
    if(status)return status.environment_url;
  }
  throw Error('Production URL could not be discovered. Set PROJECTION_SITE_URL in repository Actions variables.');
}
async function main(){
  const url=new URL(await siteUrl());if(url.protocol!=='https:')throw Error('Production URL must use HTTPS');
  const data=await get(new URL('/api/trade-values',url));
  const report={checkedAt:new Date().toISOString(),season:data.season,week:data.currentWeek,scoringHash:data.valuationScoring?.scoringHash,
    calibration:data.valuationScoring?.calibration,sources:data.sourceStatus||[],note:'This probe refreshes live inputs; unavailable provider feeds require configuration. It does not create projections.'};
  fs.writeFileSync('projection-health.json',JSON.stringify(report,null,2)+'\n');
  const summary=`## Projection source health\n\nChecked ${report.checkedAt} • ${report.season}, week ${report.week}\n\n`+
    '| Source | Status | Players | Feed updated |\n|---|---|---|---|\n'+report.sources.map(s=>`| ${s.source} | ${s.status} | ${s.players} | ${s.updatedAt||'—'} |`).join('\n')+
    `\n\nScoring calibration: ${report.calibration?.matches||0}/${report.calibration?.samples||0} matched. External feeds remain excluded unless full scoring validation succeeds.\n`;
  if(process.env.GITHUB_STEP_SUMMARY)fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,summary);
  console.log(summary);
  if(!report.scoringHash)throw Error('Live league scoring rules unavailable.');
  if(!report.sources.some(s=>s.source==='ESPN'&&s.players>0))throw Error('ESPN estimates unavailable.');
  if(report.sources.some(s=>s.error||s.status.startsWith('Feed excluded')))throw Error('One or more configured feeds failed validation. See health report.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
