// Shared by the website and the GitHub Action. Rules-based only (no AI), free APIs, no keys.
const GT = 'https://api.geckoterminal.com/api/v2/networks';
export const FOMO = new Set(['solana', 'base', 'bsc', 'monad']); // chains the Fomo app trades
const store = typeof localStorage !== 'undefined' ? localStorage : null, mem = new Map();
const j = async u => { // cached 55s (survives page reloads); falls back to stale data if the API blocks us
  const k = 'mw:' + u; let c = mem.get(k);
  if (!c && store) { try { c = JSON.parse(store.getItem(k)); } catch {} }
  if (c && Date.now() - c.t < 55e3) return c.d;
  let r;
  try { r = await fetch(u, { headers: { accept: 'application/json' } }); }
  catch { if (c) return c.d; throw new Error('data source blocked the request (rate limit or VPN). Wait a minute and try again'); }
  if (!r.ok) { if (c) return c.d; throw new Error('HTTP ' + r.status); }
  c = { t: Date.now(), d: await r.json() }; mem.set(k, c);
  if (store) { try { store.setItem(k, JSON.stringify(c)); } catch {} }
  return c.d; };
export const fmt = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'B' : n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'k' : n.toFixed(0);
export const age = h => h < 1 ? Math.round(h * 60) + 'm' : h < 48 ? h.toFixed(0) + 'h' : h < 1e4 ? (h / 24).toFixed(0) + 'd' : 'old';

export function evaluate(p) {
  let s = 50, red = 0; const why = [];
  if (p.liq < 15000) { s -= 30; red++; why.push('Liquidity under $15k: easy to rug or get stuck'); }
  else if (p.liq >= 100000) { s += 10; why.push('Healthy liquidity ($' + fmt(p.liq) + ')'); }
  else if (p.liq >= 50000) s += 5;
  const turn = p.vol / Math.max(p.liq, 1);
  if (turn >= 1 && turn <= 15) { s += 10; why.push('Strong volume vs liquidity'); }
  else if (turn > 40) { s -= 10; why.push('Volume far above liquidity: possible wash trading'); }
  const tx = p.buys + p.sells;
  if (tx >= 50) {
    const br = p.buys / tx;
    if (br >= 0.55) { s += 10; why.push('Buyers outnumber sellers (' + Math.round(br * 100) + '% buys)'); }
    else if (br < 0.45) { s -= 15; why.push('More sells than buys'); }
  }
  if (p.h1 >= 3 && p.h1 <= 40) { s += 15; why.push('Rising now (+' + p.h1.toFixed(0) + '% 1h)'); }
  else if (p.h1 > 40) { s -= 5; why.push('Vertical 1h spike: chasing risk'); }
  else if (p.h1 < 0) { s -= 15; why.push('Already falling this hour'); }
  if (p.h24 > 500) { s -= 20; red++; why.push('Up ' + p.h24.toFixed(0) + '% in 24h: late, high dump risk'); }
  else if (p.h24 >= 20) { s += 10; why.push('Solid 24h gain (+' + p.h24.toFixed(0) + '%)'); }
  if (p.ageH < 1) { s -= 10; why.push('Under 1 hour old: totally unproven'); }
  else if (p.ageH < 6) s -= 5;
  s = Math.max(0, Math.min(100, Math.round(s)));
  const verdict = red || s < 45 ? 'AVOID' : s >= 70 ? 'BUY' : 'WATCH';
  return { ...p, score: s, verdict, why };
}

const norm = p => {
  const a = p.attributes, net = p.relationships?.network?.data?.id || p.id.split('_')[0], t = a.transactions?.h24 || {};
  return { key: p.id, net, sym: a.name, liq: +a.reserve_in_usd || 0, vol: +a.volume_usd?.h24 || 0,
    h1: +a.price_change_percentage?.h1 || 0, h24: +a.price_change_percentage?.h24 || 0,
    buys: t.buys || 0, sells: t.sells || 0, ageH: (Date.now() - new Date(a.pool_created_at)) / 36e5,
    addr: (p.relationships?.base_token?.data?.id || '').split('_').slice(1).join('_'),
    url: `https://www.geckoterminal.com/${net}/pools/${a.address}`, kind: 'meme' };
};

export async function scan(nets = ['solana', 'base']) {
  const urls = nets.flatMap(n => [`${GT}/${n}/trending_pools?duration=1h`, `${GT}/${n}/trending_pools?duration=24h`,
    `${GT}/${n}/pools?sort=h24_volume_usd_desc`, `${GT}/${n}/new_pools`]);
  const map = new Map(); let ok = 0, err;
  for (const u of urls) { // one at a time, spaced out, to stay under the free rate limit
    try { (await j(u)).data.map(norm).forEach(p => map.set(p.key, p)); ok++; } catch (e) { err = e; }
    await new Promise(r => setTimeout(r, 300));
  }
  if (!ok) throw err;
  return [...map.values()].filter(p => FOMO.has(p.net) && nets.includes(p.net)).map(evaluate).sort((a, b) => b.score - a.score);
}
