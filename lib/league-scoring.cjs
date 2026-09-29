const crypto=require('node:crypto');
const finite=v=>v!=null&&v!==''&&Number.isFinite(Number(v));
const positionId=p=>({QB:1,RB:2,WR:3,TE:4,K:5,'D/ST':16}[p]??Number(p));
function profile(settings){
  const input=settings?.scoringItems;
  if(!Array.isArray(input)||!input.length)return null;
  const items=[];
  for(const rule of input){
    if(!Number.isInteger(Number(rule.statId))||!finite(rule.points))return null;
    const overrides={};
    for(const key of Object.keys(rule.pointsOverrides||{}).sort()){
      if(!finite(rule.pointsOverrides[key]))return null;overrides[key]=Number(rule.pointsOverrides[key]);
    }
    items.push({statId:Number(rule.statId),points:Number(rule.points),pointsOverrides:overrides,isReverseItem:Boolean(rule.isReverseItem)});
  }
  items.sort((a,b)=>a.statId-b.statId);
  if(new Set(items.map(p=>p.statId)).size!==items.length)return null;
  const options={};
  for(const key of Object.keys(settings).filter(k=>k!=='scoringItems').sort())options[key]=settings[key];
  const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
  const hash=crypto.createHash('sha256').update(JSON.stringify(canonical({items,options}))).digest('hex');
  return {hash,items,options};
}
function score(stats,position,rules,{sparse=false}={}){
  if(!rules||!stats||typeof stats!=='object')return {value:null,error:'Scoring rules or stat line unavailable'};
  if(rules.options?.allowDecimalScores===false)return {value:null,error:'Nondecimal scoring requires a pre-scored feed with the full fingerprint'};
  const pos=positionId(position);if(!Number.isFinite(pos))return {value:null,error:'Player position unavailable'};
  let total=0;
  for(const rule of rules.items){
    const coefficient=rule.pointsOverrides[String(pos)]??rule.points;
    if(coefficient===0)continue;
    if(!finite(stats[String(rule.statId)])){
      if(sparse&&stats[String(rule.statId)]==null)continue;
      return {value:null,error:`Missing projected scoring category ${rule.statId}`};
    }
    // Bonus/bucket stat IDs must be supplied as projected event counts, never inferred from mean yardage.
    total+=Number(stats[String(rule.statId)])*coefficient;
  }
  return {value:rules.options?.allowNegativeScores===false?Math.max(0,total):total,error:null};
}
function calibrate(samples,rules){
  const checks=samples.map(p=>({expected:p.appliedTotal,calculated:score(p.stats,p.position,rules,{sparse:true}).value})).filter(p=>finite(p.expected));
  const matches=checks.filter(p=>p.calculated!=null&&Math.abs(p.expected-p.calculated)<=.05).length;
  return {samples:checks.length,matches,verified:checks.length>=3&&checks.filter(p=>Math.abs(p.expected)>.05).length>=3&&matches===checks.length};
}
function convertPlayer(row,feed,rules,calibration,week,endWeek){
  if(feed.format==='league_points'){
    if(!rules||feed.scoringHash!==rules.hash)return {value:null,error:'Full league-scoring fingerprint does not match'};
    return finite(row.value)?{value:Number(row.value),error:null}:{value:null,error:'Player estimate unavailable'};
  }
  if(feed.format!=='espn_stat_ids')return {value:null,error:'Feed format must declare full-scoring points or ESPN stat-ID projections'};
  if(!calibration?.verified)return {value:null,error:'Scoring conversion has not passed ESPN calibration'};
  if(!Array.isArray(row.weeks)||!Number.isInteger(endWeek)||endWeek<week)return {value:null,error:'Remaining-week projections unavailable'};
  const expectedWeeks=Array.from({length:endWeek-week+1},(_,i)=>week+i);
  const values=[];
  for(const w of expectedWeeks){
    const entries=row.weeks.filter(p=>Number(p.week)===w);if(entries.length!==1)return {value:null,error:`Missing or duplicate projection for week ${w}`};
    const result=score(entries[0].stats,row.position,rules);if(result.value==null)return result;values.push(result.value);
  }
  return {value:values.reduce((n,v)=>n+v,0)/values.length,error:null};
}
module.exports={profile,score,calibrate,convertPlayer};
