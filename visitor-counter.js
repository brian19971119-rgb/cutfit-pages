(() => {
  const output = document.getElementById('visitorCount');
  if (!output || !['cutfit.tw','www.cutfit.tw'].includes(location.hostname)) return;
  let started = false;
  async function countView() {
    if (started || document.visibilityState !== 'visible') return;
    started = true;
    document.removeEventListener('visibilitychange', countView);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch('https://cutfit-counter.yijuan-xiezhen.workers.dev/views', {
        method:'POST', headers:{'X-CutFit-View':'1'}, credentials:'omit',
        referrerPolicy:'no-referrer', cache:'no-store', signal:controller.signal
      });
      if (!response.ok) throw new Error('Counter unavailable');
      const {views} = await response.json();
      if (!Number.isSafeInteger(views) || views < 0) throw new Error('Invalid count');
      output.textContent = views.toLocaleString('en-US');
    } catch {
      output.textContent = '暫時無法取得';
    } finally {
      clearTimeout(timeout);
    }
  }
  const start = () => {
    document.addEventListener('visibilitychange', countView);
    countView();
  };
  // Do not delay the calculator or retry ambiguous writes (which could double-count).
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, {once:true});
})();
