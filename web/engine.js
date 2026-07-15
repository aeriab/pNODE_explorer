'use strict';
// ===================================================================== //
//  tipNODE forecast engine — pure-JS port of backend/engine.py.
//  Runs the whole forecast in the browser so the site is 100% static
//  (deployable to GitHub Pages, no Python backend).
//
//  It exposes window.LOCAL_API(path, opts), a drop-in replacement for the
//  old fetch('/api/...') calls:
//    GET  /api/meta            -> meta.json
//    GET  /api/patients        -> patients/index.json
//    GET  /api/patient/<pid>   -> patients/<pid>.json (comps stashed for forecast)
//    POST /api/forecast        -> forecast() computed locally
//
//  Numerics mirror engine.py exactly: state x = softmax(z); dz/dt = MLP(x, abx(t));
//  fixed-step forward Euler (dt = 0.25) — validated to match torch run_model to ~5e-6.
// ===================================================================== //
(function () {
  // Resolve data files relative to THIS script's URL, so the site works under
  // any GitHub Pages sub-path (e.g. user.github.io/repo/).
  const _self = document.currentScript ? document.currentScript.src : location.href;
  const BASE = new URL('.', _self);

  async function loadJSON(rel) {
    const r = await fetch(new URL(rel, BASE));
    if (!r.ok) throw new Error('fetch ' + rel + ': HTTP ' + r.status);
    return r.json();
  }

  let MODEL = null, META = null, PIDX = null;
  const PCACHE = {};   // pid -> patient detail (comps stripped, as the old API returned)
  const COMP = {};     // pid -> { sample_id: Float64Array(N) } start compositions

  async function ensureLoaded() {
    if (MODEL) return;
    const [m, meta, pidx] = await Promise.all([
      loadJSON('model.json'), loadJSON('meta.json'), loadJSON('patients/index.json'),
    ]);
    MODEL = m; META = meta; PIDX = pidx;
    MODEL.W1 = Float64Array.from(m.W1); MODEL.b1 = Float64Array.from(m.b1);
    MODEL.W2 = Float64Array.from(m.W2); MODEL.b2 = Float64Array.from(m.b2);
    MODEL.W3 = Float64Array.from(m.W3); MODEL.b3 = Float64Array.from(m.b3);
    MODEL.abx_index = {};
    m.abx_types.forEach((c, i) => { MODEL.abx_index[c] = i; });
  }

  // ------------------------------------------------------------------- //
  //  math primitives
  // ------------------------------------------------------------------- //
  function softmax(z) {
    let mx = -Infinity;
    for (let i = 0; i < z.length; i++) if (z[i] > mx) mx = z[i];
    const e = new Float64Array(z.length);
    let s = 0;
    for (let i = 0; i < z.length; i++) { e[i] = Math.exp(z[i] - mx); s += e[i]; }
    for (let i = 0; i < z.length; i++) e[i] /= s;
    return e;
  }
  const silu = (x) => x / (1 + Math.exp(-x));

  // y = W·x + b  (W flat row-major, shape (outN, inN); outN = b.length, inN = x.length)
  function dense(W, b, x) {
    const outN = b.length, inN = x.length;
    const y = new Float64Array(outN);
    for (let o = 0; o < outN; o++) {
      let s = b[o];
      const base = o * inN;
      for (let i = 0; i < inN; i++) s += W[base + i] * x[i];
      y[o] = s;
    }
    return y;
  }

  // dz/dt = net(concat(softmax(z)=x, abx_enc))  — SiLU on the two hidden layers.
  function rhs(x, enc) {
    const inp = new Float64Array(MODEL.N + MODEL.n_abx);
    inp.set(x, 0); inp.set(enc, MODEL.N);
    let h = dense(MODEL.W1, MODEL.b1, inp); for (let i = 0; i < h.length; i++) h[i] = silu(h[i]);
    let h2 = dense(MODEL.W2, MODEL.b2, h); for (let i = 0; i < h2.length; i++) h2[i] = silu(h2[i]);
    return dense(MODEL.W3, MODEL.b3, h2);
  }

  // antibiotic encoding at absolute HCT day (mirrors _build_abx_dict + lookup at 0.1 res)
  function encAt(tAbs, schedule) {
    const rt = Math.round(tAbs * 10) / 10;
    const v = new Float64Array(MODEL.n_abx);
    for (const cat in schedule) {
      const ci = MODEL.abx_index[cat];
      if (ci === undefined) continue;
      const ivs = schedule[cat];
      for (let k = 0; k < ivs.length; k++) {
        const s = ivs[k][0], e = ivs[k][1];
        if (Math.round(s * 10) / 10 <= rt && rt <= e + 1e-9) { v[ci] = 1; break; }
      }
    }
    return v;
  }

  function sumIdx(vec, idxs) { let s = 0; for (let i = 0; i < idxs.length; i++) s += vec[idxs[i]]; return s; }

  function shannon(comp) {
    let s = 0; const N = MODEL.N; const p = new Float64Array(N);
    for (let i = 0; i < N; i++) { p[i] = Math.max(comp[i], 1e-12); s += p[i]; }
    let h = 0; for (let i = 0; i < N; i++) { const q = p[i] / s; h += -q * Math.log(q); }
    return h;
  }
  function invSimpson(comp) {
    let s = 0; const N = MODEL.N; const p = new Float64Array(N);
    for (let i = 0; i < N; i++) { p[i] = Math.max(comp[i], 1e-12); s += p[i]; }
    let d = 0; for (let i = 0; i < N; i++) { const q = p[i] / s; d += q * q; }
    return 1 / d;
  }

  // genus-level gut-health index in [0,100] — see backend/HEALTH_INDEX.md
  function healthIndex(comp) {
    const N = MODEL.N;
    let sum = 0; for (let i = 0; i < N; i++) sum += comp[i];
    const denom = Math.max(sum, 1e-9);
    const cn = new Float64Array(N); for (let i = 0; i < N; i++) cn[i] = comp[i] / denom;
    const b = sumIdx(cn, MODEL.beneficial_idx);
    const h = sumIdx(cn, MODEL.harmful_idx);
    const L = Math.log10((b + 1e-5) / (h + 1e-5));
    let prSum = 0; for (let i = 0; i < N; i++) if (MODEL.real_mask[i]) prSum += cn[i];
    prSum = Math.max(prSum, 1e-12);
    let ent = 0, R = 0, maxp = 0;
    for (let i = 0; i < N; i++) {
      if (!MODEL.real_mask[i]) continue;
      const p = cn[i] / prSum;
      if (p > 0) { ent += -p * Math.log(p); R++; }
      if (p > maxp) maxp = p;
    }
    if (R < 2) R = 2;
    const J = ent / Math.log(R);
    const dom = MODEL.dom_thresh;
    const P = Math.min(Math.max((maxp - dom) / (1 - dom), 0), 1);
    const g = MODEL.gmhi;
    const eta = g.a0 + g.al * L + g.aj * (J - 0.5) - g.ap * P;
    return 100 / (1 + Math.exp(-eta));
  }

  function trapz(y, x) {
    let s = 0; for (let i = 0; i < x.length - 1; i++) s += (x[i + 1] - x[i]) * (y[i] + y[i + 1]) / 2;
    return s;
  }

  // composition band names, in stacked order (6 pathogens, aggregated pathobionts,
  // commensals, Other) — matches TipnodeEngine.forecast's comp_taxa.
  function compTaxaList() {
    const dt = MODEL.display_taxa, NPATH = 6;
    return dt.slice(0, NPATH).concat(['Other pathobionts'], dt.slice(NPATH), ['Other']);
  }
  // band values for a SINGLE composition vector (used for observed-sample bars)
  function compBandsVec(y) {
    const dt = MODEL.display_taxa, dIdx = MODEL.display_idx, NPATH = 6;
    const out = []; let dispSum = 0;
    for (let j = 0; j < NPATH; j++) { const v = y[dIdx[j]]; out.push(v); dispSum += v; }
    const op = sumIdx(y, MODEL.pathobiont_extra_idx); out.push(op);
    for (let j = NPATH; j < dt.length; j++) { const v = y[dIdx[j]]; out.push(v); dispSum += v; }
    out.push(Math.max(1 - dispSum - op, 0));
    return out;
  }

  // ------------------------------------------------------------------- //
  //  the forecast (port of TipnodeEngine.forecast)
  // ------------------------------------------------------------------- //
  function forecast(y0, t0, horizon, schedule) {
    // Reproduces pnode_notime.simulate(): gauge-recentered forward Euler in log
    // space, dt from MODEL.step. x = softmax(z) (recentering is softmax-invariant).
    const N = MODEL.N, step = MODEL.step || 0.5, recenter = MODEL.recenter !== false;
    const plotStep = step;
    const ngrid = Math.round(horizon / step) + 1;
    const dtStep = horizon / (ngrid - 1);
    const tau = new Float64Array(ngrid);
    for (let i = 0; i < ngrid; i++) tau[i] = dtStep * i;

    // z0 = log(clip(y0, 1e-6)); optionally recenter (z - mean)
    let z = new Float64Array(N);
    for (let i = 0; i < N; i++) z[i] = Math.log(Math.max(y0[i], 1e-6));
    if (recenter) { let m = 0; for (let i = 0; i < N; i++) m += z[i]; m /= N; for (let i = 0; i < N; i++) z[i] -= m; }

    const Y = new Array(ngrid);
    Y[0] = softmax(z);
    for (let i = 0; i < ngrid - 1; i++) {
      const enc = encAt(t0 + tau[i], schedule);
      const f = rhs(Y[i], enc);
      const zn = new Float64Array(N);
      for (let k = 0; k < N; k++) zn[k] = z[k] + dtStep * f[k];
      if (recenter) { let m = 0; for (let k = 0; k < N; k++) m += zn[k]; m /= N; for (let k = 0; k < N; k++) zn[k] -= m; }
      z = zn;
      Y[i + 1] = softmax(z);
    }

    // full-resolution scalar trajectories (metrics use these)
    const day = new Float64Array(ngrid), entero = new Float64Array(ngrid),
      nonentero = new Float64Array(ngrid), shan = new Float64Array(ngrid),
      invs = new Float64Array(ngrid), gmhi = new Float64Array(ngrid);
    for (let i = 0; i < ngrid; i++) {
      day[i] = t0 + tau[i];
      entero[i] = sumIdx(Y[i], MODEL.entero_idx);
      nonentero[i] = sumIdx(Y[i], MODEL.nonentero_idx);
      shan[i] = shannon(Y[i]);
      invs[i] = invSimpson(Y[i]);
      gmhi[i] = healthIndex(Y[i]);
    }

    const metrics = riskMetrics(tau, entero, nonentero, Y, day, horizon);

    // downsample for plotting (keep = round(plotStep/step))
    const keep = Math.max(1, Math.round(plotStep / step));
    const ds = [];
    for (let i = 0; i < ngrid; i += keep) ds.push(i);

    // composition bands: 6 pathogen display taxa, aggregated "Other pathobionts",
    // remaining display taxa (commensals), then neutral "Other".
    const dt = MODEL.display_taxa, dIdx = MODEL.display_idx, NPATH = 6;
    const compTaxa = dt.slice(0, NPATH).concat(['Other pathobionts'], dt.slice(NPATH), ['Other']);
    const values = compTaxa.map(() => []);
    for (const i of ds) {
      const yi = Y[i];
      let dispSum = 0;
      for (let j = 0; j < NPATH; j++) { const v = yi[dIdx[j]]; values[j].push(v); dispSum += v; }
      const op = sumIdx(yi, MODEL.pathobiont_extra_idx);
      values[NPATH].push(op);
      for (let j = NPATH; j < dt.length; j++) { const v = yi[dIdx[j]]; values[j + 1].push(v); dispSum += v; }
      values[compTaxa.length - 1].push(Math.max(1 - dispSum - op, 0));
    }

    const pick = (arr) => ds.map((i) => arr[i]);
    return {
      t0: t0, horizon: horizon,
      day: pick(day), tau: ds.map((i) => tau[i]),
      composition: { taxa: compTaxa, values: values },
      entero: pick(entero), nonentero: pick(nonentero),
      shannon: pick(shan), invsimpson: pick(invs), gmhi: pick(gmhi),
      metrics: metrics,
    };
  }

  function riskMetrics(tau, entero, nonentero, Y, day, horizon) {
    const RW = MODEL.risk_window, dom = MODEL.dom_thresh;
    const idx = []; for (let i = 0; i < tau.length; i++) if (tau[i] <= RW + 1e-9) idx.push(i);
    const tH = idx.map((i) => tau[i]);
    const eH = idx.map((i) => entero[i]);
    const neH = idx.map((i) => nonentero[i]);
    const daysAbove = tH.length > 1 ? trapz(eH.map((v) => (v > dom ? 1 : 0)), tH) : 0;
    const areaAbove = tH.length > 1 ? trapz(eH.map((v) => Math.max(v - dom, 0)), tH) : 0;
    let peak = -Infinity, pi = 0;
    for (let i = 0; i < entero.length; i++) if (entero[i] > peak) { peak = entero[i]; pi = i; }
    const rDay = Math.min(14, horizon);
    let ri = 0, best = Infinity;
    for (let i = 0; i < tau.length; i++) { const d = Math.abs(tau[i] - rDay); if (d < best) { best = d; ri = i; } }
    const nePeak = neH.length ? Math.max.apply(null, neH) : Math.max.apply(null, Array.from(nonentero));
    return {
      entero_a0: entero[0], entero_peak: peak, entero_peak_day: day[pi],
      'entero_days_above_0.3': Math.round(daysAbove * 100) / 100,
      'entero_area_above_0.3': Math.round(areaAbove * 1000) / 1000,
      nonentero_a0: nonentero[0], nonentero_peak: nePeak,
      shannon_readout: shannon(Y[ri]), invsimpson_readout: invSimpson(Y[ri]),
      gmhi_readout: healthIndex(Y[ri]), readout_day: rDay,
    };
  }

  // ------------------------------------------------------------------- //
  //  local API router (drop-in for the old fetch-based api())
  // ------------------------------------------------------------------- //
  async function getPatient(pid) {
    if (!PCACHE[pid]) {
      const d = await loadJSON('patients/' + encodeURIComponent(pid) + '.json');
      COMP[pid] = {};
      for (const s of d.samples) COMP[pid][s.sample_id] = Float64Array.from(s.comp);
      PCACHE[pid] = {
        id: d.id,
        samples: d.samples.map((s) => ({ sample_id: s.sample_id, day: s.day })),
        schedule: d.schedule, abx_order: d.abx_order,
        observed: d.observed || [], day_range: d.day_range,
        // observed 16S composition, as display bands, for the "view observed" chart
        observed_composition: d.samples.map((s) => ({
          day: s.day, values: compBandsVec(COMP[pid][s.sample_id]),
        })),
        comp_taxa: compTaxaList(),
      };
    }
    return PCACHE[pid];
  }

  async function runForecast(body) {
    const pid = body.pid, sid = body.sample_id;
    if (!COMP[pid]) await getPatient(pid);
    const pv = PCACHE[pid];
    const smp = pv.samples.find((s) => String(s.sample_id) === String(sid)) || pv.samples[0];
    const y0 = COMP[pid][smp.sample_id];
    return forecast(y0, smp.day, +body.horizon || 45, body.schedule || {});
  }

  async function LOCAL_API(path, opts) {
    await ensureLoaded();
    const method = (opts && opts.method) || 'GET';
    if (method === 'GET') {
      if (path === '/api/meta') return META;
      if (path === '/api/patients') return PIDX;
      if (path.indexOf('/api/patient/') === 0) {
        return getPatient(decodeURIComponent(path.slice('/api/patient/'.length)));
      }
    } else if (method === 'POST' && path === '/api/forecast') {
      return runForecast(JSON.parse(opts.body));
    }
    throw new Error('unknown local endpoint ' + method + ' ' + path);
  }

  window.LOCAL_API = LOCAL_API;
  window.__tipnodeForecast = forecast; // exposed for the parity test harness
})();
