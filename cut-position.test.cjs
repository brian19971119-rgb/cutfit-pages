const assert = require('node:assert/strict');
const {getCutPosition} = require('./cut-position');
global.fmt = n => String(n);
global.fromMm = n => n;
global.currentUnit = 'mm';
const {makeRollPlan,makePlan,buildCutSequence} = require('./planner');
const roll = makeRollPlan(610,297,420,2,true);
assert.equal(roll.usedLength,420);
const cuts = buildCutSequence(roll,610,420);
assert.deepEqual(cuts.map(c=>getCutPosition(c,true,610,420).cm),[42,31.3,1.6]);
assert.deepEqual(cuts.map(c=>getCutPosition(c,true,610,420).orientation),['vertical','horizontal','horizontal']);
assert.equal(getCutPosition({orientation:'horizontal',pos:152.4},false,297,420).cm,26.76);
assert.equal(getCutPosition({orientation:'vertical',pos:101.6},false,297,420).cm,10.16);
assert.equal(getCutPosition({orientation:'horizontal',pos:420},false,297,420).cm,0);
for(const [pw,ph,tw,th] of [[297,420,101.6,152.4],[420,297,100,140],[483,279.4,127,177.8]]) {
  const plan=makePlan(pw,ph,tw,th,true);
  for(const cut of buildCutSequence(plan,pw,ph)) {
    const p=getCutPosition(cut,false,pw,ph);
    assert.ok(Number.isFinite(p.cm)&&p.cm>=0);
    assert.ok(Math.abs(p.cm*10-(p.orientation==='horizontal'?ph-cut.pos:cut.pos))<.006);
  }
}
console.log('Cut position regression tests passed (roll rotation, sheets, precision, edges).');
