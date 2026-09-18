const assert = require('node:assert/strict');
global.fmt = n => String(n);
global.fromMm = n => n;
global.currentUnit = 'mm';
const { makePlan, makeExactPlan, makeRollPlan, makeMixedRollPlan, makeGroupedRollPlan } = require('./planner');
const { GRAIN_NONE, GRAIN_WIDTH, GRAIN_HEIGHT, REQUIREMENT_NONE, REQUIREMENT_WITH, REQUIREMENT_AGAINST, REFERENCE_HEIGHT, getAllowedRotations } = require('./grain');

// 驗收情境 1：不指定絲向時，結果必須與絲向功能上線前完全一致。
{
  const pw=600,ph=450,tw=100,th=150;
  const before=makePlan(pw,ph,tw,th,true);
  const withNone=makePlan(pw,ph,tw,th,true,false,{paperGrainAxis:GRAIN_NONE,requirement:REQUIREMENT_NONE});
  assert.deepEqual(withNone.rects,before.rects);
  assert.equal(withNone.name,before.name);
  assert.equal(withNone.count,before.count);

  const beforeExact=makeExactPlan(pw,ph,tw,th,6,true);
  const exactWithNone=makeExactPlan(pw,ph,tw,th,6,true,false,{paperGrainAxis:GRAIN_NONE});
  assert.deepEqual(exactWithNone.rects,beforeExact.rects);

  const beforeRoll=makeRollPlan(300,tw,th,10,true);
  const rollWithNone=makeRollPlan(300,tw,th,10,true,{paperGrainAxis:GRAIN_NONE});
  assert.deepEqual(rollWithNone.rects,beforeRoll.rects);
}

// 驗收情境 2：原紙沿高度、成品以高度為基準、要求順絲 -> 成品不得錯誤旋轉（只能用未旋轉方向）。
{
  const pw=600,ph=450,tw=100,th=150;
  const plan=makePlan(pw,ph,tw,th,true,false,{paperGrainAxis:GRAIN_HEIGHT,referenceEdge:REFERENCE_HEIGHT,requirement:REQUIREMENT_WITH});
  assert.ok(plan && plan.count>0);
  assert.ok(plan.rects.every(r=>r.rotated===false));
}

// 驗收情境 3：相同設定改成逆絲 -> 系統選用相反方向（只能用旋轉方向）。
{
  const pw=600,ph=450,tw=100,th=150;
  const plan=makePlan(pw,ph,tw,th,true,false,{paperGrainAxis:GRAIN_HEIGHT,referenceEdge:REFERENCE_HEIGHT,requirement:REQUIREMENT_AGAINST});
  assert.ok(plan && plan.count>0);
  assert.ok(plan.rects.every(r=>r.rotated===true));
}

// 驗收情境 4：關閉 90° 旋轉後，若唯一符合絲向的方向需要旋轉，必須排不出任何成品，
// 好讓上層 UI 依 getAllowedRotations 的 blockedByRotateToggle 顯示清楚的說明，而不是空白結果。
{
  const pw=600,ph=450,tw=100,th=150;
  const grain={paperGrainAxis:GRAIN_HEIGHT,referenceEdge:REFERENCE_HEIGHT,requirement:REQUIREMENT_AGAINST};
  const plan=makePlan(pw,ph,tw,th,false,false,grain);
  assert.equal(plan,null);
  const reason=getAllowedRotations({...grain,allowRotate:false});
  assert.equal(reason.blockedByRotateToggle,true);
}

// 反例：若唯一符合絲向的方向本來就是未旋轉，關閉旋轉開關不應影響排版。
{
  const pw=600,ph=450,tw=100,th=150;
  const grain={paperGrainAxis:GRAIN_HEIGHT,referenceEdge:REFERENCE_HEIGHT,requirement:REQUIREMENT_WITH};
  const plan=makePlan(pw,ph,tw,th,false,false,grain);
  assert.ok(plan && plan.count>0);
  assert.ok(plan.rects.every(r=>r.rotated===false));
}

// 驗收情境 5：混合尺寸中，一種成品順絲、另一種逆絲，兩者皆正確排版（各自套用自己的絲向設定）。
{
  const jobs=[
    {w:100,h:150,qty:4,label:'A',grain:{referenceEdge:REFERENCE_HEIGHT,requirement:REQUIREMENT_WITH}},
    {w:80,h:120,qty:4,label:'B',grain:{referenceEdge:REFERENCE_HEIGHT,requirement:REQUIREMENT_AGAINST}}
  ];
  const plan=makeMixedRollPlan(400,jobs,true,GRAIN_HEIGHT);
  assert.ok(plan && plan.rects.length===8);
  const aRects=plan.rects.filter(r=>r.jobIndex===0),bRects=plan.rects.filter(r=>r.jobIndex===1);
  assert.equal(aRects.length,4);
  assert.equal(bRects.length,4);
  assert.ok(aRects.every(r=>r.rotated===false));
  assert.ok(bRects.every(r=>r.rotated===true));
}

// 驗收情境 6：正方形成品旋轉後外形相同，但邏輯絲向仍須正確判斷——
// 若絲向規則只允許「旋轉後」的邏輯方向，即使 tw===th，排版器也不能因為外形相同而漏判，
// 必須仍然回傳可用的排版（並標記為 rotated:true）。
{
  const pw=500,ph=500,tw=100,th=100;
  const grain={paperGrainAxis:GRAIN_WIDTH,referenceEdge:REFERENCE_HEIGHT,requirement:REQUIREMENT_WITH};
  // 對正方形而言，width 絲向 + height 基準 + 順絲，只有「旋轉後」的邏輯方向符合。
  const allowed=getAllowedRotations({...grain,allowRotate:true});
  assert.deepEqual(allowed.allowed,[true]);
  const plan=makePlan(pw,ph,tw,th,true,false,grain);
  assert.ok(plan && plan.count>0, 'square product with grain-only-valid-when-rotated must still produce a plan');
  assert.ok(plan.rects.every(r=>r.rotated===true));
}

// Stock grain belongs to the whole roll, never to an individual job.
for(const planFn of [makeMixedRollPlan,makeGroupedRollPlan]){
  const result=planFn(400,[{w:100,h:150,qty:4,grain:{paperGrainAxis:'width',requirement:'with'}}],true,'height');
  assert.ok(result.rects.every(r=>!r.rotated));
}
// Large quantities must reach the bounded fallback rather than overflow the call stack.
{
  const result=makeMixedRollPlan(400,[{w:100,h:150,qty:3000,grain:{requirement:'with'}},{w:80,h:120,qty:3000,grain:{requirement:'against'}}],true,'height');
  assert.equal(result.count,6000);
  assert.ok(result.rects.every(r=>r.rotated===(r.jobIndex===1)));
}
console.log('Planner grain integration tests passed, including shared stock grain and large quantity fallback.');
