// Shared by the website and the GitHub Action. Rules-based only (no AI), free APIs, no keys.
const GT = 'https://api.geckoterminal.com/api/v2/networks';
export const FOMO = new Set(['solana', 'base', 'bsc', 'monad']); // chains the Fomo app trades
const cache = new Map();
const j = u => { const c = cache.get(u); if (c && Date.now() - c.t < 45e3) return c.p;
  const p = fetch(u, { headers: { accept: 'application/json' } }).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  cache.set(u, { t: Date.now(), p }); p.catch(() => cache.delete(u)); return p; };
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
  const a = p.attributes, net = p.relationships.network.data.id, t = a.transactions?.h24 || {};
  return { key: p.id, net, sym: a.name, liq: +a.reserve_in_usd || 0, vol: +a.volume_usd?.h24 || 0,
    h1: +a.price_change_percentage?.h1 || 0, h24: +a.price_change_percentage?.h24 || 0,
    buys: t.buys || 0, sells: t.sells || 0, ageH: (Date.now() - new Date(a.pool_created_at)) / 36e5,
    addr: (p.relationships.base_token?.data?.id || '').split('_').slice(1).join('_'),
    url: `https://www.geckoterminal.com/${net}/pools/${a.address}`, kind: 'meme' };
};

export async function scan(nets = ['solana', 'base']) {
  const pools = u => j(u).then(d => d.data.map(norm));
  const jobs = nets.flatMap(n => [pools(`${GT}/${n}/trending_pools?duration=1h`), pools(`${GT}/${n}/trending_pools?duration=24h`),
    pools(`${GT}/${n}/pools?sort=h24_volume_usd_desc`), pools(`${GT}/${n}/new_pools`)]);
  const res = await Promise.allSettled(jobs);
  if (res.every(r => r.status === 'rejected')) throw new Error(res[0].reason.message);
  const map = new Map();
  res.filter(r => r.status === 'fulfilled').flatMap(r => r.value).forEach(p => map.set(p.key, p));
  return [...map.values()].filter(p => FOMO.has(p.net) && nets.includes(p.net)).map(evaluate).sort((a, b) => b.score - a.score);
}
