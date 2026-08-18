// 裁切排版計算模組：純幾何/排版邏輯，不觸碰 DOM。
// 依賴 app.js 定義的 fmt() / fromMm() / currentUnit（僅用於刀序文字說明）。
// 只用可一刀切到底的斷裁排法：整齊網格、直向分帶、橫向分帶。
function makePlan(pw,ph,tw,th,rotate,shortFirst=false){
  const plans=[];
  const paperIsLandscape=pw>=ph;
  const add=(name,rects,detail,strategy)=>{
    if(!rects.length)return;
    const bandSize=strategy==='vertical'?rects[0].w:rects[0].h,cutLength=strategy==='vertical'?ph:pw;
    const pieceIsLandscape=rects[0].w>=rects[0].h,orientationMismatch=pieceIsLandscape===paperIsLandscape?0:1;
    plans.push({name,rects,detail,strategy,count:rects.length,usage:rects.length*tw*th/(pw*ph),bandSize,shortPreferred:Math.abs(cutLength-Math.min(pw,ph))<.01,shortFirst,orientationMismatch});
  };
  const grid=(w,h,rotated,label,strategy)=>{
    const cols=Math.floor((pw+1e-7)/w),rows=Math.floor((ph+1e-7)/h),rects=[];
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)rects.push({x:x*w,y:y*h,w,h,rotated,n:rects.length+1});
    add(label,rects,`${cols} 欄 × ${rows} 列`,strategy);
  };
  grid(tw,th,false,'直向整齊排列','vertical');
  if(rotate&&Math.abs(tw-th)>1e-7)grid(th,tw,true,'橫向整齊排列','vertical');
  if(rotate&&Math.abs(tw-th)>1e-7){
    for(let a=0;a<=Math.floor((pw+1e-7)/tw);a++)for(let b=0;b<=Math.floor((pw+1e-7)/th);b++){
      if(!a||!b||a*tw+b*th>pw+1e-7)continue;
      const rects=[];let x=0;
      for(let c=0;c<a;c++,x+=tw)for(let r=0;r<Math.floor((ph+1e-7)/th);r++)rects.push({x,y:r*th,w:tw,h:th,rotated:false,n:rects.length+1});
      for(let c=0;c<b;c++,x+=th)for(let r=0;r<Math.floor((ph+1e-7)/tw);r++)rects.push({x,y:r*tw,w:th,h:tw,rotated:true,n:rects.length+1});
      add('直向分條後裁切',rects,`${a} 條直向 + ${b} 條橫向`,'vertical');
    }
    for(let a=0;a<=Math.floor((ph+1e-7)/th);a++)for(let b=0;b<=Math.floor((ph+1e-7)/tw);b++){
      if(!a||!b||a*th+b*tw>ph+1e-7)continue;
      const rects=[];let y=0;
      for(let r=0;r<a;r++,y+=th)for(let c=0;c<Math.floor((pw+1e-7)/tw);c++)rects.push({x:c*tw,y,w:tw,h:th,rotated:false,n:rects.length+1});
      for(let r=0;r<b;r++,y+=tw)for(let c=0;c<Math.floor((pw+1e-7)/th);c++)rects.push({x:c*th,y,w:th,h:tw,rotated:true,n:rects.length+1});
      add('橫向分條後裁切',rects,`${a} 條直向 + ${b} 條橫向`,'horizontal');
    }
  }
  plans.forEach(p=>p.cutCount=buildCutSequence(p,pw,ph).length);
  plans.sort((a,b)=>(shortFirst?Number(b.shortPreferred)-Number(a.shortPreferred):0)||b.count-a.count||b.usage-a.usage||a.orientationMismatch-b.orientationMismatch||a.cutCount-b.cutCount);
  return plans[0]||null;
}

// 只排入指定數量，並優先留下最大的完整矩形餘紙。
function makeExactPlan(pw,ph,tw,th,count,rotate,shortFirst=false){
  const plans=[];
  const paperIsLandscape=pw>=ph;
  const remainderValue=remainder=>{const area=Math.max(0,remainder.w)*Math.max(0,remainder.h),long=Math.max(remainder.w,remainder.h),short=Math.min(remainder.w,remainder.h),shape=long>0?short/long:0;return {area,shape,reuseScore:area*Math.sqrt(shape)};};
  const addOrientation=(w,h,rotated)=>{
    const orientationMismatch=(w>=h)===paperIsLandscape?0:1;
    const maxCols=Math.floor((pw+1e-7)/w),maxRows=Math.floor((ph+1e-7)/h);
    for(let cols=1;cols<=Math.min(maxCols,count);cols++){
      const rows=Math.ceil(count/cols);if(rows>maxRows)continue;
      const rects=[];for(let col=0;col<cols;col++){const inCol=Math.min(rows,count-rects.length);for(let row=0;row<inCol;row++)rects.push({x:col*w,y:row*h,w,h,rotated,n:rects.length+1});}
      const right={x:cols*w,y:0,w:pw-cols*w,h:ph},bottom={x:0,y:rows*h,w:cols*w,h:ph-rows*h},remainder=right.w*right.h>=bottom.w*bottom.h?right:bottom;
      if(rects.length===count)plans.push({name:'保留較好再利用的餘紙',rects,detail:`${cols} 欄，共 ${rects.length} 張`,strategy:'vertical',count:rects.length,usage:rects.length*tw*th/(pw*ph),bandSize:w,shortPreferred:Math.abs(ph-Math.min(pw,ph))<.01,shortFirst,orientationMismatch,remainder:{...remainder,...remainderValue(remainder)}});
    }
    for(let rows=1;rows<=Math.min(maxRows,count);rows++){
      const cols=Math.ceil(count/rows);if(cols>maxCols)continue;
      const rects=[];for(let row=0;row<rows;row++){const inRow=Math.min(cols,count-rects.length);for(let col=0;col<inRow;col++)rects.push({x:col*w,y:row*h,w,h,rotated,n:rects.length+1});}
      const bottom={x:0,y:rows*h,w:pw,h:ph-rows*h},right={x:cols*w,y:0,w:pw-cols*w,h:rows*h},remainder=bottom.w*bottom.h>=right.w*right.h?bottom:right;
      if(rects.length===count)plans.push({name:'保留較好再利用的餘紙',rects,detail:`${rows} 列，共 ${rects.length} 張`,strategy:'horizontal',count:rects.length,usage:rects.length*tw*th/(pw*ph),bandSize:h,shortPreferred:Math.abs(pw-Math.min(pw,ph))<.01,shortFirst,orientationMismatch,remainder:{...remainder,...remainderValue(remainder)}});
    }
  };
  addOrientation(tw,th,false);if(rotate&&Math.abs(tw-th)>1e-7)addOrientation(th,tw,true);
  plans.forEach(p=>p.cutCount=buildCutSequence(p,pw,ph).length);
  plans.sort((a,b)=>(shortFirst?Number(b.shortPreferred)-Number(a.shortPreferred):0)||b.remainder.reuseScore-a.remainder.reuseScore||b.remainder.area-a.remainder.area||a.orientationMismatch-b.orientationMismatch||a.cutCount-b.cutCount);
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
  // 尺寸種類或張數一多，窮舉組合與動態規劃的計算量會爆炸式成長；用呼叫次數預算避免瀏覽器卡死，
  // 超過預算時放棄混排最佳化，退回下方「每種尺寸各自排滿整橫排」的保底排法，確保一定會回傳結果。
  const ENUM_BUDGET=20000,DP_OPS_BUDGET=300000;
  const variants=[];jobs.forEach((job,jobIndex)=>{variants.push({jobIndex,w:job.w,h:job.h,rotated:false});if(rotate&&Math.abs(job.w-job.h)>.01)variants.push({jobIndex,w:job.h,h:job.w,rotated:true});});
  const optionMap=new Map(),counts=Array(jobs.length).fill(0),placements=[];
  let enumCalls=0,enumBudgetHit=false;
  const enumerate=(index,usedWidth,height)=>{
    if(enumBudgetHit)return;
    if(++enumCalls>ENUM_BUDGET){enumBudgetHit=true;return;}
    if(index===variants.length){
      if(!placements.length)return;
      const key=counts.join(','),candidate={counts:[...counts],used:usedWidth,h:height,placements:placements.map(x=>({...x}))},old=optionMap.get(key);
      if(!old||candidate.h<old.h-.001||(Math.abs(candidate.h-old.h)<.001&&candidate.used>old.used))optionMap.set(key,candidate);
      return;
    }
    const v=variants[index],max=Math.min(jobs[v.jobIndex].qty-counts[v.jobIndex],Math.floor((rollW-usedWidth+.001)/v.w));
    enumerate(index+1,usedWidth,height);
    for(let amount=1;amount<=max&&!enumBudgetHit;amount++){
      counts[v.jobIndex]++;placements.push(v);enumerate(index+1,usedWidth+amount*v.w,Math.max(height,v.h));
    }
    for(let amount=1;amount<=max;amount++){counts[v.jobIndex]--;placements.pop();}
  };
  enumerate(0,0,0);
  const rowOptions=[...optionMap.values()];
  if(!rowOptions.length)return null;

  let rows=null;
  if(!enumBudgetHit){
    const memo=new Map();
    let dpOps=0,dpBudgetHit=false;
    const solve=remaining=>{
      if(dpBudgetHit)return null;
      const key=remaining.join(',');if(remaining.every(x=>x===0))return {length:0,rows:[]};if(memo.has(key))return memo.get(key);
      let best=null;
      for(const option of rowOptions){
        if(++dpOps>DP_OPS_BUDGET){dpBudgetHit=true;break;}
        if(option.counts.some((count,i)=>count>remaining[i]))continue;
        const next=solve(remaining.map((count,i)=>count-option.counts[i]));if(!next)continue;
        const candidate={length:option.h+next.length,rows:[option,...next.rows]};
        if(!best||candidate.length<best.length-.001||(Math.abs(candidate.length-best.length)<.001&&candidate.rows.length<best.rows.length))best=candidate;
      }
      if(dpBudgetHit)return null;
      memo.set(key,best);return best;
    };
    const solution=solve(jobs.map(job=>job.qty));
    if(solution)rows=solution.rows;
  }
  if(!rows){
    // 保底排法：尺寸種類或張數太多，放棄混排最佳化，改成每種尺寸各自排滿整橫排（不混排）。
    // 計算量只跟尺寸種類數成正比，不會爆炸，且效果等同 makeGroupedRollPlan 的「同尺寸集中」排法。
    rows=[];
    let infeasible=false;
    jobs.forEach((job,jobIndex)=>{
      if(infeasible||job.qty<=0)return;
      const options=[{w:job.w,h:job.h,rotated:false}];
      if(rotate&&Math.abs(job.w-job.h)>.01)options.push({w:job.h,h:job.w,rotated:true});
      const best=options.map(o=>({...o,across:Math.floor((rollW+1e-7)/o.w)})).filter(o=>o.across>0).sort((a,b)=>b.across-a.across)[0];
      if(!best){infeasible=true;return;}
      let remainingQty=job.qty;
      while(remainingQty>0){
        const amount=Math.min(remainingQty,best.across),variant={jobIndex,w:best.w,h:best.h,rotated:best.rotated};
        rows.push({counts:jobs.map((_,i)=>i===jobIndex?amount:0),used:amount*best.w,h:best.h,placements:Array(amount).fill(variant)});
        remainingQty-=amount;
      }
    });
    if(infeasible)return null;
  }

  const nextNumber=Array(jobs.length).fill(0),shelves=[];let y=0,n=0;const rects=[];
  rows=[...rows].sort((a,b)=>{const ak=a.placements.map(p=>p.jobIndex).sort().join(''),bk=b.placements.map(p=>p.jobIndex).sort().join('');return ak.localeCompare(bk)||b.h-a.h;});
  rows.forEach(row=>{let x=0;const shelf={y,h:row.h,used:row.used,rects:[]};row.placements.sort((a,b)=>a.jobIndex-b.jobIndex||b.w-a.w).forEach(p=>{const job=jobs[p.jobIndex],r={x,y,w:p.w,h:p.h,targetW:job.w,targetH:job.h,rotated:p.rotated,jobIndex:p.jobIndex,label:job.label,pieceNumber:++nextNumber[p.jobIndex],n:++n};x+=p.w;shelf.rects.push(r);rects.push(r);});shelves.push(shelf);y+=row.h;});
  const usedArea=jobs.reduce((sum,j)=>sum+j.w*j.h*j.qty,0);
  return {name:'多尺寸最低耗紙排版',rects,shelves,detail:`比較 ${rowOptions.length} 種橫直組合，選出 ${shelves.length} 排`,strategy:'horizontal',isRoll:true,mixedRoll:true,count:rects.length,rows:shelves.length,across:'混合',usedLength:y,previewLength:y,usage:usedArea/(rollW*y),evaluatedLayouts:rowOptions.length};
}

function makeGroupedRollPlan(rollW,jobs,rotate){
  const shelves=[],rects=[],nextNumber=Array(jobs.length).fill(0);let y=0,n=0;
  jobs.forEach((job,jobIndex)=>{const part=makeMixedRollPlan(rollW,[job],rotate);if(!part)return;part.shelves.forEach(source=>{const shelf={y,h:source.h,used:source.used,rects:[]};source.rects.forEach(item=>{const r={...item,y:y+(item.y-source.y),jobIndex,pieceNumber:++nextNumber[jobIndex],n:++n};shelf.rects.push(r);rects.push(r);});shelves.push(shelf);y+=source.h;});});
  if(rects.length!==jobs.reduce((sum,j)=>sum+j.qty,0))return null;const usedArea=jobs.reduce((sum,j)=>sum+j.w*j.h*j.qty,0);
  return {name:'相同尺寸集中排版',rects,shelves,detail:`相同尺寸集中，共 ${shelves.length} 排`,strategy:'horizontal',isRoll:true,mixedRoll:true,count:rects.length,rows:shelves.length,across:'分尺寸',usedLength:y,previewLength:y,usage:usedArea/(rollW*y)};
}

if(typeof module!=='undefined'&&module.exports){
  module.exports={makePlan,makeExactPlan,makeReusableSubsetPlan,buildCutSequence,makeRollPlan,makeMixedRollPlan,makeGroupedRollPlan};
}
