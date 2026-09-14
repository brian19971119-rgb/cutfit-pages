// Binding: COUNTER_DB (dedicated D1 database). No visitor records or secrets.
const origins = new Set(['https://cutfit.tw', 'https://www.cutfit.tw']);
export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const headers = {'Content-Type':'application/json', 'Cache-Control':'no-store', 'Vary':'Origin', 'X-Content-Type-Options':'nosniff'};
    if (origins.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const reply = (data, status=200) => new Response(JSON.stringify(data), {status, headers});
    if (new URL(request.url).pathname !== '/views') return reply({error:'Not found'},404);
    if (request.method === 'OPTIONS') {
      if (!origins.has(origin)) return reply({error:'Forbidden'},403);
      return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'X-CutFit-View','Access-Control-Max-Age':'86400'}});
    }
    if (!['GET','POST'].includes(request.method)) return reply({error:'Method not allowed'},405);
    if (request.method === 'POST' && (!origins.has(origin) || request.headers.get('X-CutFit-View') !== '1')) return reply({error:'Forbidden'},403);
    try {
      // Atomic update avoids losing simultaneous views. There is no public reset API.
      const sql = request.method === 'POST'
        ? "INSERT INTO counter (id, views) VALUES (1, 1) ON CONFLICT(id) DO UPDATE SET views = views + 1 RETURNING views"
        : 'SELECT views FROM counter WHERE id = 1';
      const row = await env.COUNTER_DB.prepare(sql).first();
      return reply({views:row?.views ?? 0});
    } catch {
      return reply({error:'Counter unavailable'},503);
    }
  }
};
