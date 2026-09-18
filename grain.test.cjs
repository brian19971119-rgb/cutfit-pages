const assert = require('node:assert/strict');
const {
  GRAIN_NONE, GRAIN_WIDTH, GRAIN_HEIGHT,
  REQUIREMENT_NONE, REQUIREMENT_WITH, REQUIREMENT_AGAINST,
  REFERENCE_WIDTH, REFERENCE_HEIGHT,
  fiberAxisForPlacement, isOrientationAllowed, getAllowedRotations
} = require('./grain');

// 未指定原紙絲向：纖維軸永遠是 null，任何要求都視為符合（驗收情境 1）。
assert.equal(fiberAxisForPlacement(GRAIN_NONE, false), null);
assert.equal(fiberAxisForPlacement(GRAIN_NONE, true), null);
assert.equal(isOrientationAllowed({paperGrainAxis: GRAIN_NONE, requirement: REQUIREMENT_WITH, rotated: false}), true);
assert.equal(isOrientationAllowed({paperGrainAxis: GRAIN_NONE, requirement: REQUIREMENT_AGAINST, rotated: true}), true);
{
  const r = getAllowedRotations({paperGrainAxis: GRAIN_NONE, requirement: REQUIREMENT_NONE, allowRotate: true});
  assert.deepEqual(r.allowed, [false, true]);
  assert.equal(r.blockedByRotateToggle, false);
}

// 旋轉會翻轉纖維軸相對成品自身的方向。
assert.equal(fiberAxisForPlacement(GRAIN_WIDTH, false), GRAIN_WIDTH);
assert.equal(fiberAxisForPlacement(GRAIN_WIDTH, true), GRAIN_HEIGHT);
assert.equal(fiberAxisForPlacement(GRAIN_HEIGHT, false), GRAIN_HEIGHT);
assert.equal(fiberAxisForPlacement(GRAIN_HEIGHT, true), GRAIN_WIDTH);

// 驗收情境 2：原紙沿高度、成品以高度為基準、要求順絲 -> 只有未旋轉方向符合。
assert.equal(isOrientationAllowed({paperGrainAxis: GRAIN_HEIGHT, referenceEdge: REFERENCE_HEIGHT, requirement: REQUIREMENT_WITH, rotated: false}), true);
assert.equal(isOrientationAllowed({paperGrainAxis: GRAIN_HEIGHT, referenceEdge: REFERENCE_HEIGHT, requirement: REQUIREMENT_WITH, rotated: true}), false);

// 驗收情境 3：相同設定改成逆絲 -> 系統改用相反方向（只有旋轉後符合）。
assert.equal(isOrientationAllowed({paperGrainAxis: GRAIN_HEIGHT, referenceEdge: REFERENCE_HEIGHT, requirement: REQUIREMENT_AGAINST, rotated: false}), false);
assert.equal(isOrientationAllowed({paperGrainAxis: GRAIN_HEIGHT, referenceEdge: REFERENCE_HEIGHT, requirement: REQUIREMENT_AGAINST, rotated: true}), true);

// 基準邊改成寬度時，判斷應跟著反轉。
assert.equal(isOrientationAllowed({paperGrainAxis: GRAIN_HEIGHT, referenceEdge: REFERENCE_WIDTH, requirement: REQUIREMENT_WITH, rotated: false}), false);
assert.equal(isOrientationAllowed({paperGrainAxis: GRAIN_HEIGHT, referenceEdge: REFERENCE_WIDTH, requirement: REQUIREMENT_WITH, rotated: true}), true);

// 不限制絲向：兩個方向都符合，無論原紙絲向為何。
for (const axis of [GRAIN_NONE, GRAIN_WIDTH, GRAIN_HEIGHT]) {
  for (const rotated of [false, true]) {
    assert.equal(isOrientationAllowed({paperGrainAxis: axis, requirement: REQUIREMENT_NONE, rotated}), true);
  }
}

// 驗收情境 6：正方形成品（寬高相等）仍要保留邏輯方向差異——本模組只看 rotated 旗標，
// 不看實際寬高是否相等，所以正方形與非正方形的判斷邏輯完全相同，不會被誤判成「不限制」。
assert.equal(isOrientationAllowed({paperGrainAxis: GRAIN_WIDTH, referenceEdge: REFERENCE_HEIGHT, requirement: REQUIREMENT_WITH, rotated: false}), false);
assert.equal(isOrientationAllowed({paperGrainAxis: GRAIN_WIDTH, referenceEdge: REFERENCE_HEIGHT, requirement: REQUIREMENT_WITH, rotated: true}), true);

// 當原紙絲向已指定且要求順絲或逆絲時，未旋轉與旋轉恰好一個符合、一個不符合——
// 代表系統永遠能透過旋轉排出唯一合法方向（規格 2.4）。
for (const axis of [GRAIN_WIDTH, GRAIN_HEIGHT]) {
  for (const ref of [REFERENCE_WIDTH, REFERENCE_HEIGHT]) {
    for (const req of [REQUIREMENT_WITH, REQUIREMENT_AGAINST]) {
      const results = [false, true].map(rotated => isOrientationAllowed({paperGrainAxis: axis, referenceEdge: ref, requirement: req, rotated}));
      assert.deepEqual(results.filter(Boolean).length, 1, `axis=${axis} ref=${ref} req=${req}`);
    }
  }
}

// getAllowedRotations：允許旋轉時，只回傳絲向規則允許的那個方向。
{
  const r = getAllowedRotations({paperGrainAxis: GRAIN_HEIGHT, referenceEdge: REFERENCE_HEIGHT, requirement: REQUIREMENT_WITH, allowRotate: true});
  assert.deepEqual(r.allowed, [false]);
  assert.equal(r.canUnrotated, true);
  assert.equal(r.canRotated, false);
  assert.equal(r.blockedByRotateToggle, false);
}

// 驗收情境 4：關閉 90° 旋轉後，若唯一符合絲向的方向需要旋轉 -> 無可用方向，且要能區分
// 「純粹因為關閉旋轉開關」這個原因，讓 UI 顯示對應的說明文字。
{
  const r = getAllowedRotations({paperGrainAxis: GRAIN_HEIGHT, referenceEdge: REFERENCE_HEIGHT, requirement: REQUIREMENT_AGAINST, allowRotate: false});
  assert.deepEqual(r.allowed, []);
  assert.equal(r.canUnrotated, false);
  assert.equal(r.canRotated, false);
  assert.equal(r.blockedByRotateToggle, true);
}

// 反例：關閉旋轉開關，但唯一符合的方向本來就是未旋轉 -> 不算被旋轉開關卡住。
{
  const r = getAllowedRotations({paperGrainAxis: GRAIN_HEIGHT, referenceEdge: REFERENCE_HEIGHT, requirement: REQUIREMENT_WITH, allowRotate: false});
  assert.deepEqual(r.allowed, [false]);
  assert.equal(r.blockedByRotateToggle, false);
}

// 不限制絲向、關閉旋轉開關：仍然只有未旋轉方向可用，且不是被絲向卡住。
{
  const r = getAllowedRotations({paperGrainAxis: GRAIN_WIDTH, requirement: REQUIREMENT_NONE, allowRotate: false});
  assert.deepEqual(r.allowed, [false]);
  assert.equal(r.blockedByRotateToggle, false);
}

// 預設參數：不傳任何設定等同「不指定絲向、基準邊高度、不限制、允許旋轉」。
{
  const r = getAllowedRotations();
  assert.deepEqual(r.allowed, [false, true]);
}

console.log('Grain direction rule tests passed (axis mapping, with/against, rotate-toggle interaction, defaults).');
