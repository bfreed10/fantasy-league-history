const fs=require('fs'),vm=require('vm'),assert=require('assert');
process.chdir(require('path').resolve(__dirname,'..'));
const DATA=JSON.parse(fs.readFileSync('data/history_SAFE_MERGED_v10_4.json'));
const model=JSON.parse(fs.readFileSync('data/draft_value_v14.json'));
const source=fs.readFileSync('draft-lab-fix.js','utf8');
const context={window:{},DATA,document:{querySelector:()=>null},fetch:()=>{throw Error('unexpected fetch')}};vm.createContext(context);
vm.runInContext('const pages={draft:()=>{},records:()=>{},injuries:()=>{}};window.originalDraft=pages.draft;',context);
vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'window.testDraft={applyModel,draftSteal,stealCriteria,rankSteals,performanceBust,setData:d=>V141=d};})();'),context);
assert(!context.window.pages);assert(vm.runInContext('pages.draft !== window.originalDraft',context),'must activate with lexical pages');
context.window.testDraft.setData(model);context.window.testDraft.applyModel();
assert(DATA.draftAnalytics.topSteals.length>0);
for(const p of DATA.draftAnalytics.topSteals){assert(context.window.testDraft.draftSteal(p));assert.equal(p.ActualPoints,model.picks.find(m=>m.k===`${p.Season}|${p['Player ID']}|${p['Overall Pick']}`).sp);assert(Math.abs(p.ValueAboveSlot-(p.DraftValuePercentile-50))<.001);}
for(const file of ['player-records-fix.js','injury-room-audit.js']){
 const page=file.startsWith('player')?'records':'injuries';
 vm.runInContext(`window.before=pages.${page}`,context);vm.runInContext(fs.readFileSync(file,'utf8'),context);assert(vm.runInContext(`pages.${page}!==window.before`,context),file+' bootstrap');
}
const app=fs.readFileSync('app.js','utf8');vm.runInContext(app.slice(app.indexOf('function recordArchive'),app.indexOf('function renderRecords')),context);
const records=vm.runInContext('recordArchive(DATA.matchups)',context);
assert(records.length>1000);assert(records.length>DATA.records.highestScores.length);assert.equal(vm.runInContext('recordArchive([...DATA.matchups,...DATA.matchups]).length',context),records.length);
assert.equal(vm.runInContext(`recordArchive([{Season:2026,Week:1,Winner:'HOME','Home Team ID':1,'Away Team ID':2,'Home Score':null,'Away Score':1}]).length`,context),0);
console.log(JSON.stringify({activatedModules:3,qualifiedSteals:DATA.draftAnalytics.topSteals.length,completeGames:records.length,scoreEntries:records.length*2,leaders:DATA.draftAnalytics.topSteals.slice(0,3).map(p=>[p['Player Name'],p.Season,p['Overall Pick'],p.ActualPoints])}));

const f=context.window.testDraft;
const early={r:1,p:'QB',sp:200,pep:100,pea:200,dv:20,dc:1};
assert(f.draftSteal(early));assert.equal(f.stealCriteria(early).badge,'Beat Projections');
const value={r:1,p:'K',sp:200,dv:99,dc:10};assert(f.draftSteal(value));assert.equal(f.stealCriteria(value).badge,'Draft Value');
const both={...early,dv:95,dc:10};assert.equal(f.stealCriteria(both).badge,'Both');
assert(!f.draftSteal({...early,pea:130}));assert(!f.draftSteal({...early,pep:200,pea:240}));
assert(!f.draftSteal({...value,dc:9}));assert(!f.draftSteal({...early,pep:null,pea:null}));
assert.equal(f.rankSteals([value,early])[0],early);assert.equal(f.rankSteals([value,early],'draft')[0],value);
console.log('PASS: any round/position, both qualification paths, thresholds, unavailable projections and alternate sorting');

const busts=model.picks.filter(f.performanceBust);
assert(busts.length>7);assert(busts.some(r=>r.dv>10));
for(const row of busts){const injury=DATA.injuryAnalytics.players.find(p=>p.Season===row.s&&p.PlayerId===row.pid);assert.equal(injury.InjuryGamesMissed,0);assert(injury.EligibleFantasySeasonGames>=injury.FantasyEndWeek-1);}
console.log('PASS: combined bust criteria retain injury exclusions; '+busts.length+' eligible players.');
