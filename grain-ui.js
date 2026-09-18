// UI state is separate from the pure grain calculation module.
const grainState={enabled:false,axis:'none',referenceEdge:'height',requirement:'with'};
function readGrain(target=grainState){return {paperGrainAxis:grainState.enabled?grainState.axis:'none',referenceEdge:target.referenceEdge||'height',requirement:grainState.enabled?(target.requirement||'with'):'none'};}
function grainButtons(group,options,value,onChange){
  const row=document.createElement('div');row.className='grain-choices';row.setAttribute('role','group');row.setAttribute('aria-label',group);
  options.forEach(([key,label])=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.value=key;b.setAttribute('aria-pressed',String(value===key));b.addEventListener('click',()=>{row.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));onChange(key);});row.appendChild(b);});return row;
}
function createGrainTarget(target,onChange){
  const box=document.createElement('div');box.className='grain-target';
  const title=document.createElement('span');title.textContent='成品絲向';box.appendChild(title);
  box.appendChild(grainButtons('成品絲向',[['with','順絲 ∥'],['against','逆絲 ⊥']],target.requirement||'with',v=>{target.requirement=v;onChange();}));
  const caption=document.createElement('span');caption.textContent='以哪一邊為基準？';box.appendChild(caption);
  box.appendChild(grainButtons('成品基準邊',[['height','高邊'],['width','寬邊']],target.referenceEdge||'height',v=>{target.referenceEdge=v;onChange();}));
  return box;
}
function initGrainControls(){
  const source=document.createElement('div');source.className='grain-settings';
  source.innerHTML='<label class="grain-toggle"><input id="enableGrain" type="checkbox" aria-controls="grainSource" aria-expanded="false">紙張絲向</label><div id="grainSource" hidden><p id="grainAxisLabel">原紙纖維沿哪個方向？</p></div><p id="grainError" class="grain-error" role="status" hidden></p>';
  $('cutForm').querySelector('fieldset').appendChild(source);
  const choices=grainButtons('原紙絲向',[['width','沿寬度'],['height','沿高度']],grainState.axis,v=>{grainState.axis=v;renderBatchJobList();render();});
  choices.querySelectorAll('button').forEach(b=>{const icon=document.createElement('i');icon.className='grain-icon '+b.dataset.value;icon.setAttribute('aria-hidden','true');const text=document.createElement('span');text.textContent=b.textContent;b.replaceChildren(icon,text);});$('grainSource').appendChild(choices);
  const target=createGrainTarget(grainState,render);target.id='grainTarget';$('singleTargetFields').appendChild(target);
  $('enableGrain').addEventListener('change',e=>{grainState.enabled=e.target.checked;renderBatchJobList();render();});
  const summary=document.createElement('div');summary.id='grainSummary';summary.className='grain-summary';summary.hidden=true;document.querySelector('.plan-head').after(summary);
}
function updateGrainControls(){
  const ready=grainState.enabled&&grainState.axis!=='none';$('grainSource').hidden=!grainState.enabled;$('grainTarget').hidden=!ready;
  $('enableGrain').setAttribute('aria-expanded',String(grainState.enabled));
  $('grainAxisLabel').textContent=sourceMode==='roll'?'捲筒纖維沿哪個方向？':'原紙纖維沿哪個方向？';
  const buttons=$('grainSource').querySelectorAll('button');buttons.forEach(b=>{b.setAttribute('aria-pressed',String(b.dataset.value===grainState.axis));b.querySelector('span').textContent=b.dataset.value==='width'?'沿寬度':sourceMode==='roll'?'沿送紙方向':'沿高度';});
  const active=sourceMode==='roll'&&$('useBatch').checked?parseBatchInput($('batchInput').value).jobs.map(j=>readGrain(j.grain)): [readGrain()];
  const message=grainState.enabled&&!ready?'請先選擇原紙絲向。':active.some(g=>getAllowedRotations({...g,allowRotate:$('allowRotate').checked}).blockedByRotateToggle)?'絲向需要旋轉 90°，請開啟允許旋轉。':'';
  $('grainError').hidden=!message;$('grainError').textContent=message;
  return !message;
}
function clearGrainResult(message){
  stopCutAnimation();currentPlan=null;currentPaper=null;sheetPlanViews=[];renderLayoutGallery([]);
  $('layoutCanvas').replaceChildren();$('sequenceList').replaceChildren();$('layoutChoiceBar').replaceChildren();$('layoutChoiceBar').hidden=true;$('sheetPlanSwitch').replaceChildren();$('sheetPlanSwitch').hidden=true;$('playCuts').disabled=true;
  ['pieces','sheets','capacity','usage','waste','actual','extra','arrangement','measureW','measureH','currentLayoutLabel','stepBadge','stepTitle','stepDetail'].forEach(id=>$(id).textContent='—');
  $('cutPosition').textContent='';$('cutPosition').hidden=true;
  $('planDescription').textContent=message;$('feasibilityTitle').textContent=message;$('feasibilityText').textContent='請調整絲向、旋轉選項或紙張尺寸。';document.querySelector('.feasibility').classList.add('not-enough');$('grainSummary').hidden=true;
}
function finishGrainRender(){
  if(grainState.enabled&&!currentPlan){clearGrainResult('目前尺寸與絲向無法排版。');return;}
  paintGrain();
}
function paintGrain(){
  const ready=grainState.enabled&&grainState.axis!=='none';
  document.querySelectorAll('#layoutCanvas,.layout-preview-canvas').forEach(canvas=>{
    // Roll rendering swaps x/y; fibers stay aligned across the uncut stock.
    const roll=canvas.id==='layoutCanvas'&&currentPlan?.isRoll;
    canvas.dataset.grain=ready?(roll?(grainState.axis==='width'?'height':'width'):grainState.axis):'';
  });
  $('grainSummary').hidden=!ready||!currentPlan;
  if(ready){$('grainSummary').replaceChildren();for(const text of ['紙張絲向',sourceMode==='roll'&&grainState.axis==='height'?'沿送紙方向':grainState.axis==='width'?'沿寬度':'沿高度','細線表示纖維方向；裁切前整張紙的方向一致。']){const span=document.createElement('span');span.textContent=text;$('grainSummary').appendChild(span);}}
}
