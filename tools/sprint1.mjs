import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright');
// Headless check of sprint 1: target keys, mouse-look, the quartermaster.
//   THREE_DIR=<node_modules/three> node tools/sprint1.mjs <out-dir>
import { fileURLToPath } from 'node:url'; import { dirname, resolve } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..'), OUT = process.argv[2];
const srv = createServer(async (q, r) => { try { const p = q.url.split('?')[0]; const b = await readFile(join(ROOT, p === '/' ? 'index.html' : p)); r.writeHead(200, { 'content-type': { '.html': 'text/html', '.js': 'text/javascript' }[extname(p)] || 'text/html' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await br.newPage({ viewport: { width: 1366, height: 620 } }); const errs = [];
pg.on('pageerror', e => errs.push(String(e))); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await pg.route('**/cdn.jsdelivr.net/**', async rt => rt.fulfill({ body: await readFile(join(process.env.THREE_DIR, 'build', rt.request().url().split('/').pop())), contentType: 'text/javascript' }));
await pg.route('**/fonts.g*/**', rt => rt.abort());
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.click('#enter'); await pg.waitForTimeout(3000);
const out = {};
await pg.keyboard.press('f'); out.hurt = await pg.evaluate(() => game.target && [game.target.name, game.target.hp < game.target.maxHp]);
await pg.keyboard.press('Tab'); const t1 = await pg.evaluate(() => game.target.name);
await pg.keyboard.press('Tab'); await pg.keyboard.press('Shift+Tab'); out.back = (await pg.evaluate(() => game.target.name)) === t1;
// mouse-look
await pg.keyboard.press('x'); await pg.waitForTimeout(300);
out.locked = await pg.evaluate(() => game.player.locked);
const y0 = await pg.evaluate(() => [game.player.yaw, game.player.pitch, game.player.x]);
await pg.evaluate(() => document.dispatchEvent(new MouseEvent('mousemove', { movementX: 100, movementY: -40 })));
await pg.keyboard.down('d'); await pg.waitForTimeout(600); await pg.keyboard.up('d');
const y1 = await pg.evaluate(() => [game.player.yaw, game.player.pitch, game.player.x]);
out.look = [y0.map(v => +v.toFixed(2)), y1.map(v => +v.toFixed(2))];
await pg.screenshot({ path: OUT + '/look.png' });
await pg.keyboard.press('x'); await pg.waitForTimeout(200); out.unlocked = !(await pg.evaluate(() => game.player.locked));
// shop
out.shop = await pg.evaluate(() => { const g = game; g.S.coins = 500; g.player.x = 11; g.player.z = -9; g.UI.openShop(); return document.querySelectorAll('#wares .it').length; });
await pg.locator('#wares .it').first().click(); await pg.locator('#wares .it').last().click(); await pg.waitForTimeout(200);
out.after = await pg.evaluate(() => [game.S.coins, game.S.bag.length, game.S.bagSize]);
await pg.screenshot({ path: OUT + '/shop.png' });
console.log(JSON.stringify(out), JSON.stringify(errs)); await br.close(); srv.close();
