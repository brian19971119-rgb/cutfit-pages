const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const script=fs.readFileSync(require('node:path').join(__dirname,'../visitor-counter.js'),'utf8');
async function run(host,fail=false){
  let calls=0;const output={textContent:'—'},events={};
  const document={getElementById:()=>output,visibilityState:'visible',readyState:'complete',addEventListener:(n,f)=>events[n]=f,removeEventListener:()=>{}};
  vm.runInNewContext(script,{document,location:{hostname:host},window:{addEventListener:()=>{}},AbortController,setTimeout,clearTimeout,fetch:async()=>{calls++;if(fail)throw Error('offline');return {ok:true,json:async()=>({views:1234})};}});
  await new Promise(resolve=>setImmediate(resolve));
  if(events.visibilitychange)await events.visibilitychange();
  return {calls,text:output.textContent};
}
test('production counts once and renders shared result',async()=>assert.deepEqual(await run('cutfit.tw'),{calls:1,text:'1,234'}));
test('localhost never counts',async()=>assert.deepEqual(await run('localhost'),{calls:0,text:'—'}));
test('failure shows honest fallback without retry',async()=>assert.deepEqual(await run('cutfit.tw',true),{calls:1,text:'暫時無法取得'}));
