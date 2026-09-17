// Grain axes use physical paper coordinates: x = width, y = height/feed.
function readGrain(){
  return {source:document.getElementById(sourceMode==='roll'?'rollGrain':'paperGrain')?.value||'none',axis:document.getElementById('targetGrainAxis')?.value||'y',mode:document.getElementById('targetGrainMode')?.value||'any'};
}
function createGrainTargetControls(grain,onChange,single=false){
  const box=document.createElement('div');box.className='grain-target';
  box.innerHTML='<label><span>成品基準邊</span><select data-grain-axis><option value="y">高度邊</option><option value="x">寬度邊</option></select></label><label><span>成品絲向要求</span><select data-grain-mode><option value="any">不限絲向</option><option value="with">順絲（平行基準邊）</option><option value="across">逆絲（垂直基準邊）</option></select></label>';
  const axis=box.querySelector('[data-grain-axis]'),mode=box.querySelector('[data-grain-mode]');axis.value=grain.axis||'y';mode.value=grain.mode||'any';
  if(single){axis.id='targetGrainAxis';mode.id='targetGrainMode';}
  box.addEventListener('change',()=>{onChange();animateGrain();});return box;
}
function animateGrain(){
  document.querySelectorAll('.grain-motion').forEach(el=>el.classList.remove('grain-motion'));
  requestAnimationFrame(()=>requestAnimationFrame(()=>document.querySelectorAll('.grain-sample,[data-paper-grain]').forEach(el=>el.classList.add('grain-motion'))));
}
function initGrainControls(){
  const source=document.createElement('div');source.className='grain-source';
  source.innerHTML='<label class="sheet-only"><span>原紙絲向</span><select id="paperGrain"><option value="none">不指定絲向</option><option value="x">沿寬度 ↔</option><option value="y">沿高度 ↕</option></select></label><label class="roll-only" hidden><span>捲筒紙絲向</span><select id="rollGrain"><option value="none">不指定絲向</option><option value="x">沿卷寬 ↔</option><option value="y">沿進紙方向 ↕</option></select></label><p>請依實際紙張設定，系統不會自動判斷絲向。</p>';
  document.getElementById('sourceLegend').closest('fieldset').appendChild(source);
  source.addEventListener('change',render);
  document.getElementById('singleTargetFields').appendChild(createGrainTargetControls({},render,true));
  const demo=document.createElement('div');demo.className='grain-demo';demo.id='grainDemo';
  demo.innerHTML='<div class="grain-sample" aria-hidden="true"><span id="grainSampleArrow">↕</span></div><div><b>絲向示意</b><p id="grainDemoText"></p><small>綠線：紙張絲向；橘邊：成品基準邊。</small><p>書冊請以裝訂邊為基準；旋轉仍須符合絲向要求。</p><button type="button" id="playGrain">播放絲向示意</button></div>';
  document.getElementById('singleTargetFields').appendChild(demo);
  document.getElementById('playGrain').addEventListener('click',animateGrain);
  const note=document.createElement('p');note.id='grainResultNote';note.className='grain-result-note';note.hidden=true;document.getElementById('planDescription').after(note);
}
function updateGrainDemo(){
  const g=readGrain(),sample=document.querySelector('.grain-sample');if(!sample)return;
  sample.dataset.reference=g.axis;
  const wanted=g.mode==='across'?(g.axis==='x'?'y':'x'):g.axis;
  sample.dataset.fiber=g.mode==='any'?'none':wanted;
  document.getElementById('grainSampleArrow').textContent=g.mode==='any'?'—':wanted==='x'?'↔':'↕';
  document.getElementById('grainDemoText').textContent=g.mode==='any'?'不限成品絲向。':g.mode==='with'?'絲向與基準邊平行。':'絲向與基準邊垂直。';
}
function activeGrains(){return sourceMode==='roll'&&document.getElementById('useBatch').checked?parseBatchInput(document.getElementById('batchInput').value).jobs.map(j=>j.grain):[readGrain()];}
function clearGrainResult(message){
  stopCutAnimation();currentPlan=null;currentPaper=null;sheetPlanViews=[];renderLayoutGallery([]);
  ['layoutCanvas','sequenceList','layoutChoiceBar','sheetPlanSwitch','currentLayoutLabel'].forEach(id=>document.getElementById(id).replaceChildren());
  document.getElementById('layoutChoiceBar').hidden=true;document.getElementById('playCuts').disabled=true;
  ['pieces','sheets','capacity','usage','waste','arrangement','actual','extra','measureW','measureH','stepBadge','stepTitle','stepDetail','cutPosition'].forEach(id=>document.getElementById(id).textContent='—');
  document.getElementById('planDescription').textContent=message;document.getElementById('feasibilityTitle').textContent=message;
  document.getElementById('feasibilityText').textContent='請檢查原紙絲向、成品基準邊、旋轉開關或紙張尺寸。';
  document.querySelector('.feasibility').classList.add('not-enough');document.getElementById('grainResultNote').hidden=true;
}
function validateGrain(){
  if(activeGrains().some(g=>g.mode!=='any'&&g.source==='none')){clearGrainResult('請先指定原紙絲向，再計算順絲或逆絲。');return false;}return true;
}
function paintGrain(){
  const g=readGrain(),roll=sourceMode==='roll';
  document.querySelectorAll('#layoutCanvas,.layout-preview-canvas').forEach(canvas=>{
    if(g.source==='none'){delete canvas.dataset.paperGrain;return;}
    canvas.dataset.paperGrain=roll?(g.source==='x'?'y':'x'):g.source;
  });
  const note=document.getElementById('grainResultNote');if(!note)return;note.hidden=g.source==='none';
  note.textContent=activeGrains().some(g=>g.mode!=='any')?'細線表示原紙絲向；排版已遵守各成品絲向要求。':'細線表示原紙絲向；成品未限制絲向。';
}
function finishGrainRender(){
  if(!currentPlan&&activeGrains().some(g=>g.mode!=='any'))clearGrainResult('目前尺寸與絲向限制下無法排版。');
  else paintGrain();
}
