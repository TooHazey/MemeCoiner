// Runs every ~5 min in GitHub Actions. Posts new BUY signals to Discord (push notifications on your phone).
import fs from 'fs';
import { scan, fmt } from './score.js';
const hook = process.env.DISCORD_WEBHOOK_URL, min = +process.env.MIN_SCORE || 70;
const manual = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
const nets = (process.env.NETWORKS || 'solana,base,bsc').split(',');
const f = 'data/seen.json'; fs.mkdirSync('data', { recursive: true });
const seen = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
for (const k in seen) if (Date.now() - seen[k] > 3 * 864e5) delete seen[k];
const post = async body => {
  const res = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) console.log('Discord rejected the message:', res.status, await res.text());
  return res.ok;
};
if (!hook) console.log('No DISCORD_WEBHOOK_URL secret found: printing signals only');
const all = await scan(nets);
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
