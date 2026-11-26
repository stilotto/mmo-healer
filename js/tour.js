// Speed log (owner's ask after sprint 13): the frame rate every 2 seconds,
// with where you stood and which way you faced. Two ways to run it:
//  - the tour (/speedtest, or the button in Help): the healer is carried to
//    a fixed list of spots and faces, waits, and measures, about a minute;
//  - free play (/fpslog to start, /fpslog again to stop): samples as you play.
// Either way a report opens with a Copy button, to paste back to Claude.

// x, z, yaw (0 faces south, PI north, PI/2 east, -PI/2 west), a name.
const STOPS = [
  [0, 14, Math.PI, 'Plaza, facing the gate (north)'],
  [0, -14, 0, 'Plaza, facing south (duelling ring)'],
  [14, 0, -Math.PI / 2, 'Plaza, facing the portals (west)'],
  [-14, 0, Math.PI / 2, 'Plaza, facing the dock (east)'],
  [-24, -24, Math.PI * 0.75, 'Inn corner, facing the plaza'],
  [0, -50, Math.PI, 'Inside the gate, facing out'],
  [6, -80, Math.PI, 'Greenhollow camp, facing north'],
  [6, -80, 0, 'Greenhollow camp, facing town'],
  [-44, -128, -Math.PI / 2, 'The pond, facing west'],
  [0, -200, 0, 'Deep Greenhollow, facing town'],
];
const SETTLE = 2, PER = 2, SAMPLES = 2;     // seconds to settle, seconds a sample, samples a stop

export class SpeedLog {
  constructor(ctx) { this.ctx = ctx; this.mode = null; }
  get on() { return !!this.mode; }
  // Called every frame with the frame's real length and that frame's draw stats.
  frame(dt, calls, tris) {
    if (!this.mode) return;
    const c = this.cur;
    c.n++; c.time += dt; c.worst = Math.max(c.worst, dt); if (dt > 0.05) c.jank++; c.calls += calls; c.tris += tris;
    if (this.mode === 'tour') return this.tourStep(dt);
    if (c.time >= PER) this.take('');
  }
  fresh() { this.cur = { n: 0, time: 0, worst: 0, jank: 0, calls: 0, tris: 0 }; }
  take(label) {
    const c = this.cur, p = this.ctx.player, x = this.ctx;
    const head = Math.round((Math.atan2(Math.sin(p.yaw), -Math.cos(p.yaw)) * 180 / Math.PI + 360) % 360);
    this.rows.push({ t: Math.round(performance.now() / 1000 - this.t0), label, x: Math.round(p.x), z: Math.round(p.z), head, zone: x.zone(),
      fps: c.n / c.time, avg: c.time / c.n * 1000, worst: c.worst * 1000, jank: c.jank, calls: Math.round(c.calls / c.n), tris: Math.round(c.tris / c.n), figs: x.figs(), gfx: x.gfx() });
    this.fresh();
  }
  start(mode) {
    if (this.mode) return;
    const p = this.ctx.player;
    this.mode = mode; this.rows = []; this.t0 = performance.now() / 1000; this.fresh();
    if (mode === 'tour') {
      this.back = { x: p.x, z: p.z, yaw: p.yaw }; this.stop = -1; this.wait = 0; this.got = 0;
      this.ctx.hold(true); this.next();
      this.ctx.chat('c-sys', `Speed test: visiting ${STOPS.length} spots, about ${Math.round(STOPS.length * (SETTLE + PER * SAMPLES))} seconds. Hands off; Esc stops it.`);
    } else this.ctx.chat('c-sys', 'Speed log on: a sample every 2 seconds while you play. Type /fpslog again to stop and see the report.');
  }
  next() {
    this.stop++;
    if (this.stop >= STOPS.length) return this.end();
    const [x, z, yaw] = STOPS[this.stop], p = this.ctx.player;
    p.x = x; p.z = z; p.yaw = yaw; p.camOff = 0; p.pitch = 0.28; this.wait = SETTLE; this.got = 0;
  }
  tourStep(dt) {
    if (this.wait > 0) { this.wait -= dt; if (this.wait <= 0) this.fresh(); return; }
    if (this.cur.time >= PER) { this.take(STOPS[this.stop][3]); if (++this.got >= SAMPLES) this.next(); }
  }
  end(cancel) {
    const mode = this.mode; if (!mode) return;
    this.mode = null;
    if (mode === 'tour') { const p = this.ctx.player; Object.assign(p, this.back); p.camOff = 0; this.ctx.hold(false); }
    if (cancel && !this.rows.length) { this.ctx.chat('c-sys', 'Speed test stopped.'); return; }
    this.ctx.show(this.report(mode, cancel));
  }
  report(mode, cancel) {
    const r = this.rows, d = this.ctx.device();
    const f1 = v => v.toFixed(1), pad = (s, n) => String(s).padEnd(n);
    const all = r.length ? { fps: r.reduce((a, b) => a + b.fps, 0) / r.length, worst: Math.max(...r.map(b => b.worst)), jank: r.reduce((a, b) => a + b.jank, 0) } : null;
    const lines = [
      `MMO Healer speed ${mode === 'tour' ? 'test (tour)' : 'log (free play)'}${cancel ? ', stopped early' : ''}, ${new Date().toLocaleString()}`,
      `Window ${d.w}x${d.h}, screen ${d.sw}x${d.sh}, device pixel ratio ${d.dpr}, drawing at ${d.cw}x${d.ch} (${(d.cw * d.ch / 1e6).toFixed(2)} megapixels)`,
      `Graphics ${d.quality}, now at ${d.level}. Render size ${d.render}. Antialias ${d.aa ? 'on' : 'off'}. GPU: ${d.gpu}`,
      all ? `Overall: ${f1(all.fps)} fps average, worst frame ${Math.round(all.worst)} ms, ${all.jank} frames over 50 ms` : 'No samples.',
      'gfx column: the setting, then steps turned down (-1 glow off, -2 shadows off, -3 lower resolution).',
      '',
      'time  fps   avg ms  worst  >50ms  calls  tris   figs  gfx    x,z         facing  where',
      ...r.map(s => [pad(s.t + 's', 5), pad(f1(s.fps), 5), pad(f1(s.avg), 7), pad(Math.round(s.worst), 6), pad(s.jank, 6), pad(s.calls, 6), pad(Math.round(s.tris / 1000) + 'k', 6),
        pad(s.figs, 5), pad(s.gfx, 6), pad(s.x + ',' + s.z, 11), pad(s.head + '°', 7), s.label || s.zone].join(' ')),
    ];
    return lines.join('\n');
  }
}
export const TOUR_STOPS = STOPS;
