const fs=require('fs'),vm=require('vm'),assert=require('assert');
process.chdir(require('path').resolve(__dirname,'..'));
const DATA=JSON.parse(fs.readFileSync('data/history_SAFE_MERGED_v10_4.json'));
const model=JSON.parse(fs.readFileSync('data/draft_value_v14.json'));
const source=fs.readFileSync('draft-lab-fix.js','utf8');
const context={window:{},DATA,document:{querySelector:()=>null},fetch:()=>{throw Error('unexpected fetch')}};vm.createContext(context);
vm.runInContext('const pages={draft:()=>{},records:()=>{},injuries:()=>{}};window.originalDraft=pages.draft;',context);
vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'window.testDraft={applyModel,draftSteal,setData:d=>V141=d};})();'),context);
assert(!context.window.pages);assert(vm.runInContext('pages.draft !== window.originalDraft',context),'must activate with lexical pages');
context.window.testDraft.setData(model);context.window.testDraft.applyModel();
assert(DATA.draftAnalytics.topSteals.length>0);
for(const p of DATA.draftAnalytics.topSteals){assert(p.Round>=3);assert(p.DraftComparableCount>=10);assert(p.DraftValuePercentile>=90);assert.equal(p.ActualPoints,model.picks.find(m=>m.k===`${p.Season}|${p['Player ID']}|${p['Overall Pick']}`).sp);assert(Math.abs(p.ValueAboveSlot-(p.DraftValuePercentile-50))<.001);}
for(const file of ['player-records-fix.js','injury-room-audit.js']){
 const page=file.startsWith('player')?'records':'injuries';
 vm.runInContext(`window.before=pages.${page}`,context);vm.runInContext(fs.readFileSync(file,'utf8'),context);assert(vm.runInContext(`pages.${page}!==window.before`,context),file+' bootstrap');
}
const app=fs.readFileSync('app.js','utf8');vm.runInContext(app.slice(app.indexOf('function recordArchive'),app.indexOf('function renderRecords')),context);
const records=vm.runInContext('recordArchive(DATA.matchups)',context);
assert(records.length>1000);assert(records.length>DATA.records.highestScores.length);assert.equal(vm.runInContext('recordArchive([...DATA.matchups,...DATA.matchups]).length',context),records.length);
assert.equal(vm.runInContext(`recordArchive([{Season:2026,Week:1,Winner:'HOME','Home Team ID':1,'Away Team ID':2,'Home Score':null,'Away Score':1}]).length`,context),0);
console.log(JSON.stringify({activatedModules:3,qualifiedSteals:DATA.draftAnalytics.topSteals.length,completeGames:records.length,scoreEntries:records.length*2,leaders:DATA.draftAnalytics.topSteals.slice(0,3).map(p=>[p['Player Name'],p.Season,p['Overall Pick'],p.ActualPoints])}));
