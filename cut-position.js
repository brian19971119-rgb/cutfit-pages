// Fixed coordinates on the displayed, uncut sheet. Internal dimensions are mm.
function getCutPosition(cut, isRoll, paperWidth, paperHeight) {
  const horizontal = (cut.orientation === 'horizontal') !== !!isRoll;
  const displayHeight = isRoll ? paperWidth : paperHeight;
  const distance = horizontal ? displayHeight - cut.pos : cut.pos;
  return {
    orientation: horizontal ? 'horizontal' : 'vertical',
    reference: horizontal ? '原紙底邊往上：' : '原紙左邊往右：',
    cm: Number((Math.max(0, distance) / 10).toFixed(3))
  };
}
if (typeof module !== 'undefined') module.exports = { getCutPosition };
