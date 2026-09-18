// 紙張絲向計算模組：純邏輯，不觸碰 DOM，不做任何排版計算。
// 只回答一個問題：在原紙絲向 / 成品基準邊 / 成品絲向要求已知的情況下，
// 「未旋轉」與「旋轉 90°」這兩種放置方式，哪些在絲向規則下是可用的。
//
// 座標系統說明：
// - 原紙絲向以「寬度方向」或「高度方向」表示（一般紙張）；
//   捲筒紙的「沿捲筒寬度方向」對應 width，「沿送紙方向」對應 height
//   （送紙方向與一般紙張的高度方向，在排版計算裡扮演相同角色：都是紙張前進、
//   刀序往下累加的那個軸），由呼叫端（UI 層）在傳入前做這層對應，
//   本模組一律只認識 'none' / 'width' / 'height' 三種值。
// - 成品基準邊只有 'width' 或 'height' 兩種，預設 'height'。
// - 成品絲向要求為 'none'（不限制）/ 'with'（順絲）/ 'against'（逆絲）。

const GRAIN_NONE = 'none';
const GRAIN_WIDTH = 'width';
const GRAIN_HEIGHT = 'height';

const REQUIREMENT_NONE = 'none';
const REQUIREMENT_WITH = 'with';
const REQUIREMENT_AGAINST = 'against';

const REFERENCE_WIDTH = 'width';
const REFERENCE_HEIGHT = 'height';

// 成品被放上原紙後，纖維方向相對於「成品自身座標軸」會落在哪一邊。
// rotated=false：成品的寬邊對齊原紙寬度軸、高邊對齊原紙高度軸，纖維方向直接等於原紙絲向。
// rotated=true：成品被轉了 90°，原本的寬邊改對齊原紙高度軸、高邊改對齊原紙寬度軸，
//               所以纖維方向相對成品自身而言，會從寬/高其中一邊翻到另一邊。
// 即使成品是正方形（寬高相等），這個翻轉仍然存在（規格 2.4：正方形仍要保留邏輯上的方向差異）。
function fiberAxisForPlacement(paperGrainAxis, rotated) {
  if (paperGrainAxis !== GRAIN_WIDTH && paperGrainAxis !== GRAIN_HEIGHT) return null;
  if (!rotated) return paperGrainAxis;
  return paperGrainAxis === GRAIN_WIDTH ? GRAIN_HEIGHT : GRAIN_WIDTH;
}

// 判斷單一放置方式（未旋轉或旋轉 90°）是否符合絲向要求。
// 未指定原紙絲向，或成品不限制絲向時，一律視為符合（維持與現行版本一致的計算結果）。
function isOrientationAllowed({ paperGrainAxis = GRAIN_NONE, referenceEdge = REFERENCE_HEIGHT, requirement = REQUIREMENT_NONE, rotated = false } = {}) {
  if (requirement !== REQUIREMENT_WITH && requirement !== REQUIREMENT_AGAINST) return true;
  const fiberAxis = fiberAxisForPlacement(paperGrainAxis, rotated);
  if (fiberAxis === null) return true;
  const parallelToReference = fiberAxis === referenceEdge;
  return requirement === REQUIREMENT_WITH ? parallelToReference : !parallelToReference;
}

// 回傳在目前絲向設定與「允許旋轉 90°」開關下，實際可用的放置方式。
// allowed：可用的 rotated 值陣列（[]、[false]、[true] 或 [false,true]）。
// blockedByRotateToggle：絲向規則其實只允許旋轉後的方向，但使用者關閉了旋轉開關，
//   導致目前無法排出任何成品——用來讓 UI 顯示「開啟旋轉即可排版」之類的說明，
//   而不是單純顯示空白結果（規格 2.4 最後一點、驗收情境 4）。
function getAllowedRotations({ paperGrainAxis = GRAIN_NONE, referenceEdge = REFERENCE_HEIGHT, requirement = REQUIREMENT_NONE, allowRotate = true } = {}) {
  const grainAllowed = [false, true].filter(rotated => isOrientationAllowed({ paperGrainAxis, referenceEdge, requirement, rotated }));
  const allowed = grainAllowed.filter(rotated => allowRotate || rotated === false);
  return {
    allowed,
    canUnrotated: allowed.includes(false),
    canRotated: allowed.includes(true),
    blockedByRotateToggle: allowed.length === 0 && grainAllowed.length > 0 && !allowRotate
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GRAIN_NONE, GRAIN_WIDTH, GRAIN_HEIGHT,
    REQUIREMENT_NONE, REQUIREMENT_WITH, REQUIREMENT_AGAINST,
    REFERENCE_WIDTH, REFERENCE_HEIGHT,
    fiberAxisForPlacement, isOrientationAllowed, getAllowedRotations
  };
}
