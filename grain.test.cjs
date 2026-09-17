const assert=require('node:assert/strict');
global.fmt=String;global.fromMm=n=>n;global.currentUnit='mm';
const {grainAllows,makePlan,makeExactPlan,makeRollPlan,makeMixedRollPlan,makeGroupedRollPlan}=require('./planner');
for(const source of ['x','y'])for(const axis of ['x','y'])for(const mode of ['with','across']){
  const grain={source,axis,mode};
  assert.notEqual(grainAllows(false,grain),grainAllows(true,grain));
  const expected=grainAllows(false,grain)?false:true;
  for(const plan of [makePlan(297,420,100,140,true,false,grain),makeExactPlan(297,420,100,140,3,true,false,grain),makeRollPlan(610,100,140,7,true,grain),makePlan(300,300,100,100,true,false,grain)]){
    assert.ok(plan);assert.ok(plan.rects.every(r=>r.rotated===expected));
  }
  const locked=makePlan(297,420,100,140,false,false,grain);assert.equal(!!locked,!expected);
  const jobs=[{w:100,h:140,qty:3,grain},{w:80,h:120,qty:4,grain:{...grain,mode:mode==='with'?'across':'with'}}];
  for(const plan of [makeMixedRollPlan(610,jobs,true),makeGroupedRollPlan(610,jobs,true)]){
    assert.equal(plan.count,7);assert.ok(plan.rects.every(r=>grainAllows(r.rotated,jobs[r.jobIndex].grain)));
  }
}
assert.equal(makePlan(300,400,100,100,true,false,{source:'none',mode:'with'}),null);
assert.equal(makeRollPlan(90,100,80,1,true,{source:'y',axis:'y',mode:'with'}),null);
// Exercise the bounded-search fallback with a large quantity.
const jobs=[{w:100,h:140,qty:3000,grain:{source:'y',axis:'y',mode:'across'}}];
const large=makeMixedRollPlan(610,jobs,true);assert.equal(large.count,3000);assert.ok(large.rects.every(r=>r.rotated));
console.log('Grain tests passed: all axes, square pieces, locked rotation, mixed/grouped rolls and fallback.');
