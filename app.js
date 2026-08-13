const $ = id => document.getElementById(id);
const factors = { mm: 1, cm: 10, in: 25.4 };
let currentUnit = 'mm';
let currentPlan = null;
let currentPaper = null;
let pickerTarget = 'paper';
let activeFamily = 'A';
let cutTimers = [];
let sourceMode = 'sheet';
let rollLengthMode = 'continuous';
let isCutPlaying = false;
let sheetPlanViews = [];
const REPORT_EMAIL = 'brian19971119@gmail.com';
const ECPAY_SUPPORT_URL = 'https://p.ecpay.com.tw/723D6E7';
const ECPAY_SUPPORT_HOST = 'p.ecpay.com.tw';
const ECPAY_SUPPORT_PATH = '/723D6E7';
let targetInputMode = 'single';

const sizeLibrary = {
  A: [
    ['A0',841,1189],['A1',594,841],['A2',420,594],['A3+',329,483],['A3',297,420],['SRA3',320,450],['RA3',305,430],['A4',210,297],['A5',148,210],
    ['A6',105,148],['A7',74,105],['A8',52,74],['A9',37,52],['A10',26,37]
  ],
  B: [
    ['B0',1030,1456],['B1',728,1030],['B2',515,728],['B3',364,515],['B4',257,364],['B5',182,257],
    ['B6',128,182],['B7',91,128],['B8',64,91],['B9',45,64],['B10',32,45]
  ],
  photo: [
    ['1 吋大頭照',25,35],['2 吋大頭照',35,45],['2 × 3 吋',50.8,76.2],['3.5 × 5 吋',88.9,127],
    ['4 × 6 吋',101.6,152.4],['5 × 7 吋',127,177.8],['6 × 8 吋',152.4,203.2],['8 × 10 吋',203.2,254],
    ['8 × 12 吋',203.2,304.8],['10 × 12 吋',254,304.8],['10 × 15 吋',254,381],['11 × 14 吋',279.4,355.6],
    ['12 × 16 吋',304.8,406.4],['12 × 18 吋',304.8,457.2],['16 × 20 吋',406.4,508],['16 × 24 吋',406.4,609.6],
    ['20 × 24 吋',508,609.6],['20 × 30 吋',508,762],['24 × 36 吋',609.6,914.4]
  ]
};

const familyText = {
  A: 'A 系列是常見辦公與列印用紙。數字越大，紙張越小。',
  B: 'B 系列這裡使用台灣常見的 JIS 尺寸，適合海報、書籍與印刷。',
  photo: '常見相片、放大照與大頭照尺寸，已自動換算成毫米。'
};

function fmt(n, decimals=1){ return Number(n.toFixed(decimals)).toLocaleString('zh-TW'); }
function toMm(value){ return Number(value)*factors[currentUnit]; }
function fromMm(value,unit=currentUnit){ return value/factors[unit]; }
function unitValue(mm){ return fmt(fromMm(mm),2).replaceAll(',',''); }

// 只用可一刀切到底的斷裁排法：整齊網格、直向分帶、橫向分帶。
function makePlan(pw,ph,tw,th,rotate,shortFirst=false){
  const plans=[];
  const add=(name,rects,detail,strategy)=>{
    if(!rects.length)return;
    const bandSize=strategy==='vertical'?rects[0].w:rects[0].h,cutLength=strategy==='vertical'?ph:pw;
    plans.push({name,rects,detail,strategy,count:rects.length,usage:rects.length*tw*th/(pw*ph),bandSize,shortPreferred:Math.abs(cutLength-Math.min(pw,ph))<.01,shortFirst});
  };
  const grid=(w,h,rotated,label,strategy)=>{
    const cols=Math.floor((pw+1e-7)/w),rows=Math.floor((ph+1e-7)/h),rects=[];
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)rects.push({x:x*w,y:y*h,w,h,rotated,n:rects.length+1});
    add(label,rects,`${cols} 欄 × ${rows} 列`,strategy);
  };
  grid(tw,th,false,'直向整齊排列','vertical');
  if(rotate&&Math.abs(tw-th)>1e-7)grid(th,tw,true,'橫向整齊排列','vertical');
  if(rotate&&Math.abs(tw-th)>1e-7){
    for(let a=0;a<=Math.floor(pw/tw);a++)for(let b=0;b<=Math.floor(pw/th);b++){
      if(!a||!b||a*tw+b*th>pw+1e-7)continue;
      const rects=[];let x=0;
      for(let c=0;c<a;c++,x+=tw)for(let r=0;r<Math.floor(ph/th);r++)rects.push({x,y:r*th,w:tw,h:th,rotated:false,n:rects.length+1});
      for(let c=0;c<b;c++,x+=th)for(let r=0;r<Math.floor(ph/tw);r++)rects.push({x,y:r*tw,w:th,h:tw,rotated:true,n:rects.length+1});
      add('直向分條後裁切',rects,`${a} 條直向 + ${b} 條橫向`,'vertical');
    }
    for(let a=0;a<=Math.floor(ph/th);a++)for(let b=0;b<=Math.floor(ph/tw);b++){
      if(!a||!b||a*th+b*tw>ph+1e-7)continue;
      const rects=[];let y=0;
      for(let r=0;r<a;r++,y+=th)for(let c=0;c<Math.floor(pw/tw);c++)rects.push({x:c*tw,y,w:tw,h:th,rotated:false,n:rects.length+1});
      for(let r=0;r<b;r++,y+=tw)for(let c=0;c<Math.floor(pw/th);c++)rects.push({x:c*th,y,w:th,h:tw,rotated:true,n:rects.length+1});
      add('橫向分條後裁切',rects,`${a} 條直向 + ${b} 條橫向`,'horizontal');
    }
  }
  plans.forEach(p=>p.cutCount=buildCutSequence(p,pw,ph).length);
  plans.sort((a,b)=>(shortFirst?Number(b.shortPreferred)-Number(a.shortPreferred):0)||b.count-a.count||b.usage-a.usage||a.cutCount-b.cutCount);
  return plans[0]||null;
}

// 只排入指定數量，並優先留下最大的完整矩形餘紙。
function makeExactPlan(pw,ph,tw,th,count,rotate,shortFirst=false){
  const plans=[];
  const remainderValue=remainder=>{const area=Math.max(0,remainder.w)*Math.max(0,remainder.h),long=Math.max(remainder.w,remainder.h),short=Math.min(remainder.w,remainder.h),shape=long>0?short/long:0;return {area,shape,reuseScore:area*Math.sqrt(shape)};};
  const addOrientation=(w,h,rotated)=>{
    const maxCols=Math.floor((pw+1e-7)/w),maxRows=Math.floor((ph+1e-7)/h);
    for(let cols=1;cols<=Math.min(maxCols,count);cols++){
      const rows=Math.ceil(count/cols);if(rows>maxRows)continue;
      const rects=[];for(let col=0;col<cols;col++){const inCol=Math.min(rows,count-rects.length);for(let row=0;row<inCol;row++)rects.push({x:col*w,y:row*h,w,h,rotated,n:rects.length+1});}
      const right={w:pw-cols*w,h:ph},bottom={w:cols*w,h:ph-rows*h},remainder=right.w*right.h>=bottom.w*bottom.h?right:bottom;
      if(rects.length===count)plans.push({name:'保留較好再利用的餘紙',rects,detail:`${cols} 欄，共 ${rects.length} 張`,strategy:'vertical',count:rects.length,usage:rects.length*tw*th/(pw*ph),bandSize:w,shortPreferred:Math.abs(ph-Math.min(pw,ph))<.01,shortFirst,remainder:{...remainder,...remainderValue(remainder)}});
    }
    for(let rows=1;rows<=Math.min(maxRows,count);rows++){
      const cols=Math.ceil(count/rows);if(cols>maxCols)continue;
      const rects=[];for(let row=0;row<rows;row++){const inRow=Math.min(cols,count-rects.length);for(let col=0;col<inRow;col++)rects.push({x:col*w,y:row*h,w,h,rotated,n:rects.length+1});}
      const bottom={w:pw,h:ph-rows*h},right={w:pw-cols*w,h:rows*h},remainder=bottom.w*bottom.h>=right.w*right.h?bottom:right;
      if(rects.length===count)plans.push({name:'保留較好再利用的餘紙',rects,detail:`${rows} 列，共 ${rects.length} 張`,strategy:'horizontal',count:rects.length,usage:rects.length*tw*th/(pw*ph),bandSize:h,shortPreferred:Math.abs(pw-Math.min(pw,ph))<.01,shortFirst,remainder:{...remainder,...remainderValue(remainder)}});
    }
  };
  addOrientation(tw,th,false);if(rotate&&Math.abs(tw-th)>1e-7)addOrientation(th,tw,true);
  plans.forEach(p=>p.cutCount=buildCutSequence(p,pw,ph).length);
  plans.sort((a,b)=>(shortFirst?Number(b.shortPreferred)-Number(a.shortPreferred):0)||b.remainder.reuseScore-a.remainder.reuseScore||b.remainder.area-a.remainder.area||a.cutCount-b.cutCount);
  return plans[0]||null;
}

// 混合方向滿版無法直接縮成指定張數時，嘗試不同取件順序，保留較方正、較實用的完整餘紙。
function makeReusableSubsetPlan(base,count,pw,ph,tw,th,shortFirst=false){
  const orders=[
    [...base.rects].sort((a,b)=>a.y-b.y||a.x-b.x),
    [...base.rects].sort((a,b)=>a.x-b.x||a.y-b.y),
    [...base.rects].sort((a,b)=>(a.x+a.w)-(b.x+b.w)||(a.y+a.h)-(b.y+b.h))
  ],plans=[];
  orders.forEach(order=>{
    const rects=order.slice(0,count).map((r,i)=>({...r,n:i+1})),maxX=Math.max(...rects.map(r=>r.x+r.w)),maxY=Math.max(...rects.map(r=>r.y+r.h));
    const candidates=[{w:Math.max(0,pw-maxX),h:ph},{w:pw,h:Math.max(0,ph-maxY)}].filter(r=>r.w>0&&r.h>0);
    const scored=candidates.map(r=>{const area=r.w*r.h,shape=Math.min(r.w,r.h)/Math.max(r.w,r.h);return {...r,area,shape,reuseScore:area*Math.sqrt(shape)};}).sort((a,b)=>b.reuseScore-a.reuseScore)[0];
    if(scored)plans.push({...base,name:'保留較好再利用的餘紙',rects,detail:`指定裁 ${rects.length} 張，保留較方正餘紙`,count:rects.length,usage:rects.length*tw*th/(pw*ph),shortFirst,remainder:scored});
  });
  plans.sort((a,b)=>b.remainder.reuseScore-a.remainder.reuseScore||b.remainder.area-a.remainder.area);return plans[0]||null;
}

function buildCutSequence(plan,pw,ph){
  const t=.01,cuts=[];
  if(plan.mixedRoll){
    plan.shelves.forEach((s,i)=>{const edge=s.y+s.h;if(edge<ph-t)cuts.push({phase:0,orientation:'horizontal',pos:edge,start:0,end:pw,title:`分開第 ${i+1} 段`,detail:`從紙卷起點量 ${fmt(fromMm(edge))} ${currentUnit}，橫切整個卷寬。紙卷在這之前保持一整張，先完成全部配置再依序分段。`});});
    plan.shelves.forEach((s,i)=>{const pieces=[...s.rects].sort((a,b)=>a.x-b.x);pieces.forEach((r,j)=>{const edge=r.x+r.w;if(edge<pw-t)cuts.push({phase:1,orientation:'vertical',pos:edge,start:s.y,end:s.y+s.h,title:`第 ${i+1} 段分出第 ${j+1} 張`,detail:`在第 ${i+1} 段中，從左邊量 ${fmt(fromMm(r.w))} ${currentUnit} 直切到底。`});if(r.h<s.h-t)cuts.push({phase:1,orientation:'horizontal',pos:r.y+r.h,start:r.x,end:r.x+r.w,title:`修齊第 ${i+1} 段的第 ${j+1} 張`,detail:`這張成品比該段短，分出直條後再從上方量 ${fmt(fromMm(r.h))} ${currentUnit} 橫切修齊。`});});});
  }else if(plan.strategy==='horizontal'){
    const rows=[...new Map(plan.rects.map(r=>[`${r.y.toFixed(2)}|${r.h.toFixed(2)}`,{y:r.y,h:r.h}])).values()].sort((a,b)=>a.y-b.y);
    rows.forEach((row,i)=>{
      const edge=row.y+row.h;
      if(edge<ph-t||plan.isRoll)cuts.push({phase:0,orientation:'horizontal',pos:Math.min(edge,ph),start:0,end:pw,title:`先切下第 ${i+1} 條`,detail:`從剩下紙張的上邊量 ${fmt(fromMm(row.h))} ${currentUnit}，一刀橫切到底。把上方長條取下，先放旁邊。`});
    });
    rows.forEach((row,i)=>{
      const pieces=plan.rects.filter(r=>Math.abs(r.y-row.y)<t&&Math.abs(r.h-row.h)<t).sort((a,b)=>a.x-b.x);
      pieces.forEach((r,j)=>{const edge=r.x+r.w;if(edge<pw-t)cuts.push({phase:1,orientation:'vertical',pos:edge,start:row.y,end:row.y+row.h,title:`裁第 ${i+1} 條的第 ${j+1} 張`,detail:`拿起第 ${i+1} 條紙，從左邊量 ${fmt(fromMm(r.w))} ${currentUnit}，一刀直切到底。左邊這塊就是成品。`});});
    });
  }else{
    const cols=[...new Map(plan.rects.map(r=>[`${r.x.toFixed(2)}|${r.w.toFixed(2)}`,{x:r.x,w:r.w}])).values()].sort((a,b)=>a.x-b.x);
    cols.forEach((col,i)=>{
      const edge=col.x+col.w;
      if(edge<pw-t)cuts.push({phase:0,orientation:'vertical',pos:edge,start:0,end:ph,title:`先切下第 ${i+1} 條`,detail:`從剩下紙張的左邊量 ${fmt(fromMm(col.w))} ${currentUnit}，一刀直切到底。把左邊長條取下，先放旁邊。`});
    });
    cols.forEach((col,i)=>{
      const pieces=plan.rects.filter(r=>Math.abs(r.x-col.x)<t&&Math.abs(r.w-col.w)<t).sort((a,b)=>a.y-b.y);
      pieces.forEach((r,j)=>{const edge=r.y+r.h;if(edge<ph-t)cuts.push({phase:1,orientation:'horizontal',pos:edge,start:col.x,end:col.x+col.w,title:`裁第 ${i+1} 條的第 ${j+1} 張`,detail:`拿起第 ${i+1} 條紙，從上邊量 ${fmt(fromMm(r.h))} ${currentUnit}，一刀橫切到底。上方這塊就是成品。`});});
    });
  }
  const firstCuts=cuts.filter(c=>c.phase===0).map(c=>({...c,segments:[{start:c.start,end:c.end}]}));
  const grouped=new Map();
  cuts.filter(c=>c.phase===1).forEach(c=>{const key=`${c.orientation}|${c.pos.toFixed(2)}`;if(!grouped.has(key))grouped.set(key,{...c,segments:[]});grouped.get(key).segments.push({start:c.start,end:c.end});});
  const finishCuts=[...grouped.values()].map(c=>c.segments.length<2?c:{...c,title:`共同裁線：${c.segments.length} 條紙一起切`,detail:`先把這 ${c.segments.length} 條已分開的紙疊齊，量到同一個位置後一起切。若裁切機不能疊切，就保持同一個定位，依序切完。`}).sort((a,b)=>b.segments.length-a.segments.length||(a.end-a.start)-(b.end-b.start)||a.pos-b.pos);
  const result=[...firstCuts,...finishCuts];
  if(plan.shortFirst&&result.length){result[0].title=`短邊優先：${result[0].title}`;result[0].detail=`已啟用短邊優先。第一刀會橫跨原紙較短的一邊。${result[0].detail}`;}
  return result;
}

function stopCutAnimation(){
  cutTimers.forEach(clearTimeout);cutTimers=[];
  isCutPlaying=false;
  $('playCuts').classList.remove('is-playing');
}

function stopCutByUser(){
  stopCutAnimation();
  $('playCuts').querySelector('span').textContent='重新播放';
  $('playCuts').setAttribute('aria-label','重新播放裁切順序');
  $('stepBadge').textContent='已停止';
  $('stepTitle').textContent='播放已停止';
  $('stepDetail').textContent='按「重新播放」會從第一刀再開始。';
}

function prepareCutSequence(plan,pw,ph){
  stopCutAnimation();
  const canvas=$('layoutCanvas');canvas.querySelectorAll('.cut-line').forEach(el=>el.remove());
  const list=$('sequenceList');list.replaceChildren();
  const cuts=buildCutSequence(plan,pw,ph),displayPw=plan.isRoll?ph:pw,displayPh=plan.isRoll?pw:ph;
  cuts.forEach((originalCut,index)=>{
    const cut=plan.isRoll?{...originalCut,orientation:originalCut.orientation==='vertical'?'horizontal':'vertical'}:originalCut;
    cut.segments.forEach(segment=>{const line=document.createElement('i');line.className=`cut-line ${cut.orientation}`;line.dataset.step=index+1;
      if(cut.orientation==='vertical')line.style.cssText=`left:${cut.pos/displayPw*100}%;top:${segment.start/displayPh*100}%;height:${(segment.end-segment.start)/displayPh*100}%`;
      else line.style.cssText=`top:${cut.pos/displayPh*100}%;left:${segment.start/displayPw*100}%;width:${(segment.end-segment.start)/displayPw*100}%`;
      canvas.appendChild(line);});
    const item=document.createElement('li');item.innerHTML=`<b>第 ${index+1} 刀 · ${cut.segments.length>1?'共同切':cut.orientation==='vertical'?'直切':'橫切'}</b>${cut.title}`;list.appendChild(item);
  });
  canvas.querySelectorAll('[data-step="1"]').forEach(line=>line.classList.add('first-preview'));
  $('stepBadge').textContent=`${cuts.length} 刀`;$('stepBadge').classList.remove('active');
  $('stepTitle').textContent='這個方案每一刀都會切斷紙張';
  $('stepDetail').textContent=plan.shortFirst?`已啟用短邊優先，第一刀會橫跨原紙較短的一邊，再切成成品。`:(plan.strategy==='horizontal'?'第一階段先橫向分成長條，第二階段再把每條紙切成成品。':'第一階段先直向分成長條，第二階段再把每條紙切成成品。');
  $('playCuts').disabled=!cuts.length;$('playCuts').querySelector('span').textContent='播放裁切順序';$('playCuts').setAttribute('aria-label','播放裁切順序');
  return cuts;
}

function playCutSequence(){
  if(!currentPlan||!currentPaper)return;
  const cuts=prepareCutSequence(currentPlan,currentPaper.pw,currentPaper.ph);
  const lines=[...$('layoutCanvas').querySelectorAll('.cut-line')],items=[...$('sequenceList').children];
  lines.forEach(line=>line.classList.remove('first-preview'));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches,interval=reduced?80:1150;
  isCutPlaying=true;$('playCuts').classList.add('is-playing');$('playCuts').querySelector('span').textContent='停止播放';$('playCuts').setAttribute('aria-label','停止播放裁切順序');
  cuts.forEach((cut,index)=>cutTimers.push(setTimeout(()=>{
    lines.forEach(x=>x.classList.remove('current'));items.forEach(x=>x.classList.remove('current'));
    lines.filter(x=>Number(x.dataset.step)===index+1).forEach(x=>x.classList.add('revealed','current'));items[index].classList.add('current');items.slice(0,index).forEach(x=>x.classList.add('done'));
    items[index].scrollIntoView({behavior:reduced?'auto':'smooth',block:'nearest',inline:'center'});
    $('stepBadge').textContent=`${index+1} / ${cuts.length}`;$('stepBadge').classList.add('active');$('stepTitle').textContent=cut.title;$('stepDetail').textContent=cut.detail;
    if(index===cuts.length-1)cutTimers.push(setTimeout(()=>{$('stepBadge').textContent='完成';$('stepTitle').textContent='裁切完成';$('stepDetail').textContent=currentPlan.isRoll&&currentPlan.rows>12?`已示範前 12 排；實際共需 ${currentPlan.rows} 排、${currentPlan.count} 張成品。`:`這份原料可得到 ${currentPlan.count} 張成品。`;items[index].classList.add('done');stopCutAnimation();$('playCuts').querySelector('span').textContent='重播裁切順序';$('playCuts').setAttribute('aria-label','重播裁切順序');},reduced?100:800));
  },index*interval)));
}

function showSheetPlan(index){
  const view=sheetPlanViews[index];if(!view)return;
  currentPlan=view.plan;currentPaper={pw:view.pw,ph:view.ph};
  document.querySelectorAll('#sheetPlanSwitch button').forEach((b,i)=>b.classList.toggle('active',i===index));
  $('currentLayoutLabel').innerHTML=`${view.label||'裁切配置'}${view.sub?`<small>${view.sub}</small>`:''}`;
  $('planDescription').textContent=view.description;$('arrangement').textContent=view.plan.detail;
  const canvas=$('layoutCanvas'),isRoll=!!view.plan.isRoll,displayPw=isRoll?view.ph:view.pw,displayPh=isRoll?view.pw:view.ph;canvas.replaceChildren();canvas.classList.toggle('mixed-roll',!!view.plan.mixedRoll);canvas.classList.toggle('roll-horizontal',isRoll);canvas.closest('.canvas-wrap').classList.toggle('mixed-roll-wrap',!!view.plan.mixedRoll);canvas.closest('.canvas-wrap').classList.toggle('roll-horizontal-wrap',isRoll);canvas.closest('.current-layout').classList.toggle('roll-horizontal-layout',isRoll);const scale=isRoll?Math.min(760/displayPw,250/displayPh):(sheetPlanViews.length>1?Math.min(300/displayPw,220/displayPh):Math.min(560/displayPw,260/displayPh));canvas.style.width=`${displayPw*scale}px`;canvas.style.height=`${displayPh*scale}px`;
  view.plan.rects.forEach(r=>{const d=isRoll?{x:r.y,y:r.x,w:r.h,h:r.w}:r,el=document.createElement('div');el.className=`cut-piece${r.rotated?' rotated':''}`;el.style.cssText=`left:${d.x/displayPw*100}%;top:${d.y/displayPh*100}%;width:${d.w/displayPw*100}%;height:${d.h/displayPh*100}%`;if(view.plan.mixedRoll){el.innerHTML=`<b>${r.jobIndex+1}-${r.pieceNumber}${r.rotated?' 90°':''}</b><small>${fmt(fromMm(r.targetW))}×${fmt(fromMm(r.targetH))}</small>`;el.title=`第 ${r.jobIndex+1} 種尺寸・第 ${r.pieceNumber} 張・${fmt(fromMm(r.targetW))} × ${fmt(fromMm(r.targetH))} ${currentUnit}${r.rotated?'・已旋轉 90°':'・未旋轉'}`;}else el.textContent=r.n;canvas.appendChild(el);});
  const currentLayout=canvas.closest('.current-layout');currentLayout.querySelector('.sheet-count-visual')?.remove();
  if(!isRoll&&view.repeatCount>1){
    const visual=document.createElement('div');visual.className='sheet-count-visual';visual.tabIndex=0;visual.setAttribute('role','button');visual.setAttribute('aria-expanded','false');visual.setAttribute('aria-label',`共使用 ${view.repeatCount} 張原紙；移入或點一下可展開`);
    const shown=Math.min(view.repeatCount,5),thumbScale=Math.min(74/view.pw,108/view.ph);
    for(let i=0;i<shown;i++){
      const icon=document.createElement('div');icon.className='sheet-count-page';icon.style.width=`${view.pw*thumbScale}px`;icon.style.height=`${view.ph*thumbScale}px`;icon.style.setProperty('--stack-offset',`${i*4}px`);icon.style.setProperty('--stack-angle',`${(i-(shown-1)/2)*1.5}deg`);icon.style.setProperty('--fan-offset',`${(i-(shown-1)/2)*58}px`);icon.style.zIndex=i+1;
      view.plan.rects.forEach(r=>{const piece=document.createElement('span');piece.style.cssText=`left:${r.x/view.pw*100}%;top:${r.y/view.ph*100}%;width:${r.w/view.pw*100}%;height:${r.h/view.ph*100}%`;icon.appendChild(piece);});
      const number=document.createElement('em');number.textContent=i+1;icon.appendChild(number);visual.appendChild(icon);
    }
    if(view.repeatCount>shown){const more=document.createElement('b');more.textContent=`…共 ${view.repeatCount} 張`;visual.appendChild(more);}
    visual.addEventListener('click',()=>{const expanded=visual.classList.toggle('expanded');visual.setAttribute('aria-expanded',String(expanded));});
    currentLayout.appendChild(visual);
  }
  if(isRoll){$('measureW').textContent=`卷寬 ${fmt(fromMm(view.pw))} ${currentUnit}`;$('measureH').textContent=`使用長度 ${view.ph>=1000?`${fmt(view.ph/1000,2)} m`:`${fmt(fromMm(view.ph))} ${currentUnit}`}`;}
  if(isRoll&&sheetPlanViews.length>1){$('sheets').textContent=fmt(view.plan.usedLength/1000,2);$('usage').textContent=`${fmt(view.plan.usage*100)}%`;$('waste').textContent=`這個排法損耗 ${fmt(100-view.plan.usage*100)}%`;}
  prepareCutSequence(view.plan,view.pw,view.ph);
  $('stepTitle').textContent=view.plan.shortFirst?`短邊優先 · ${view.stepTitle}`:view.stepTitle;$('stepDetail').textContent=view.plan.shortFirst?`第一刀會橫跨原紙較短的一邊。${view.stepDetail}`:view.stepDetail;
}

function renderStaticLayout(view){
  const panel=document.createElement('article');panel.className='layout-preview';panel.innerHTML=`<p class="layout-caption">${view.label}<small>${view.sub||''}</small></p>`;
  const makeCanvas=()=>{const canvas=document.createElement('div');canvas.className='layout-preview-canvas';const scale=Math.min((view.repeatCount>1?230:300)/view.pw,(view.repeatCount>1?175:220)/view.ph);canvas.style.width=`${view.pw*scale}px`;canvas.style.height=`${view.ph*scale}px`;view.plan.rects.forEach(r=>{const el=document.createElement('div');el.className=`cut-piece${r.rotated?' rotated':''}`;el.style.cssText=`left:${r.x/view.pw*100}%;top:${r.y/view.ph*100}%;width:${r.w/view.pw*100}%;height:${r.h/view.ph*100}%`;el.textContent=r.n;canvas.appendChild(el);});return canvas;};
  if(view.repeatCount>1){const stack=document.createElement('div');stack.className='sheet-stack';stack.tabIndex=0;stack.setAttribute('aria-label',`共 ${view.repeatCount} 張原紙使用相同裁法`);const shown=Math.min(view.repeatCount,5);for(let i=0;i<shown;i++){const canvas=makeCanvas(),offset=i-(shown-1)/2;canvas.style.setProperty('--stack-x',`${offset*6}px`);canvas.style.setProperty('--stack-y',`${Math.abs(offset)*-3}px`);canvas.style.setProperty('--fan-x',`${offset*22}px`);canvas.style.setProperty('--stack-angle',`${offset*1.8}deg`);canvas.style.setProperty('--fan-angle',`${offset*5}deg`);canvas.style.zIndex=i+1;stack.appendChild(canvas);}if(view.repeatCount>shown){const more=document.createElement('b');more.className='stack-more';more.textContent=`… 共 ${view.repeatCount} 張`;stack.appendChild(more);}panel.appendChild(stack);}else panel.appendChild(makeCanvas());return panel;
}

function renderLayoutGallery(views){
  const gallery=$('layoutAlternatives'),wrap=gallery.closest('.canvas-wrap');gallery.replaceChildren();views.slice(0,-1).forEach(view=>gallery.appendChild(renderStaticLayout(view)));gallery.hidden=views.length<2;wrap.classList.toggle('has-multiple-layouts',views.length>1);
}

function verifyRenderedPlan(view){
  const expected=view.plan.count,actual=view.plan.rects.length;
  if(expected!==actual)throw new Error(`裁切方案張數不一致：預期 ${expected}，實際 ${actual}`);
}

function buildSheetPlanSwitch(sheets,capacity,lastCount,capacityPlan,lastPlan,pw,ph){
  const switcher=$('sheetPlanSwitch');switcher.replaceChildren();sheetPlanViews=[];
  const fullSheets=sheets-(lastCount<capacity?1:0);
  if(fullSheets>0)sheetPlanViews.push({plan:capacityPlan,pw,ph,repeatCount:fullSheets,description:`標準裁法：使用 ${fullSheets} 張原紙，每張裁 ${capacity} 張${capacityPlan.shortFirst?'，短邊優先':''}`,stepTitle:`標準裁法重複 ${fullSheets} 次`,stepDetail:`這個配置使用 ${fullSheets} 張原紙，每張都照同一個刀序裁 ${capacity} 張。`,label:'標準裁法',sub:`使用 ${fullSheets} 張，每張裁 ${capacity} 張`});
  if(lastCount<capacity)sheetPlanViews.push({plan:lastPlan,pw,ph,description:`最後一張特殊裁法：只裁 ${lastCount} 張，保留較好再利用的餘紙${lastPlan.shortFirst?'，短邊優先':''}`,stepTitle:'最後一張使用特殊裁法',stepDetail:`上方已同時列出標準配置；這裡播放最後一張只裁 ${lastCount} 張的刀序。`,label:'最後一張特殊裁法',sub:`只裁 ${lastCount} 張`});
  switcher.hidden=true;sheetPlanViews.forEach(verifyRenderedPlan);renderLayoutGallery(sheetPlanViews);showSheetPlan(sheetPlanViews.length-1);
}

function renderSheet(){
  $('layoutChoiceBar').hidden=true;$('layoutChoiceBar').replaceChildren();
  const pw=toMm($('paperW').value),ph=toMm($('paperH').value),tw=toMm($('targetW').value),th=toMm($('targetH').value),qty=Math.max(1,Math.floor(Number($('quantity').value)||1));
  if(![pw,ph,tw,th].every(n=>n>0))return;
  const shortFirst=$('shortEdgeFirst').checked;
  const capacityPlan=makePlan(pw,ph,tw,th,$('allowRotate').checked,shortFirst);
  if(!capacityPlan){currentPlan=null;currentPaper=null;stopCutAnimation();$('pieces').textContent='0';$('sheets').textContent='—';$('usage').textContent='0%';$('waste').textContent='成品大於原紙';$('layoutCanvas').replaceChildren();$('planDescription').textContent='目前尺寸無法裁出';return;}
  const sheets=Math.ceil(qty/capacityPlan.count),lastCount=qty-(sheets-1)*capacityPlan.count;
  let plan=lastCount<capacityPlan.count?makeExactPlan(pw,ph,tw,th,lastCount,$('allowRotate').checked,shortFirst):capacityPlan;
  if(!plan&&lastCount<capacityPlan.count){
    plan=makeReusableSubsetPlan(capacityPlan,lastCount,pw,ph,tw,th,shortFirst);
  }
  if(!plan){currentPlan=null;currentPaper=null;stopCutAnimation();$('layoutCanvas').replaceChildren();$('sequenceList').replaceChildren();$('playCuts').disabled=true;$('planDescription').textContent='目前找不到可實際裁切的指定數量方案';return;}
  currentPlan=plan;currentPaper={pw,ph};
  const usage=qty*tw*th/(sheets*pw*ph)*100;
  $('pieces').textContent=qty;$('sheets').textContent=sheets;$('capacity').textContent=capacityPlan.count;$('usage').textContent=`${fmt(usage)}%`;$('waste').textContent=`未使用 ${fmt(100-usage)}%（可保留）`;
  const remainderText=plan.remainder?`${fmt(fromMm(plan.remainder.w))} × ${fmt(fromMm(plan.remainder.h))} ${currentUnit}`:'依配置圖';
  $('planDescription').textContent=`${sheets>1?'最後一張原紙：':''}${plan.name}，只裁需要的數量${shortFirst?'，短邊優先':''}`;$('arrangement').textContent=plan.detail;$('actual').textContent=`${qty} 張`;$('extra').textContent=remainderText;
  $('extraLabel').textContent='較實用完整餘紙';
  $('feasibilityText').textContent=`只裁 ${qty} 張，不會為了填滿原紙而多裁。${plan.remainder?`最大可保留約 ${remainderText} 的完整紙張。`:''}`;
  $('measureW').textContent=`${fmt(fromMm(pw))} ${currentUnit}`;$('measureH').textContent=`${fmt(fromMm(ph))} ${currentUnit}`;
  $('tipText').textContent='配置圖上的橘色虛線是第一刀預覽。按「播放裁切順序」後，橘色線會依照每一刀的位置逐步出現。';
  buildSheetPlanSwitch(sheets,capacityPlan.count,lastCount,capacityPlan,plan,pw,ph);
}

function makeRollPlan(rollW,tw,th,qty,rotate){
  const choices=[];
  const add=(pieceAcross,pieceAdvance,rotated)=>{
    const across=Math.floor((rollW+1e-7)/pieceAcross);if(!across)return;
    const rows=Math.ceil(qty/across),usedLength=rows*pieceAdvance,previewRows=Math.min(rows,12),previewLength=previewRows*pieceAdvance,rects=[];
    for(let row=0;row<previewRows;row++){const inRow=Math.min(across,qty-row*across);for(let col=0;col<inRow;col++)rects.push({x:col*pieceAcross,y:row*pieceAdvance,w:pieceAcross,h:pieceAdvance,rotated,n:rects.length+1});}
    choices.push({name:rotated?'成品旋轉 90° 排版':'成品正向排版',rects,detail:`每排 ${across} 張 × ${rows} 排`,strategy:'horizontal',isRoll:true,count:qty,across,rows,usedLength,previewLength,usage:qty*tw*th/(rollW*usedLength)});
  };
  add(tw,th,false);if(rotate&&Math.abs(tw-th)>1e-7)add(th,tw,true);
  choices.sort((a,b)=>a.usedLength-b.usedLength||b.usage-a.usage);return choices[0]||null;
}

function makeMixedRollPlan(rollW,jobs,rotate){
  // 精確比較每一橫排可用的正向／旋轉組合，再用動態規劃找出總卷長最短的組合。
  const variants=[];jobs.forEach((job,jobIndex)=>{variants.push({jobIndex,w:job.w,h:job.h,rotated:false});if(rotate&&Math.abs(job.w-job.h)>.01)variants.push({jobIndex,w:job.h,h:job.w,rotated:true});});
  const optionMap=new Map(),counts=Array(jobs.length).fill(0),placements=[];
  const enumerate=(index,usedWidth,height)=>{
    if(index===variants.length){
      if(!placements.length)return;
      const key=counts.join(','),candidate={counts:[...counts],used:usedWidth,h:height,placements:placements.map(x=>({...x}))},old=optionMap.get(key);
      if(!old||candidate.h<old.h-.001||(Math.abs(candidate.h-old.h)<.001&&candidate.used>old.used))optionMap.set(key,candidate);
      return;
    }
    const v=variants[index],max=Math.min(jobs[v.jobIndex].qty-counts[v.jobIndex],Math.floor((rollW-usedWidth+.001)/v.w));
    enumerate(index+1,usedWidth,height);
    for(let amount=1;amount<=max;amount++){
      counts[v.jobIndex]++;placements.push(v);enumerate(index+1,usedWidth+amount*v.w,Math.max(height,v.h));
    }
    for(let amount=1;amount<=max;amount++){counts[v.jobIndex]--;placements.pop();}
  };
  enumerate(0,0,0);
  const rowOptions=[...optionMap.values()],memo=new Map();
  const solve=remaining=>{
    const key=remaining.join(',');if(remaining.every(x=>x===0))return {length:0,rows:[]};if(memo.has(key))return memo.get(key);
    let best=null;
    rowOptions.forEach(option=>{
      if(option.counts.some((count,i)=>count>remaining[i]))return;
      const next=solve(remaining.map((count,i)=>count-option.counts[i]));if(!next)return;
      const candidate={length:option.h+next.length,rows:[option,...next.rows]};
      if(!best||candidate.length<best.length-.001||(Math.abs(candidate.length-best.length)<.001&&candidate.rows.length<best.rows.length))best=candidate;
    });
    memo.set(key,best);return best;
  };
  const solution=solve(jobs.map(job=>job.qty));if(!solution)return null;
  const nextNumber=Array(jobs.length).fill(0),shelves=[];let y=0,n=0;const rects=[];
  solution.rows.sort((a,b)=>{const ak=a.placements.map(p=>p.jobIndex).sort().join(''),bk=b.placements.map(p=>p.jobIndex).sort().join('');return ak.localeCompare(bk)||b.h-a.h;});
  solution.rows.forEach(row=>{let x=0;const shelf={y,h:row.h,used:row.used,rects:[]};row.placements.sort((a,b)=>a.jobIndex-b.jobIndex||b.w-a.w).forEach(p=>{const job=jobs[p.jobIndex],r={x,y,w:p.w,h:p.h,targetW:job.w,targetH:job.h,rotated:p.rotated,jobIndex:p.jobIndex,label:job.label,pieceNumber:++nextNumber[p.jobIndex],n:++n};x+=p.w;shelf.rects.push(r);rects.push(r);});shelves.push(shelf);y+=row.h;});
  const usedArea=jobs.reduce((sum,j)=>sum+j.w*j.h*j.qty,0);
  return {name:'多尺寸最低耗紙排版',rects,shelves,detail:`比較 ${rowOptions.length} 種橫直組合，選出 ${shelves.length} 排`,strategy:'horizontal',isRoll:true,mixedRoll:true,count:rects.length,rows:shelves.length,across:'混合',usedLength:y,previewLength:y,usage:usedArea/(rollW*y),evaluatedLayouts:rowOptions.length};
}

function makeGroupedRollPlan(rollW,jobs,rotate){
  const shelves=[],rects=[],nextNumber=Array(jobs.length).fill(0);let y=0,n=0;
  jobs.forEach((job,jobIndex)=>{const part=makeMixedRollPlan(rollW,[job],rotate);if(!part)return;part.shelves.forEach(source=>{const shelf={y,h:source.h,used:source.used,rects:[]};source.rects.forEach(item=>{const r={...item,y:y+(item.y-source.y),jobIndex,pieceNumber:++nextNumber[jobIndex],n:++n};shelf.rects.push(r);rects.push(r);});shelves.push(shelf);y+=source.h;});});
  if(rects.length!==jobs.reduce((sum,j)=>sum+j.qty,0))return null;const usedArea=jobs.reduce((sum,j)=>sum+j.w*j.h*j.qty,0);
  return {name:'相同尺寸集中排版',rects,shelves,detail:`相同尺寸集中，共 ${shelves.length} 排`,strategy:'horizontal',isRoll:true,mixedRoll:true,count:rects.length,rows:shelves.length,across:'分尺寸',usedLength:y,previewLength:y,usage:usedArea/(rollW*y)};
}

function parseBatchInput(text){
  const parts=text.split(/[\n,;，；]+/).map(x=>x.trim()).filter(Boolean),jobs=[],errors=[];
  parts.forEach((part,index)=>{
    const m=part.match(/^(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(mm|cm|in|inch|英吋|吋)?\s*[x×*]\s*(\d+)\s*(p|pcs?|張)?$/i);
    if(!m){errors.push(`第 ${index+1} 筆「${part}」無法讀取`);return;}
    const unit=(m[3]||'cm').toLowerCase(),factor=unit==='mm'?1:(unit==='cm'?10:25.4);
    jobs.push({label:part,w:Number(m[1])*factor,h:Number(m[2])*factor,qty:Number(m[4])});
  });
  return {jobs,errors};
}

function renderBatchJobList(){
  const list=$('batchJobList'),parsed=parseBatchInput($('batchInput').value);list.replaceChildren();
  if(!parsed.jobs.length){const p=document.createElement('p');p.textContent='尚未加入任何裁切項目。';list.appendChild(p);return;}
  const save=jobs=>{$('batchInput').value=jobs.map(job=>`${fmt(job.w/factors[currentUnit],2).replaceAll(',','')}x${fmt(job.h/factors[currentUnit],2).replaceAll(',','')}${currentUnit}x${job.qty}p`).join('\n');renderBatchJobList();render();};
  parsed.jobs.forEach((job,index)=>{const item=document.createElement('div');item.className='job-item';item.innerHTML=`<b>${fmt(job.w/factors[currentUnit],2)} × ${fmt(job.h/factors[currentUnit],2)} ${currentUnit}</b><div class="job-quantity"><button type="button" data-action="minus" aria-label="減少第 ${index+1} 項數量">−</button><span>${job.qty} 張</span><button type="button" data-action="plus" aria-label="增加第 ${index+1} 項數量">＋</button></div><button type="button" data-action="delete" aria-label="刪除第 ${index+1} 項">×</button>`;item.querySelector('[data-action="minus"]').addEventListener('click',()=>{const next=[...parsed.jobs];next[index]={...job,qty:Math.max(1,job.qty-1)};save(next);});item.querySelector('[data-action="plus"]').addEventListener('click',()=>{const next=[...parsed.jobs];next[index]={...job,qty:job.qty+1};save(next);});item.querySelector('[data-action="delete"]').addEventListener('click',()=>{const next=[...parsed.jobs];next.splice(index,1);save(next);});list.appendChild(item);});
}
function setTargetInputMode(mode){
  targetInputMode=mode;$('useBatch').checked=mode==='multiple';
  document.querySelectorAll('[data-target-mode]').forEach(b=>b.classList.toggle('active',b.dataset.targetMode===mode));
  $('singleTargetFields').hidden=sourceMode==='roll'&&mode==='multiple';$('multipleTargetFields').hidden=sourceMode!=='roll'||mode!=='multiple';
  const hideQuantity=sourceMode==='roll'&&mode==='multiple';$('productionQuantity').hidden=hideQuantity;$('quantityPresets').hidden=hideQuantity;
  $('requirementsHeading').hidden=hideQuantity;$('requirementsFieldset').classList.toggle('options-only',hideQuantity);$('requirementsLegend').textContent='製作需求';
  renderBatchJobList();render();
}
function addBatchJob(){
  const w=Number($('jobW').value),h=Number($('jobH').value),qty=Math.floor(Number($('jobQty').value));
  if(!(w>0&&h>0&&qty>0)){$('batchError').textContent='請完整填入寬度、高度和數量。';return;}
  const entry=`${w}x${h}${currentUnit}x${qty}p`;$('batchInput').value=[$('batchInput').value.trim(),entry].filter(Boolean).join('\n');$('batchError').textContent='';$('jobW').value='';$('jobH').value='';$('jobQty').value='';renderBatchJobList();render();$('jobW').focus();
}

function buildRollBatchSwitch(views){
  const switcher=$('sheetPlanSwitch');switcher.replaceChildren();sheetPlanViews=views;
  switcher.hidden=true;renderLayoutGallery([views.at(-1)]);renderLayoutChoices(views);showSheetPlan(views.length-1);
}

function renderLayoutChoices(views){
  const bar=$('layoutChoiceBar');bar.replaceChildren();bar.hidden=views.length<2;if(views.length<2)return;
  const title=document.createElement('span');title.textContent='比較其他排法';bar.appendChild(title);
  views.forEach((view,index)=>{const button=document.createElement('button');button.type='button';button.classList.toggle('recommended',index===views.length-1);const waste=Math.max(0,100-view.plan.usage*100);button.innerHTML=`<b>${view.choiceLabel||(index===views.length-1?'最低耗紙':'其他排法')}</b><small>${fmt(view.plan.usedLength/1000,2)} m・損耗 ${fmt(waste)}%</small>`;button.addEventListener('click',()=>{showSheetPlan(index);bar.querySelectorAll('button').forEach((b,i)=>b.classList.toggle('active',i===index));});bar.appendChild(button);});bar.querySelector('button:last-child')?.classList.add('active');
}

function renderRoll(){
  const pw=toMm($('rollW').value),batchMode=$('useBatch').checked;
  let jobs=[];
  if(batchMode){const parsed=parseBatchInput($('batchInput').value);$('batchError').textContent=parsed.errors.join('；');document.querySelector('.batch-entry').classList.toggle('has-error',!!parsed.errors.length);if(parsed.errors.length||!parsed.jobs.length)return;jobs=parsed.jobs;}
  else{const tw=toMm($('targetW').value),th=toMm($('targetH').value),qty=Math.max(1,Math.floor(Number($('quantity').value)||1));jobs=[{label:`${fmt(fromMm(tw))}×${fmt(fromMm(th))} ${currentUnit}`,w:tw,h:th,qty}];$('batchError').textContent='';document.querySelector('.batch-entry').classList.remove('has-error');}
  if(!(pw>0))return;
  const totalQty=jobs.reduce((sum,j)=>sum+j.qty,0);
  const planned=batchMode?[{label:'整卷混合排版',qty:totalQty,plan:makeMixedRollPlan(pw,jobs,$('allowRotate').checked)}]:jobs.map(job=>({...job,plan:makeRollPlan(pw,job.w,job.h,job.qty,$('allowRotate').checked)}));
  const failed=planned.find(x=>!x.plan);
  if(failed){currentPlan=null;currentPaper=null;stopCutAnimation();$('pieces').textContent='0';$('sheets').textContent='—';$('usage').textContent='0%';$('waste').textContent='成品寬於捲筒';$('layoutCanvas').replaceChildren();$('planDescription').textContent=`${failed.label} 放不下目前卷寬`;return;}
  const totalLength=planned.reduce((s,x)=>s+x.plan.usedLength,0),usedArea=jobs.reduce((s,x)=>s+x.qty*x.w*x.h,0),usage=usedArea/(pw*totalLength),unrotatedPlan=batchMode?makeMixedRollPlan(pw,jobs,false):null,rotationSaving=unrotatedPlan?Math.max(0,unrotatedPlan.usedLength-totalLength):0;
  const available=rollLengthMode==='fixed'?Number($('rollLength').value)*1000:Infinity,enough=available+1e-7>=totalLength;
  const plan=planned.at(-1).plan;currentPlan=plan;currentPaper={pw,ph:plan.previewLength};
  $('capacityMetric').hidden=true;$('sheetPlanSwitch').hidden=true;
  $('piecesLabel').textContent=batchMode?'成品需求':'每排可放';$('pieces').textContent=batchMode?jobs.length:plan.across;$('piecesUnit').textContent=batchMode?`種尺寸、${totalQty} 張`:'張成品';$('sheetsLabel').textContent='需要用紙長度';$('sheets').textContent=fmt(totalLength/1000,2);$('sheetsUnit').textContent='公尺';
  $('usage').textContent=`${fmt(usage*100)}%`;$('waste').textContent=`整體排版損耗 ${fmt(100-usage*100)}%`;
  $('feasibilityTitle').textContent=enough?'這卷紙的長度足夠':'這卷紙的長度不夠';
  const compareText=batchMode&&unrotatedPlan?`已比較 ${plan.evaluatedLayouts} 種橫直組合；全部不旋轉需 ${fmt(unrotatedPlan.usedLength/1000,2)} 公尺${rotationSaving>.01?`，目前方案節省 ${fmt(rotationSaving/1000,2)} 公尺`:'，旋轉後沒有更省'}。`:'';
  $('feasibilityText').textContent=enough?(rollLengthMode==='fixed'?`${compareText}使用 ${fmt(totalLength/1000,2)} 公尺後，還剩 ${fmt((available-totalLength)/1000,2)} 公尺。`:`${compareText}共 ${jobs.length} 種規格、${totalQty} 張，需要 ${fmt(totalLength/1000,2)} 公尺。`):`還少 ${fmt((totalLength-available)/1000,2)} 公尺，請更換較長的紙捲。`;
  document.querySelector('.feasibility').classList.toggle('not-enough',!enough);
  $('planDescription').textContent=`${plan.name}，卷寬固定、最短用紙 ${fmt(plan.usedLength/1000,2)} 公尺`;$('arrangement').textContent=plan.detail;$('actual').textContent=`${totalQty} 張`;$('extra').textContent=rollLengthMode==='fixed'&&enough?`剩 ${fmt((available-totalLength)/1000,2)} m`:'0 張';
  $('actualLabel').textContent='需要產出';$('extraLabel').textContent=rollLengthMode==='fixed'?'剩餘卷長':'多出成品';
  $('measureW').textContent=`卷寬 ${fmt(fromMm(pw))} ${currentUnit}`;$('measureH').textContent=`使用長度 ${fmt(plan.usedLength/1000,2)} m`;$('tipText').textContent=batchMode?'所有尺寸先排在同一張向右延伸的連續紙上，再依整卷配置圖裁切。':'依最省長度的方向排列；卷寬固定，紙卷從右側向外延伸。';
  const viewFor=(x,label)=>({plan:x.plan,pw,ph:x.plan.previewLength,label,sub:`${x.label}、${x.qty} 張`,description:`${label}：${x.label}，共 ${x.qty} 張`,stepTitle:`${label}的裁切動畫`,stepDetail:`這個批次每排 ${x.plan.across} 張，共 ${x.plan.rows} 排。`});
  let views=batchMode?[{plan,pw,ph:plan.previewLength,choiceLabel:'最低耗紙',label:'整卷配置',sub:`${jobs.length} 種尺寸、${totalQty} 張`,description:`整卷混合配置：${jobs.length} 種尺寸，共 ${totalQty} 張`,stepTitle:'整卷裁切動畫',stepDetail:'先看完整連續排版，再按實際裁線依序裁切。'}]:planned.map(item=>viewFor(item,'這個批次'));
  if(batchMode){const grouped=makeGroupedRollPlan(pw,jobs,$('allowRotate').checked);if(grouped&&grouped.usedLength>plan.usedLength+.01)views.unshift({plan:grouped,pw,ph:grouped.previewLength,choiceLabel:'相同尺寸集中',label:'同尺寸集中配置',sub:`使用 ${fmt(grouped.usedLength/1000,2)} m`,description:`替代排法：相同尺寸排在一起，使用 ${fmt(grouped.usedLength/1000,2)} 公尺`,stepTitle:'相同尺寸集中的裁切動畫',stepDetail:'這種排法方便連續裁同尺寸，但可能比推薦方案多用紙。'});}
  if(batchMode&&unrotatedPlan&&unrotatedPlan.usedLength>plan.usedLength+.01)views.unshift({plan:unrotatedPlan,pw,ph:unrotatedPlan.previewLength,choiceLabel:'全部不旋轉',label:'全部不旋轉',sub:`使用 ${fmt(unrotatedPlan.usedLength/1000,2)} m`,description:`替代排法：全部成品維持輸入方向，使用 ${fmt(unrotatedPlan.usedLength/1000,2)} 公尺`,stepTitle:'全部不旋轉的裁切動畫',stepDetail:'這是方便比較的替代方案，推薦方案仍是用紙最短者。'});
  buildRollBatchSwitch(views);
}

function render(){
  document.querySelector('.feasibility').classList.remove('not-enough');
  if(sourceMode==='roll')return renderRoll();
  $('capacityMetric').hidden=false;
  $('piecesLabel').textContent='本次目標數量';$('piecesUnit').textContent='張成品';$('sheetsLabel').textContent='需要原紙';$('sheetsUnit').textContent='張';$('actualLabel').textContent='實際產出';$('extraLabel').textContent='較實用完整餘紙';$('feasibilityTitle').textContent='優先保留容易再利用的餘紙';$('feasibilityText').textContent='只使用「一刀切到底」的方式；同時評估餘紙面積與長寬比例，避免留下難利用的狹長紙條。';renderSheet();
}

function reportValue(id){const el=$(id);return el?el.value||'未填寫':'—';}
function buildReportState(){
  const unit=reportValue('unit');
  const lines=[
    `網頁版本：v13`,
    `回報時間：${new Date().toLocaleString('zh-TW')}`,
    `使用模式：${sourceMode==='roll'?'捲筒紙':'一般紙張'}`,
    `原紙尺寸：${sourceMode==='roll'?`${reportValue('rollW')} ${unit} 寬`:`${reportValue('paperW')} × ${reportValue('paperH')} ${unit}`}`,
    `成品尺寸：${reportValue('targetW')} × ${reportValue('targetH')} ${unit}`,
    `目標數量：${reportValue('quantity')} 張`,
    `允許旋轉：${$('allowRotate').checked?'是':'否'}`,
    `短邊優先：${$('shortEdgeFirst').checked?'是':'否'}`,
    `目前結果：${$('pieces').textContent}；需要原紙／長度：${$('sheets').textContent}；利用率：${$('usage').textContent}`,
    `方案說明：${$('planDescription').textContent.trim()||'—'}`
  ];
  if(sourceMode==='roll')lines.push(`捲筒長度方式：${rollLengthMode==='continuous'?'依需求計算使用長度':'指定長度'}`,`批次尺寸：${$('useBatch').checked?(reportValue('batchInput')||'未填寫'):'未啟用'}`);
  lines.push(`畫面大小：${window.innerWidth} × ${window.innerHeight}`,`瀏覽器：${navigator.userAgent}`);
  return lines.join('\n');
}
function buildReportText(){
  const contact=reportValue('reportContact');
  const parts=[`【${reportValue('reportType')}】`,`補充說明：\n${reportValue('reportMessage')}`,`聯絡信箱：${contact}`];
  if($('includeReportState').checked)parts.push(`目前網頁狀態：\n${buildReportState()}`);
  return parts.join('\n\n');
}
function refreshReportPreview(){$('reportStatePreview').textContent=buildReportState();}
async function copyReportText(){
  const content=buildReportText();
  try{await navigator.clipboard.writeText(content);}catch{const box=document.createElement('textarea');box.value=content;box.style.position='fixed';box.style.opacity='0';document.body.appendChild(box);box.select();document.execCommand('copy');box.remove();}
  $('reportNotice').hidden=false;$('reportNotice').textContent='回報內容已複製，可以直接貼到 Email 或訊息中。';
}

let showAllPhotoSizes=false;
function renderSizeGrid(){
  $('familyHelp').textContent=familyText[activeFamily];$('sizeGrid').replaceChildren();
  const commonPhotoNames=new Set(['1 吋大頭照','2 吋大頭照','4 × 6 吋','5 × 7 吋','6 × 8 吋','8 × 10 吋','8 × 12 吋']);
  const all=sizeLibrary[activeFamily],visible=activeFamily==='photo'&&!showAllPhotoSizes?all.filter(([name])=>commonPhotoNames.has(name)):all;
  visible.forEach(([name,w,h])=>{const button=document.createElement('button');button.type='button';button.className='size-option';button.innerHTML=`<b>${name}</b><span>${fmt(w)} × ${fmt(h)} mm</span>`;button.addEventListener('click',()=>selectSize(name,w,h));$('sizeGrid').appendChild(button);});
  $('togglePhotoSizes').hidden=activeFamily!=='photo';
  if(activeFamily==='photo')$('togglePhotoSizes').textContent=showAllPhotoSizes?'收起其他尺寸':`顯示更多相片尺寸（另有 ${all.length-visible.length} 種）`;
}
function openSizePicker(target){pickerTarget=target;activeFamily=target==='paper'?'A':'photo';showAllPhotoSizes=false;document.querySelectorAll('.size-tabs button').forEach(b=>b.classList.toggle('active',b.dataset.family===activeFamily));$('sizeDialogTitle').textContent=target==='paper'?'選擇原紙尺寸':'選擇成品尺寸';renderSizeGrid();$('sizeDialog').showModal();}
function selectSize(name,w,h){const prefix=pickerTarget==='paper'?'paper':'target';$(`${prefix}W`).value=unitValue(w);$(`${prefix}H`).value=unitValue(h);$(`${prefix}SizeName`).textContent=name;$('sizeDialog').close();render();}

$('paperSizeButton').addEventListener('click',()=>openSizePicker('paper'));
$('targetSizeButton').addEventListener('click',()=>openSizePicker('target'));
$('closeDialog').addEventListener('click',()=>$('sizeDialog').close());
$('customSize').addEventListener('click',()=>{$('sizeDialog').close();$(`${pickerTarget}W`).focus();});
$('togglePhotoSizes').addEventListener('click',()=>{showAllPhotoSizes=!showAllPhotoSizes;renderSizeGrid();});
$('sizeDialog').addEventListener('click',e=>{if(e.target===$('sizeDialog'))$('sizeDialog').close();});
document.querySelectorAll('.size-tabs button').forEach(button=>button.addEventListener('click',()=>{activeFamily=button.dataset.family;document.querySelectorAll('.size-tabs button').forEach(b=>b.classList.toggle('active',b===button));renderSizeGrid();}));
['paperW','paperH'].forEach(id=>$(id).addEventListener('input',()=>{$('paperSizeName').textContent='自訂尺寸';}));
['targetW','targetH'].forEach(id=>$(id).addEventListener('input',()=>{$('targetSizeName').textContent='自訂尺寸';}));
$('unit').addEventListener('change',e=>{const next=e.target.value;['paperW','paperH','targetW','targetH','rollW','jobW','jobH'].forEach(id=>{if($(id).value==='')return;const mm=Number($(id).value)*factors[currentUnit];$(id).value=fmt(mm/factors[next],2).replaceAll(',','');});currentUnit=next;document.querySelectorAll('.unit-label').forEach(x=>x.textContent=next);render();});
$('calculateBtn').addEventListener('click',()=>{render();const hasBatchError=sourceMode==='roll'&&$('useBatch').checked&&$('batchError').textContent;if(hasBatchError)$('batchInput').scrollIntoView({behavior:'smooth',block:'center'});else document.querySelector('.result').scrollIntoView({behavior:'smooth',block:'nearest'});});
$('cutForm').addEventListener('submit',e=>{e.preventDefault();$('calculateBtn').click();});
$('allowRotate').addEventListener('change',render);$('quantity').addEventListener('input',()=>{document.querySelectorAll('[data-quantity]').forEach(b=>b.classList.toggle('active',b.dataset.quantity===$('quantity').value));render();});$('playCuts').addEventListener('click',()=>{if(isCutPlaying)stopCutByUser();else playCutSequence();});
$('shortEdgeFirst').addEventListener('change',render);
document.querySelectorAll('[data-target-mode]').forEach(button=>button.addEventListener('click',()=>setTargetInputMode(button.dataset.targetMode)));
$('addBatchJob').addEventListener('click',addBatchJob);['jobW','jobH','jobQty'].forEach(id=>$(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addBatchJob();}}));
$('batchInput').addEventListener('input',()=>{renderBatchJobList();render();});
$('openReport').addEventListener('click',()=>{refreshReportPreview();$('reportNotice').hidden=true;$('reportDialog').showModal();setTimeout(()=>$('reportMessage').focus(),50);});
$('closeReport').addEventListener('click',()=>$('reportDialog').close());
$('reportDialog').addEventListener('click',e=>{if(e.target===$('reportDialog'))$('reportDialog').close();});
$('copyReport').addEventListener('click',copyReportText);
$('includeReportState').addEventListener('change',()=>{$('reportPreview').hidden=!$('includeReportState').checked;});
$('reportForm').addEventListener('submit',async e=>{e.preventDefault();if(!$('reportMessage').reportValidity())return;const subject=`裁得好｜${reportValue('reportType')}`;const body=buildReportText();if(!REPORT_EMAIL){await copyReportText();$('reportNotice').textContent='功能已可使用，但維護者收件地址尚未設定。請先複製內容；設定 Email 後即可直接開啟寄信。';return;}location.href=`mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;});
$('openSupport').addEventListener('click',()=>$('supportDialog').showModal());
$('closeSupport').addEventListener('click',()=>$('supportDialog').close());
$('supportDialog').addEventListener('click',e=>{if(e.target===$('supportDialog'))$('supportDialog').close();});
$('supportPay').addEventListener('click',()=>{
  const paymentUrl=new URL(ECPAY_SUPPORT_URL);
  const isOfficialLink=paymentUrl.protocol==='https:'&&paymentUrl.hostname===ECPAY_SUPPORT_HOST&&paymentUrl.pathname===ECPAY_SUPPORT_PATH;
  if(!isOfficialLink){alert('付款連結安全檢查未通過，已停止開啟。');return;}
  window.open(paymentUrl.href,'_blank','noopener,noreferrer');
});
document.querySelectorAll('[data-quantity]').forEach(button=>button.addEventListener('click',()=>{$('quantity').value=button.dataset.quantity;document.querySelectorAll('[data-quantity]').forEach(b=>b.classList.toggle('active',b===button));render();}));
document.querySelectorAll('.mode-switch button').forEach(button=>button.addEventListener('click',()=>{
  sourceMode=button.dataset.mode;document.querySelectorAll('.mode-switch button').forEach(b=>{const active=b===button;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});
  document.querySelectorAll('.sheet-only').forEach(el=>el.hidden=sourceMode!=='sheet');document.querySelectorAll('.roll-only').forEach(el=>el.hidden=sourceMode!=='roll');$('sourceLegend').textContent=sourceMode==='roll'?'捲筒紙尺寸':'原紙尺寸';
  const preferredUnit=sourceMode==='roll'?'cm':'mm';if(currentUnit!==preferredUnit){$('unit').value=preferredUnit;$('unit').dispatchEvent(new Event('change'));}
  setTargetInputMode(sourceMode==='roll'?targetInputMode:'single');
}));
document.querySelectorAll('[data-roll-length]').forEach(button=>button.addEventListener('click',()=>{rollLengthMode=button.dataset.rollLength;document.querySelectorAll('[data-roll-length]').forEach(b=>b.classList.toggle('active',b===button));$('rollLengthField').hidden=rollLengthMode!=='fixed';render();}));
$('checkRollLength').addEventListener('change',()=>{rollLengthMode=$('checkRollLength').checked?'fixed':'continuous';$('rollLengthField').hidden=rollLengthMode!=='fixed';render();});
document.querySelectorAll('[data-roll-width]').forEach(button=>button.addEventListener('click',()=>{const mm=Number(button.dataset.rollWidth);$('rollW').value=fmt(mm/factors[currentUnit],2).replaceAll(',','');document.querySelectorAll('[data-roll-width]').forEach(b=>b.classList.toggle('active',b===button));render();}));
['paperW','paperH','targetW','targetH','rollW','rollLength'].forEach(id=>$(id).addEventListener('input',render));
$('fillBatchExample').addEventListener('click',()=>{$('batchInput').value='30x34cmx5p, 43x43cmx8p\n20x25cmx10p';$('useBatch').checked=true;renderBatchJobList();render();});
$('useBatch').addEventListener('change',render);
$('batchInput').addEventListener('input',()=>{if($('useBatch').checked)render();});
$('quantity').value='1';document.querySelectorAll('[data-quantity]').forEach(b=>b.classList.toggle('active',b.dataset.quantity==='1'));
render();
window.addEventListener('pageshow',event=>{if(event.persisted){$('quantity').value='1';document.querySelectorAll('[data-quantity]').forEach(b=>b.classList.toggle('active',b.dataset.quantity==='1'));render();}});
