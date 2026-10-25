// Runs every ~5 min in GitHub Actions. Posts new BUY signals to Discord (push notifications on your phone).
import fs from 'fs';
import { scan, fmt } from './score.js';
const hook = process.env.DISCORD_WEBHOOK_URL, min = +process.env.MIN_SCORE || 70;
const nets = (process.env.NETWORKS || 'solana,base,bsc').split(',');
const f = 'data/seen.json'; fs.mkdirSync('data', { recursive: true });
const seen = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
for (const k in seen) if (Date.now() - seen[k] > 3 * 864e5) delete seen[k];
const hits = (await scan(nets)).filter(r => r.verdict === 'BUY' && r.score >= min && !seen[r.key]);
console.log(`${hits.length} new BUY signals`);
for (const r of hits.slice(0, 8)) {
  seen[r.key] = Date.now();
  if (!hook) { console.log(r.sym, r.score, r.url); continue; }
  await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ embeds: [{
    title: `BUY signal: ${r.sym} (${r.score}/100)`, url: r.url, color: 5036448,
    description: r.why.join('\n') + '\n\nOn Fomo: long-press to copy, then paste into Fomo search:\n```' + r.addr + '```\nNot financial advice. Small position, set a stop.',
    fields: [{ name: '1h / 24h', value: `${r.h1.toFixed(1)}% / ${r.h24.toFixed(1)}%`, inline: true },
      { name: 'Liquidity', value: '$' + fmt(r.liq), inline: true }, { name: 'Network', value: r.net, inline: true }] }] }) });
  await new Promise(r => setTimeout(r, 1200));
}
fs.writeFileSync(f, JSON.stringify(seen));
