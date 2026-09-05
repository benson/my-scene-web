export const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const plain = (value) =>
  String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\r/g, "");
export const rows = (d) => {
  const n = d?.TEMPLATE?.length || 1,
    a = d?.FORMS || [];
  return Array.from({ length: Math.floor(a.length / n) }, (_, i) =>
    Object.fromEntries(d.TEMPLATE.map((k, j) => [k, a[i * n + j]])),
  );
};
export const pad = (n) => String(n).padStart(2, "0");

export class Engine {
  constructor(data, canvas, layer) {
    this.data = data;
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.layer = layer;
    this.cache = new Map();
    this.pending = new Map();
    this.hits = [];
    this.buttons = new Map();
    this.hover = null;
    this.clock = 0;
    this.render = () => {};
    this.motion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.last = performance.now();
    this.running = true;
    requestAnimationFrame((t) => this.tick(t));
  }
  async image(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.pending.has(key)) return this.pending.get(key);
    const src = this.data.images[key]?.src;
    if (!src) return null;
    const p = new Promise((resolve, reject) => {
      const im = new Image();
      im.onload = () => {
        this.cache.set(key, im);
        resolve(im);
      };
      im.onerror = () => {
        this.pending.delete(key);
        reject(new Error(`Could not load artwork: ${src}`));
      };
      im.src = src;
    });
    this.pending.set(key, p);
    return p;
  }
  effect(name, fx) {
    const s = this.data.sprites[name];
    if (!s) return null;
    const chosen =
      s.effects[fx] ||
      s.effects.Still ||
      s.effects.Up ||
      Object.values(s.effects).find((f) => f.image) ||
      Object.values(s.effects)[0];
    return chosen?.unavailable || chosen?.dynamic ? null : chosen;
  }
  async preload(names) {
    const keys = new Set();
    for (const n of names) {
      if (this.data.images[n]) keys.add(n);
      else
        for (const f of Object.values(this.data.sprites[n]?.effects || {}))
          if (f.image) keys.add(f.image);
    }
    await Promise.all([...keys].map((k) => this.image(k)));
  }
  frame(effect, time = 0, loop = true) {
    if (!effect?.frames?.length) return [];
    const t = this.motion ? Math.max(0, time) : 0;
    const i = Math.floor(t / Math.max(16, effect.delay || 100));
    return effect.frames[
      loop ? i % effect.frames.length : Math.min(i, effect.frames.length - 1)
    ];
  }
  bounds(name, fx, time = 0) {
    const f = this.effect(name, fx),
      parts = this.frame(f, time);
    if (!parts.length) return null;
    let l = Infinity,
      t = Infinity,
      r = -Infinity,
      b = -Infinity;
    for (const [ri, x, y] of parts) {
      const rect = f.rects[ri];
      if (!rect) continue;
      l = Math.min(l, x);
      t = Math.min(t, y);
      r = Math.max(r, x + rect[2] - rect[0]);
      b = Math.max(b, y + rect[3] - rect[1]);
    }
    return { x: l, y: t, w: r - l, h: b - t };
  }
  draw(name, fx = "Still", o = {}) {
    const f = this.effect(name, fx);
    if (!f?.image) return null;
    const im = this.cache.get(f.image);
    if (!im) {
      this.image(f.image).catch(() => {});
      return null;
    }
    const ctx = o.ctx || this.ctx;
    const time = o.time ?? 0;
    const parts = this.frame(f, time, o.loop !== false);
    let dx = o.dx || 0,
      dy = o.dy || 0,
      scale = o.scale || 1;
    const bound = this.bounds(name, fx, time);
    if (!bound) return null;
    if (o.fit) {
      const [x, y, w, h] = o.fit;
      scale = Math.min(w / (bound.w || 1), h / (bound.h || 1));
      dx = x + (w - bound.w * scale) / 2 - bound.x * scale;
      dy = y + (h - bound.h * scale) / 2 - bound.y * scale;
    }
    ctx.save();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    ctx.translate(dx, dy);
    ctx.scale(scale, scale);
    for (const [ri, x, y] of parts) {
      const rect = f.rects[ri];
      if (!rect) continue;
      const [l, t, r, b] = rect;
      if (r > l && b > t)
        ctx.drawImage(im, l, t, r - l, b - t, x, y, r - l, b - t);
    }
    ctx.restore();
    const hit = {
      x: dx + bound.x * scale,
      y: dy + bound.y * scale,
      w: bound.w * scale,
      h: bound.h * scale,
    };
    if (o.action) this.hit(o.id || name, o.label || name, hit, o.action);
    return hit;
  }
  background(key) {
    const im = this.cache.get(key);
    if (im) this.ctx.drawImage(im, 0, 0, 800, 600);
    else if (key) this.image(key).catch(() => {});
  }
  hit(id, label, rect, action) {
    if (rect && rect.w > 0 && rect.h > 0)
      this.hits.push({ id, label, rect, action });
  }
  button(name, label, action, o = {}) {
    const fx = this.hover === (o.id || name) ? "Highlight" : "Up";
    return this.draw(name, fx, { ...o, label, action });
  }
  text(
    text,
    x,
    y,
    {
      size = 18,
      color = "#512449",
      align = "left",
      maxWidth = 700,
      bold = false,
      singleLine = false,
    } = {},
  ) {
    this.ctx.save();
    this.ctx.fillStyle = color;
    this.ctx.font = `${bold ? "bold " : ""}${size}px Trebuchet MS, Arial`;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = "top";
    if (singleLine) {
      let line = plain(text);
      if (this.ctx.measureText(line).width > maxWidth) {
        const characters = Array.from(line);
        while (characters.length && this.ctx.measureText(characters.join("") + "…").width > maxWidth)
          characters.pop();
        line = characters.join("") + "…";
      }
      this.ctx.fillText(line, x, y);
      this.ctx.restore();
      return y + size * 1.3;
    }
    let line = "",
      cy = y;
    for (const word of plain(text).split(/\s+/)) {
      const t = line ? line + " " + word : word;
      if (this.ctx.measureText(t).width > maxWidth && line) {
        this.ctx.fillText(line, x, cy);
        line = word;
        cy += size * 1.3;
      } else line = t;
    }
    this.ctx.fillText(line, x, cy);
    this.ctx.restore();
    return cy + size * 1.3;
  }
  panel(x, y, w, h, fill = "#fff7e6ef") {
    const c = this.ctx;
    c.fillStyle = fill;
    c.beginPath();
    c.roundRect(x, y, w, h, 12);
    c.fill();
  }
  syncHits() {
    const current = new Set();
    for (const h of this.hits) {
      current.add(h.id);
      let b = this.buttons.get(h.id);
      if (!b) {
        b = document.createElement("button");
        b.type = "button";
        b.onpointerenter = () => {
          this.hover = h.id;
        };
        b.onpointerleave = () => {
          this.hover = null;
        };
        this.layer.append(b);
        this.buttons.set(h.id, b);
      }
      b.setAttribute("aria-label", h.label);
      b.title = h.label;
      b.onclick = h.action;
      b.style.left = `${h.rect.x / 8}%`;
      b.style.top = `${h.rect.y / 6}%`;
      b.style.width = `${h.rect.w / 8}%`;
      b.style.height = `${h.rect.h / 6}%`;
    }
    for (const [id, b] of this.buttons)
      if (!current.has(id)) {
        b.remove();
        this.buttons.delete(id);
      }
  }
  tick(t) {
    if (!this.running) return;
    const dt = Math.min((t - this.last) / 1000, 0.08);
    this.last = t;
    this.clock = t;
    this.hits = [];
    this.ctx.clearRect(0, 0, 800, 600);
    this.render(t, dt);
    this.syncHits();
    requestAnimationFrame((t) => this.tick(t));
  }
  async thumbnail(name, fx, width = 100, height = 100) {
    const f = this.effect(name, fx);
    if (f?.image) await this.image(f.image);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    this.draw(name, fx, {
      ctx: canvas.getContext("2d"),
      fit: [3, 3, width - 6, height - 6],
    });
    return canvas;
  }
}

export class Sound {
  constructor(data) {
    this.data = data;
    this.context = null;
    this.buffers = new Map();
    this.master = null;
    this.sources = [];
    this.voice = null;
    this.ambient = null;
    this.muted = false;
    this.mixToken = 0;
    this.channels = new Map();
    this.requests = new Map();
  }
  async activate() {
    this.context ||= new AudioContext();
    if (!this.master) {
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    this.master.gain.value = this.muted ? 0 : 0.65;
    await this.context.resume();
  }
  key(name, fx) {
    if (this.data.audio[name]) return name;
    let s = this.data.sprites[name];
    if (!s && /^VocCl(Barbie|Chelsea|Madison)VO$/.test(name))
      s =
        this.data.sprites[
          name.replace("VocCl", "AniCl").replace("VO", "Talk01")
        ];
    const f = fx
      ? s?.effects[fx]
      : s?.effects.Play ||
        s?.effects.Snd ||
        Object.values(s?.effects || {}).find((x) => x.sound);
    return f?.sound;
  }
  async buffer(name, fx) {
    const key = this.key(name, fx);
    if (!key || !this.data.audio[key]) return null;
    if (this.buffers.has(key)) return this.buffers.get(key);
    await this.activate();
    const promise = fetch(this.data.audio[key])
      .then((r) => {
        if (!r.ok) throw new Error("Audio unavailable");
        return r.arrayBuffer();
      })
      .then((b) => this.context.decodeAudioData(b));
    this.buffers.set(key, promise);
    try {
      return await promise;
    } catch (e) {
      this.buffers.delete(key);
      throw e;
    }
  }
  async play(name, fx, { loop = false, channel = "voice", gain = 1 } = {}) {
    const key = this.key(name, fx);
    if (!key) return null;
    const token = (this.requests.get(channel) || 0) + 1;
    this.requests.set(channel, token);
    const buffer = await this.buffer(key);
    if (
      !buffer ||
      (channel !== "effect" && this.requests.get(channel) !== token)
    )
      return null;
    const source = this.context.createBufferSource(),
      volume = this.context.createGain();
    source.buffer = buffer;
    source.loop = loop;
    volume.gain.value = gain;
    source.connect(volume).connect(this.master);
    if (channel !== "effect") {
      try {
        this.channels.get(channel)?.stop();
      } catch {}
      this.channels.set(channel, source);
    }
    if (channel === "voice") this.voice = source;
    if (channel === "ambient") this.ambient = source;
    source.start();
    return source;
  }
  async mix(names, { offset = 0 } = {}) {
    const token = ++this.mixToken;
    this.stopMix(false);
    const buffers = await Promise.all(names.map((n) => this.buffer(n)));
    if (token !== this.mixToken) return;
    const at = this.context.currentTime + 0.06;
    this.sources = buffers.filter(Boolean).map((b) => {
      const s = this.context.createBufferSource(),
        g = this.context.createGain();
      s.buffer = b;
      s.loop = true;
      g.gain.value = 0.45;
      s.connect(g).connect(this.master);
      s.start(at, offset % b.duration);
      return s;
    });
    this.mixStarted = at;
    return buffers;
  }
  stopMix(increment = true) {
    if (increment) this.mixToken++;
    this.sources.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    this.sources = [];
  }
  stopVoice() {
    this.requests.set("voice", (this.requests.get("voice") || 0) + 1);
    try {
      this.voice?.stop();
    } catch {}
    this.voice = null;
  }
  stopAmbient() {
    this.requests.set("ambient", (this.requests.get("ambient") || 0) + 1);
    try {
      this.ambient?.stop();
    } catch {}
    this.ambient = null;
  }
  mute(value) {
    this.muted = value;
    if (this.master)
      this.master.gain.setTargetAtTime(
        value ? 0 : 0.65,
        this.context.currentTime,
        0.02,
      );
  }
}
