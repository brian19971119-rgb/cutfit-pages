import {test} from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
test('only authorized page loads increment; reads and preflights do not',async()=>{
  let views=0;
  const env={COUNTER_DB:{prepare(sql){return {async first(){if(sql.startsWith('INSERT'))views++;return {views};}};}}};
  const request=(method,origin,header)=>new Request('https://counter.example/views',{method,headers:{...(origin?{Origin:origin}:{}),...(header?{'X-CutFit-View':'1'}:{})}});
  assert.equal((await worker.fetch(request('POST','https://other.example',true),env)).status,403);
  assert.equal((await worker.fetch(request('POST','https://cutfit.tw'),env)).status,403);
  assert.equal((await worker.fetch(request('OPTIONS','https://cutfit.tw'),env)).status,204);
  assert.equal(views,0);
  for(const origin of ['https://cutfit.tw','https://www.cutfit.tw']){
    const r=await worker.fetch(request('POST',origin,true),env);
    assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
    assert.equal((await r.json()).views,views);
  }
  assert.equal((await (await worker.fetch(request('GET'),env)).json()).views,2);
  assert.equal(views,2);
  assert.equal((await worker.fetch(request('DELETE'),env)).status,405);
  assert.equal((await worker.fetch(request('GET'),{})).status,503);
});
