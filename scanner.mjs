// Runs every ~5 min in GitHub Actions. Posts new BUY signals to Discord (push notifications on your phone).
import fs from 'fs';
import { scan, fmt } from './score.js';
// DISCORD_WEBHOOK_URL can hold several webhook URLs separated by spaces, commas or new lines
const hooks = (process.env.DISCORD_WEBHOOK_URL || '').split(/[\s,]+/).map(s => s.replace(/^["']|["']$/g, '')).filter(Boolean), hook = hooks.length > 0, min = +process.env.MIN_SCORE || 70;
const manual = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
const nets = (process.env.NETWORKS || 'solana,base,bsc').split(',');
const f = 'data/seen.json'; fs.mkdirSync('data', { recursive: true });
const seen = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
for (const k in seen) if (Date.now() - seen[k] > 3 * 864e5) delete seen[k];
const post = async body => {
  const oks = await Promise.all(hooks.map(async (h, i) => {
    try {
      const res = await fetch(h, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) console.log(`Webhook ${i + 1} rejected the message:`, res.status, await res.text());
      return res.ok;
    } catch (e) { console.log(`Could not reach webhook ${i + 1}:`, e.message); return false; }
  }));
  return oks.some(Boolean);
};
if (!hook) console.log('No DISCORD_WEBHOOK_URL secret found: printing signals only');
if (manual && hook) await post({ content: 'Memewatch test: Discord connection works. Scanning now...' });
let all;
try { all = await scan(nets); } catch (e) {
  console.log('Scan failed:', e.message);
  if (manual && hook) await post({ content: 'Memewatch scan failed: ' + e.message });
  process.exit(1);
}
const buys = all.filter(r => r.verdict === 'BUY' && r.score >= min);
const hits = buys.filter(r => !seen[r.key]);
console.log(`Scanned ${all.length} pools, ${buys.length} BUY, ${hits.length} new`);
if (manual && hook) await post({ content: `Memewatch scanner is running. Scanned ${all.length} pools: ${buys.length} BUY now, ${hits.length} new. Top: ${all.slice(0, 3).map(r => `${r.sym} ${r.score}`).join(', ') || 'none'}` });
for (const r of hits.slice(0, 8)) {
  if (!hook) { console.log(r.sym, r.score, r.url); continue; }
  const ok = await post({ embeds: [{
    title: `BUY signal: ${r.sym} (${r.score}/100)`, url: r.url, color: 5036448,
    description: r.why.join('\n') + '\n\nOn Fomo: long-press to copy, then paste into Fomo search:\n```' + r.addr + '```\nNot financial advice. Small position, set a stop.',
    fields: [{ name: '1h / 24h', value: `${r.h1.toFixed(1)}% / ${r.h24.toFixed(1)}%`, inline: true },
      { name: 'Liquidity', value: '$' + fmt(r.liq), inline: true }, { name: 'Network', value: r.net, inline: true }] }] });
  if (ok) seen[r.key] = Date.now();
  await new Promise(res => setTimeout(res, 1200));
}
fs.writeFileSync(f, JSON.stringify(seen));
