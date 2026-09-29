const assert=require('assert'),{profile,score,calibrate,convertPlayer}=require('../lib/league-scoring.cjs');
const rules=profile({scoringItems:[{statId:3,points:.04},{statId:4,points:4},{statId:20,points:-2},{statId:42,points:.1},{statId:53,points:1,pointsOverrides:{4:1.5}},{statId:99,points:3}]});
const stats={3:250,4:2,20:1,42:50,53:5,99:.25};
assert.equal(score(stats,'QB',rules).value,26.75);assert.equal(score(stats,'TE',rules).value,29.25);
assert.equal(score({...stats,99:undefined},'QB',rules).value,null);
const calibration=calibrate([1,2,3].map(position=>({position,stats,appliedTotal:26.75})),rules);assert(calibration.verified);assert(!calibrate([{position:1,stats,appliedTotal:30}],rules).verified);
const row={position:'TE',weeks:[{week:4,stats},{week:5,stats:{...stats,53:7}}]};assert.equal(convertPlayer(row,{format:'espn_stat_ids'},rules,calibration,4,5).value,30.75);
assert.equal(convertPlayer({...row,weeks:row.weeks.slice(0,1)},{format:'espn_stat_ids'},rules,calibration,4,5).value,null);
assert.equal(convertPlayer(row,{format:'espn_stat_ids'},rules,{verified:false},4,5).value,null);
assert.equal(convertPlayer({value:10},{format:'league_points',scoringHash:rules.hash},rules,calibration,4,5).value,10);
assert.equal(convertPlayer({value:10},{format:'league_points',scoringHash:'different'},rules,calibration,4,5).value,null);
assert.notEqual(rules.hash,profile({scoringItems:[{statId:3,points:.05}]}).hash);
assert.equal(rules.hash,profile({scoringItems:rules.items.slice().reverse()}).hash);
console.log('PASS: full scoring fingerprint, passing/reception/turnover/bonus stats, position overrides, calibration, missing categories and complete remaining weeks.');

assert(!calibrate([1,2,3].map(position=>({position,stats:{},appliedTotal:0})),rules).verified);
assert.equal(score({3:0,4:0,20:1,42:0,53:0,99:0},'QB',profile({allowNegativeScores:false,scoringItems:rules.items})).value,0);
assert.equal(score(stats,'QB',profile({allowDecimalScores:false,scoringItems:rules.items})).value,null);
