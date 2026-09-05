import { rows, pad, esc, plain } from "./engine.mjs";
import { waitForVoice } from "./story.mjs";
import { firstVisit, speakSequence, leaveAfterVoice, oneOf } from "./narration.mjs";

const canvas = () => {
  const c = document.createElement("canvas");
  c.width = 800;
  c.height = 600;
  return c;
};
const snapshot = (s) => JSON.stringify(s);
const normalize = (s) => String(s).replace("Fastner", "Fastner");

export function validateClothes(brief, state, parts) {
  const problems = [];
  if (
    brief.DESIGN_CORRECT?.length &&
    !brief.DESIGN_CORRECT.includes(state.design)
  )
    problems.push("Choose a sketch that matches the brief.");
  if (parts.some((p) => !state.fills[p]))
    problems.push("Give every garment section a fabric.");
  const used = {
    FABRIC: Object.values(state.fills),
    FASTENER: state.marks
      .filter((m) => m.kind === "Fasteners")
      .map((m) => m.id),
    STAMP: state.marks.filter((m) => m.kind === "Stamps").map((m) => m.id),
    TRIM: state.marks.filter((m) => m.kind === "Trims").map((m) => m.id),
  };
  for (const [kind, values] of Object.entries(used)) {
    const good = brief[`CORRECT_${kind}`] || [],
      bad = brief[`INCORRECT_${kind}`] || [];
    if (good.length && !values.some((v) => good.includes(v)))
      problems.push(`Include ${kind.toLowerCase()} that fits the brief.`);
    if (values.some((v) => bad.includes(v)))
      problems.push(
        `Remove the ${kind.toLowerCase()} the brief asks you to avoid.`,
      );
  }
  return problems;
}
export function validateWindow(brief, state) {
  const problems = [],
    used = {
      TOP: state.slots.filter((s) => s?.includes("Top")),
      BOTTOM: state.slots.filter((s) => s?.includes("Bottom")),
      STICKER: state.marks
        .filter((m) => m.kind === "Letters & stamps")
        .map((m) => m.sprite),
      TRIM: state.marks.filter((m) => m.kind === "Trims").map((m) => m.sprite),
    };
  if (state.slots.filter(Boolean).length < 6)
    problems.push("Dress all six display spots.");
  for (const [kind, values] of Object.entries(used)) {
    const good = brief[`CORRECT_${kind}`] || [],
      bad = brief[`INCORRECT_${kind}`] || [];
    if (
      good.length &&
      !(kind === "TOP" || kind === "BOTTOM"
        ? values.length && values.every((v) => good.includes(v))
        : values.some((v) => good.includes(v)))
    )
      problems.push(
        `Check the ${kind.toLowerCase()} choices against the brief.`,
      );
    if (values.some((v) => bad.includes(v)))
      problems.push(
        `Remove the ${kind.toLowerCase()} the brief asks you to avoid.`,
      );
  }
  return problems;
}
export function validateMusic(brief, selections) {
  const options = rows(brief);
  return selections.map((choice, i) =>
    Boolean(options[choice]?.[`CORRECT${i + 1}`]),
  );
}

function wav(buffer) {
  const channels = buffer.numberOfChannels,
    length = buffer.length,
    out = new ArrayBuffer(44 + length * channels * 2),
    v = new DataView(out),
    write = (at, s) =>
      [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  write(0, "RIFF");
  v.setUint32(4, out.byteLength - 8, true);
  write(8, "WAVE");
  write(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, channels, true);
  v.setUint32(24, buffer.sampleRate, true);
  v.setUint32(28, buffer.sampleRate * channels * 2, true);
  v.setUint16(32, channels * 2, true);
  v.setUint16(34, 16, true);
  write(36, "data");
  v.setUint32(40, out.byteLength - 44, true);
  for (let i = 0; i < length; i++)
    for (let c = 0; c < channels; c++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(c)[i]));
      v.setInt16(
        44 + (i * channels + c) * 2,
        sample < 0 ? sample * 32768 : sample * 32767,
        true,
      );
    }
  return new Blob([out], { type: "audio/wav" });
}

export function installCreative(g) {
  const e = g.e;
  async function design(window = false) {
    const scene = window ? "ScWdWinDress" : "ScCdClothesDes",
      briefs =
        g.week[window ? "WINDOW_DRESS_DICT" : "CLOTHING_DESIGN_DICT"] || [],
      state = g.activity(scene, {
        brief: 0,
        design: "DctScDesign01",
        fills: {},
        marks: [],
        slots: Array(6).fill(null),
        tab: window ? "Clothes" : "Fabrics",
        tool: null,
        erase: false,
        move: false,
        undo: [],
        paid: [],
        selectedPart: 0,
      });
    const brief = g.d(briefs[state.brief % briefs.length]);
    let regions = [],
      overlay,
      generation = 0,
      layer = canvas(),
      masks = new Map(),
      drag = null,
      changed = false;
    const inventories = window
      ? {
          Clothes: g
            .r("DctWdInvFashion")
            .filter((x) => x.ICON)
            .map((x) => ({ icon: x.ICON, sprite: x.CURSOR, id: x.CURSOR })),
          "Letters & stamps": Array.from({ length: 54 }, (_, i) => ({
            icon: `AniWdStmpMenu${pad(i + 1)}`,
            sprite: `AniWdStmp${pad(i + 1)}`,
            id: `AniWdStmp${pad(i + 1)}`,
          })),
          Trims: Array.from({ length: 36 }, (_, i) => ({
            icon: `AniWdTrmMenu${pad(i + 1)}`,
            sprite: `AniWdTrm${pad(i + 1)}`,
            id: `AniWdTrm${pad(i + 1)}`,
          })),
        }
      : {
          Fabrics: g
            .r("DctScInvFabrics")
            .map((x) => ({ icon: x.ICON, sprite: x.FABRIC, id: x.FABRIC })),
          Fasteners: g
            .r("DctScInvFasteners")
            .map((x) => ({ icon: x.ICON, sprite: x.CURSOR, id: x.SPRITE })),
          Stamps: g
            .r("DctScInvStamps")
            .map((x) => ({ icon: x.ICON, sprite: x.CURSOR, id: x.SPRITE })),
          Trims: Array.from({ length: 24 }, (_, i) => ({
            icon: `AniCdTrm${pad(i + 1)}`,
            sprite: `AniCdTrmCur${pad(i + 1)}`,
            id: `AniCdTrim${pad(i + 1)}`,
          })),
        };
    const spots = g.r("DctWdSpots");
    const remember = () => {
      state.undo.push(
        snapshot({
          design: state.design,
          fills: state.fills,
          marks: state.marks,
          slots: state.slots,
        }),
      );
      if (state.undo.length > 35) state.undo.shift();
    };
    const update = () => {
      g.save();
      buildLayer();
    };
    async function setup() {
      const token = ++generation;
      const d = g.d(state.design);
      regions = rows(d).map((r) => r.MATTESP);
      overlay = d.OVERLAY;
      if (!await g.prepare([
        g.background(scene),
        ...(window ? [] : [overlay, ...regions]),
        ...Object.values(inventories).flatMap((a) =>
          a.flatMap((i) => [i.icon, i.sprite]),
        ),
      ])) return false;
      if (token !== generation) return false;
      masks.clear();
      for (const part of window ? [] : regions) {
        const mask = canvas();
        e.draw(part, "Still", { ctx: mask.getContext("2d"), dx: 357, dy: 7 });
        masks.set(part, mask);
      }
      buildLayer();
      panel();
      return true;
    }
    function buildLayer() {
      const c = layer.getContext("2d");
      c.clearRect(0, 0, 800, 600);
      if (window) {
        state.slots.forEach((s, i) => {
          if (s)
            e.draw(s, "Still", {
              ctx: c,
              dx: spots[i].LOCX,
              dy: spots[i].LOCY,
            });
        });
      } else {
        for (const part of regions) {
          const fabric = state.fills[part],
            mask = masks.get(part);
          if (!fabric || !mask) continue;
          const filled = canvas(),
            f = filled.getContext("2d");
          f.drawImage(mask, 0, 0);
          f.globalCompositeOperation = "source-in";
          const fx = e.effect(fabric),
            im = e.cache.get(fx?.image);
          if (im) {
            f.fillStyle = f.createPattern(im, "repeat");
            f.fillRect(0, 0, 800, 600);
          }
          c.drawImage(filled, 0, 0);
        }
        e.draw(overlay, "Still", { ctx: c });
      }
      for (const mark of state.marks)
        e.draw(mark.sprite, "Still", {
          ctx: c,
          dx: mark.x,
          dy: mark.y,
          scale: mark.scale || 1,
        });
    }
    function pickRegion(x, y) {
      return regions.find(
        (part) =>
          masks
            .get(part)
            ?.getContext("2d")
            .getImageData(Math.round(x), Math.round(y), 1, 1).data[3] > 50,
      );
    }
    function pickMark(x, y) {
      for (let i = state.marks.length - 1; i >= 0; i--) {
        const m = state.marks[i],
          b = e.bounds(m.sprite);
        if (
          b &&
          x >= m.x + b.x &&
          x <= m.x + b.x + b.w &&
          y >= m.y + b.y &&
          y <= m.y + b.y + b.h
        )
          return i;
      }
      return -1;
    }
    const place = (x, y) => {
      if (x < 350 || x > 795 || y < 10 || y > 515) return;
      const hit = pickMark(x, y);
      if (state.erase) {
        remember();
        if (hit >= 0) state.marks.splice(hit, 1);
        else if (window) {
          const at = nearestSpot(x, y);
          state.slots[at] = null;
        } else {
          const part = pickRegion(x, y);
          if (part) delete state.fills[part];
        }
        update();
        return;
      }
      if (state.move) {
        if (hit >= 0) {
          remember();
          drag = {
            mark: hit,
            dx: x - state.marks[hit].x,
            dy: y - state.marks[hit].y,
          };
        } else if (window) {
          const at = nearestSpot(x, y);
          if (state.slots[at]) {
            remember();
            drag = { slot: at };
          }
        }
        return;
      }
      const tool = state.tool;
      if (!tool) return g.text("Choose a fabric or decoration first.");
      remember();
      if (state.tab === "Fabrics") {
        const part = pickRegion(x, y);
        if (part) {
          state.fills[part] = tool.sprite;
          state.selectedPart = regions.indexOf(part);
        }
      } else if (window && state.tab === "Clothes") {
        const at = nearestSpot(x, y);
        state.slots[at] = tool.sprite;
      } else {
        state.marks.push({ ...tool, kind: state.tab, x, y });
        if (state.tab === "Trims") drag = { trim: true, lastX: x, lastY: y };
      }
      update();
    };
    function nearestSpot(x, y) {
      return spots.reduce(
        (best, s, i) =>
          Math.hypot(x - s.LOCX, y - s.LOCY) <
          Math.hypot(x - spots[best].LOCX, y - spots[best].LOCY)
            ? i
            : best,
        0,
      );
    }
    const wrap = document.querySelector("#stage");
    const move = (ev) => {
      if (!drag) return;
      const r = wrap.getBoundingClientRect(),
        x = ((ev.clientX - r.left) * 800) / r.width,
        y = ((ev.clientY - r.top) * 600) / r.height;
      if (x < 350 || x > 792 || y < 10 || y > 515) return;
      if (drag.mark !== undefined) {
        state.marks[drag.mark].x = x - drag.dx;
        state.marks[drag.mark].y = y - drag.dy;
      } else if (drag.trim && Math.hypot(x - drag.lastX, y - drag.lastY) > 14) {
        state.marks.push({ ...state.tool, kind: "Trims", x, y });
        drag.lastX = x;
        drag.lastY = y;
      }
      buildLayer();
    };
    const up = (ev) => {
      if (drag?.slot !== undefined) {
        const r = wrap.getBoundingClientRect(),
          x = ((ev.clientX - r.left) * 800) / r.width,
          y = ((ev.clientY - r.top) * 600) / r.height,
          at = nearestSpot(x, y),
          old = state.slots[at];
        state.slots[at] = state.slots[drag.slot];
        state.slots[drag.slot] = old;
      }
      if (drag) {
        drag = null;
        update();
      }
    };
    g.designCleanup?.();
    wrap.addEventListener("pointermove", move);
    wrap.addEventListener("pointerup", up);
    wrap.addEventListener("pointercancel", up);
    g.designCleanup = () => {
      wrap.style.cursor = "default";
      wrap.removeEventListener("pointermove", move);
      wrap.removeEventListener("pointerup", up);
      wrap.removeEventListener("pointercancel", up);
    };
    g.pointer = (x, y, ev) => {
      place(x, y);
      if (drag) wrap.setPointerCapture(ev.pointerId);
    };
    g.currentRender = () => {
      wrap.style.cursor = state.move ? "move" : e.cursor(state.erase ? "AniWdEraserCur" : state.tool ? (state.tab === "Fabrics" ? "AniCdSwatchCur" : state.tool.sprite) : null, "Still");
      e.background(g.background(scene));
      e.ctx.drawImage(layer, 0, 0);
      const tabs = window ? { Clothes: "AniWdTab02", "Letters & stamps": "AniWdTab01", Trims: "AniWdTab03" }
        : { Fabrics: "AniCdTab04", Fasteners: "AniCdTab01", Stamps: "AniCdTab02", Trims: "AniCdTab03" };
      for (const [tab, sprite] of Object.entries(tabs)) e.draw(sprite, state.tab === tab ? "Down" : "Up", {
        action: () => { state.tab = tab; state.tool = null; state.erase = false; state.move = false; state.uiPage = 0; g.save(); panel(); }, label: tab,
      });
      const inventory = inventories[state.tab], pages = Math.ceil(inventory.length / 12), page = Math.min(state.uiPage || 0, pages - 1);
      inventory.slice(page * 12, page * 12 + 12).forEach((tool, i) => e.draw(tool.icon, "Still", {
        fit: [14 + (i % 3) * (window ? 91 : 107), 88 + Math.floor(i / 3) * 88, window ? 80 : 94, 78],
        action: () => { state.tool = tool; state.erase = false; state.move = false; g.save(); panel(); },
        label: `${state.tab} ${page * 12 + i + 1}`, id: `inventory-${i}`,
      }));
      const code = window ? "Wd" : "Cd";
      e.button(`Btn${code}ArrowL`, "Previous materials", () => { state.uiPage = (page + pages - 1) % pages; });
      e.button(`Btn${code}ArrowR`, "Next materials", () => { state.uiPage = (page + 1) % pages; });
      e.draw(`Btn${code}Eraser`, state.erase ? "Down" : "Up", { action: () => { state.erase = !state.erase; state.move = false; panel(); }, label: "Eraser" });
      g.ink("undo", window ? 57 : 77, window ? 480 : 467, 58, 29, () => {
        const last = state.undo.pop(); if (last) { Object.assign(state, JSON.parse(last)); g.save(); setup(); }
      }, {size: 15});
      g.ink("move", window ? 177 : 211, window ? 480 : 467, 60, 29, () => { state.move = !state.move; state.erase = false; panel(); }, {size: 15});
      if (!window) e.button("BtnCdArrowDraw", "Next sketch", () => {
        const all = g.r("DctScDesignIdx"), index = all.findIndex(d => d.DESIGNDICT === state.design);
        remember(); state.design = all[(index + 1) % all.length].DESIGNDICT; state.fills = {}; state.marks = []; g.save(); setup();
      });
      if (window && state.tab === "Clothes") spots.forEach((spot, i) => e.hit(`window-spot-${i}`, `Spot ${i + 1}`,
        {x:spot.LOCX - 50, y:spot.LOCY, w:100, h:100}, () => place(spot.LOCX, spot.LOCY + 45)));
      if (!window) {
        const bounds = e.bounds(overlay);
        if (bounds)
          e.hit(
            "design-sketch",
            "Fashion sketch",
            { x: bounds.x, y: bounds.y, w: 0, h: 0 },
            () => {},
          );
      }
      e.button(window ? "BtnWdDone" : "BtnCdDone", "Finish design", submit);
    };
    function exportImage() {
      const output = canvas(),
        c = output.getContext("2d");
      c.fillStyle = "#fff";
      c.fillRect(0, 0, 800, 600);
      if (window) {
        const bg = e.cache.get(g.background(scene));
        if (bg) c.drawImage(bg, 0, 0);
      }
      c.drawImage(layer, 0, 0);
      const crop = document.createElement("canvas");
      crop.width = window ? 440 : 400;
      crop.height = 515;
      crop
        .getContext("2d")
        .drawImage(
          output,
          window ? 350 : 357,
          0,
          crop.width,
          515,
          0,
          0,
          crop.width,
          515,
        );
      return crop.toDataURL("image/webp", 0.95);
    }
    function saveCreation() {
      const source = exportImage(),
        item = {
          id: crypto.randomUUID(),
          type: window ? "window" : "clothes",
          src: source,
          caption: `${window ? "Window display" : "Fashion design"} · Weekend ${g.p.week}`,
          week: g.p.week,
          state: structuredClone({ ...state, undo: [] }),
        };
      g.p.designs.push(item);
      if (window) g.p.latestWindow = source;
      g.save();
      g.text("Saved to your scrapbook.");
      return item;
    }
    let completing = false;
    async function submit() {
      if (completing) return;
      const problems = window
        ? validateWindow(brief, state)
        : validateClothes(brief, state, regions);
      if (problems.length) {
        const p = g.modal(
          "Let’s make a few changes",
          `<p class="paper">${esc(plain(brief.POST_TEXT))}</p><ul>${problems.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`,
        );
        g.btn("Keep designing", () => g.close(), p, "primary");
        g.voice(
          window ? "VocWdVO" : "VocCdVO",
          window ? "NotSoGood" : "FeedbackWrong",
        );
        return;
      }
      const signature = snapshot({
        brief: state.brief,
        design: state.design,
        fills: state.fills,
        slots: state.slots,
        marks: state.marks,
      });
      if (!state.paid.includes(signature)) {
        state.paid.push(signature);
        g.p.money += 40;
        g.progress.jobs[briefs[state.brief]] =
          (g.progress.jobs[briefs[state.brief]] || 0) + 1;
        saveCreation();
      }
      g.save();
      completing = true;
      const profile = g.p;
      await waitForVoice(g.voice(window ? "VocWdVO" : "VocCdVO", window ? "Good" : "FeedbackGood"));
      completing = false;
      if (g.p === profile && g.scene === scene) {
        state.brief = (state.brief + 1) % briefs.length;
        state.tab = window ? "Clothes" : "Fabrics";
        state.fills = {}; state.marks = []; state.slots = Array(6).fill(null);
        state.undo = []; state.tool = null; state.selectedPart = 0;
        g.save();
        await g.street(g.p.area);
      }
    }
    function panel() {
      g.ui.brief = () => {
        const p = g.note("Your design brief", brief.POST_TEXT);
        g.btn("Save this design", () => saveCreation(), p);
        g.btn("Print this design", () => g.printImage(exportImage(), "My Scene design"), p);
        g.btn("Next brief", () => { state.brief = (state.brief + 1) % briefs.length; g.close(); design(window); }, p);
      };
      const p = g.panel(
        window ? "Glassy Fashions" : "The Design Lab",
        `<p class="paper">${esc(plain(brief.POST_TEXT))}</p>`,
        "Creative job · earn $40",
      );
      g.ui.help = window
        ? "Choose clothing and click a display spot. Add letters, stamps and trims anywhere in the window. Drag to run a trim, or choose Move or Erase to revise. Complete the brief to earn $40."
        : "Choose a sketch and fabric, then click inside a garment section to fill its shape. Add buttons, stamps and trims. Drag to run a trim, or choose Move or Erase to revise. Complete the brief to earn $40.";
      const jobs = g.group(p, "row");
      briefs.forEach((_, i) =>
        g.btn(
          `Brief ${i + 1}`,
          () => {
            state.brief = i;
            g.save();
            design(window);
          },
          jobs,
          i === state.brief ? "selected" : "",
        ),
      );
      if (!window) {
        const label = document.createElement("label");
        label.className = "field spaced";
        label.textContent = "Sketch";
        const select = document.createElement("select");
        g.r("DctScDesignIdx").forEach(({ DESIGNDICT }, i) => {
          const op = document.createElement("option");
          op.value = DESIGNDICT;
          op.textContent = `Sketch ${i + 1}${brief.DESIGN_LIST?.includes(DESIGNDICT) ? " · this brief" : ""}`;
          op.selected = DESIGNDICT === state.design;
          select.append(op);
        });
        select.onchange = () => {
          remember();
          state.design = select.value;
          state.fills = {};
          state.marks = [];
          state.selectedPart = 0;
          g.save();
          setup();
        };
        label.append(select);
        p.append(label);
      }
      const tabs = g.group(p, "tabs spaced");
      for (const tab of Object.keys(inventories))
        g.btn(
          tab,
          () => {
            state.tab = tab;
            state.erase = false;
            state.move = false;
            state.tool = null;
            g.save();
            panel();
          },
          tabs,
          state.tab === tab ? "selected" : "",
        );
      const tools = g.group(p, "row");
      g.btn(
        "Move",
        () => {
          state.move = !state.move;
          state.erase = false;
          panel();
        },
        tools,
        state.move ? "selected" : "",
      );
      g.btn(
        "Eraser",
        () => {
          state.erase = !state.erase;
          state.move = false;
          panel();
        },
        tools,
        state.erase ? "selected" : "",
      );
      g.btn(
        "Undo",
        () => {
          const last = state.undo.pop();
          if (last) {
            Object.assign(state, JSON.parse(last));
            g.save();
            setup();
          }
        },
        tools,
      );
      const inv = g.group(p, "design-inventory");
      g.grid(
        inventories[state.tab].map((it, i) => ({
          sprite: it.icon,
          label: `${state.tab} ${i + 1}`,
        })),
        (_, i) => {
          state.tool = inventories[state.tab][i];
          state.erase = false;
          state.move = false;
          g.save();
          g.text("Click your design to use it.");
        },
        inv,
        state.tool?.icon,
      );
      if (!window) {
        const keyboard = g.group(p, "field spaced");
        const select = document.createElement("select");
        select.setAttribute("aria-label", "Garment section");
        regions.forEach((_, i) => {
          const op = document.createElement("option");
          op.value = i;
          op.textContent = `Section ${i + 1}${state.fills[regions[i]] ? " · filled" : ""}`;
          select.append(op);
        });
        select.value = state.selectedPart;
        select.onchange = () => (state.selectedPart = +select.value);
        keyboard.append(select);
        g.btn(
          "Fill selected section",
          () => {
            if (state.tab !== "Fabrics" || !state.tool)
              return g.text("Choose a fabric first.");
            remember();
            state.fills[regions[state.selectedPart]] = state.tool.sprite;
            update();
            panel();
          },
          keyboard,
        );
      } else {
        const places = g.group(p, "row spaced");
        spots.forEach((_, i) =>
          g.btn(
            `Spot ${i + 1}`,
            () => {
              if (state.erase) {
                remember();
                state.slots[i] = null;
                update();
              } else if (state.tool && state.tab === "Clothes") {
                remember();
                state.slots[i] = state.tool.sprite;
                update();
              }
            },
            places,
          ),
        );
      }
      if (state.tab !== "Fabrics" && state.tab !== "Clothes")
        g.btn("Place decoration in center", () => place(570, 300), g.group(p));
      const action = g.group(p, "stack spaced");
      g.btn("Done · check my work", submit, action, "primary");
      g.btn("Save to scrapbook", saveCreation, action);
      g.btn(
        "Download picture",
        async () =>
          g.download(
            await (await fetch(exportImage())).blob(),
            "my-scene-design.webp",
            "image/webp",
          ),
        action,
      );
      g.btn("Print design", () => g.printImage(exportImage()), action);
      g.btn("Back outside", () => g.street(g.p.area), action);
    }
    if (!await setup()) return;
    g.voice(window ? "SndWdAmbient" : "SndCdAmbient", undefined, {
      loop: true,
      channel: "ambient",
      gain: 0.2,
    });
    const voice = window ? "VocWdVO" : "VocCdVO";
    const first = firstVisit(g, scene);
    const previous = (g.p.lessonBriefs ||= {}), current = briefs[state.brief % briefs.length];
    const comment = `Comment${g.pre === "Che" ? "Chel" : g.pre}`;
    const newBrief = previous[scene] && previous[scene] !== current;
    const intro = first ? "Intro" : newBrief && g.sound.key(voice,comment) ? comment : window ? "RtnIntroWork" : "ReturnIntro";
    previous[scene] = current;
    speakSequence(g, [[voice,intro]]);
    g.save();
  }

  async function music() {
    const scene = "ScMmMusMix",
      briefs = g.week.MUSIC_MIX,
      state = g.activity(scene, {
        brief: 0,
        mode: "mix",
        selections: Array.from({ length: 4 }, () =>
          Math.floor(Math.random() * 4),
        ),
        recording: null,
        paid: [],
      }),
      brief = g.d(briefs[state.brief]),
      options = rows(brief),
      params = g.d("DctMusicMixParams"),
      staff = g.r("DctStaffDef"),
      labels = ["Drums", "Bass", "Backing", "Melody"];
    let playing = false,
      recording = false,
      start = 0,
      events = [],
      playbackSource = null,
      timer;
    const saveRecording = () => {
      const saved = g.p.designs.find(d => d.id === state.savedMix);
      if (saved && state.recording) saved.recording = structuredClone(state.recording);
      g.save();
    };
    g.musicCleanup?.();
    g.musicCleanup = () => {
      clearTimeout(timer);
      try { playbackSource?.stop(); } catch {}
      if (recording) {
        state.recording = {
          duration: Math.max(1, (performance.now() - start) / 1000),
          events,
        };
        saveRecording();
      }
      recording = false;
      playing = false;
      g.sound.stopMix();
    };
    const tracks = () =>
      state.selections.map((choice, i) => options[choice][`KNOB${i + 1}`]);
    const play = async (forRecording = false) => {
      g.sound.stopAmbient();
      if (playing) return;
      if (forRecording !== true && state.mode === "effects" && state.recording) {
        playbackSource = await g.playRecording(state.recording);
        playing = true;
        playbackSource.addEventListener("ended", () => {
          playing = false;
          if (g.scene === scene) panel();
        }, {once:true});
        panel();
        return;
      }
      await g.sound.mix(tracks());
      playing = true;
      start = performance.now();
      panel();
    };
    const stop = () => {
      try { playbackSource?.stop(); } catch {}
      playbackSource = null;
      g.sound.stopMix();
      playing = false;
      if (recording) {
        recording = false;
        clearTimeout(timer);
        state.recording = {
          duration: Math.max(1, (performance.now() - start) / 1000),
          events,
        };
        saveRecording();
        g.text("Recording saved. Play it back or export a WAV file.");
      }
      panel();
    };
    const change = (knob, choice) => {
      state.mode = "mix";
      state.selections[knob] = choice;
      if (recording)
        events.push({
          time: (performance.now() - start) / 1000,
          tracks: tracks(),
        });
      if (playing)
        g.sound.mix(tracks(), { offset: (performance.now() - start) / 1000 });
      g.save();
      panel();
    };
    const stab = (item) => {
      if (state.mode !== "effects") return;
      g.voice(item.SND, undefined, { channel: "effect", gain: 0.6 });
      if (recording)
        events.push({
          time: (performance.now() - start) / 1000,
          pad: item.SND,
        });
    };
    const record = async () => {
      if (state.mode !== "effects") return;
      if (recording) return stop();
      g.sound.stopMix();
      playing = false;
      await play(true);
      recording = true;
      state.mode = "effects";
      start = performance.now();
      events = [{ time: 0, tracks: tracks() }];
      timer = setTimeout(() => {
        if (recording) stop();
      }, 60000);
      panel();
    };
    let submitting = false;
    const submit = async () => {
      if (submitting) return;
      if (state.mode === "effects") {
        submitting = true;
        const profile = g.p;
        stop();
        await leaveAfterVoice(g, [["VocMmJezVO","PosFeedback01"]]);
        if (g.p !== profile) return;
        state.brief = (state.brief + 1) % briefs.length;
        state.mode = "mix"; state.recording = null; state.savedMix = null;
        g.save(); return;
      }
      const correct = validateMusic(brief, state.selections);
      if (!correct.every(Boolean)) {
        speakSequence(g, [[`VocMmVO${g.pre === "Che" ? "Chel" : g.pre}`,oneOf(["NegFeedback01","NegFeedback02","NegFeedback03"])],["VocMmJezVO", "Wrong02"]]);
        return g.text(
          `${correct.filter(Boolean).length}/4 instruments match. Listen to the reference and audition the other choices.`,
        );
      }
      const signature = snapshot({
        brief: state.brief,
        selections: state.selections,
        recording: state.recording,
      });
      if (!state.paid.includes(signature)) {
        state.paid.push(signature);
        g.p.money += 40;
        g.progress.jobs[briefs[state.brief]] =
          (g.progress.jobs[briefs[state.brief]] || 0) + 1;
        state.savedMix = crypto.randomUUID();
        g.p.designs.push({
          id: state.savedMix,
          type: "music",
          caption: `My mix · Weekend ${g.p.week}, brief ${state.brief + 1}`,
          week: g.p.week,
          recording: state.recording || {
            duration: 24,
            events: [{ time: 0, tracks: tracks() }],
          },
        });
      }
      g.save();
      state.mode = "effects";
      speakSequence(g, [[`VocMmVO${g.pre === "Che" ? "Chel" : g.pre}`,oneOf(["PosFeedback01","PosFeedback02","PosFeedback03"])],
        ["VocMmJezVO","Correct01"],["VocMmJezVO","Pt02MixIntro"]],()=>state.mode === "effects");
      g.save();
      panel();
    };
    if (!await g.prepare([
      g.background(scene),
      g.blob("BlobMmMusicMix01"),
      g.blob("BlobMmMusicMix02"),
      ...g.data.scenes[scene].SPRITES.filter((n) => !n.startsWith("Snd")),
    ])) return;
    g.currentRender = (t) => {
      const effects = state.mode === "effects";
      e.background(g.blob(effects ? "BlobMmMusicMix02" : "BlobMmMusicMix01"));
      e.draw(
        effects ? "AniMmVisualization02" : "AniMmVisualization01",
        playing ? "Play" : "Still",
        { time: t },
      );
      if (effects) {
        for (const item of staff)
          e.button(item.BTN, g.itemLabel(item.SND), () => stab(item));
        e.draw("AniMmIndicator", "Still", {
          dx: recording
            ? Math.min(362, ((performance.now() - start) / 60000) * 362)
            : 0,
        });
      } else {
        for (const [i, name] of [
          "DRUMS",
          "BASS",
          "BACKUP",
          "MELODY",
        ].entries()) {
          for (const [choice, row] of g.r("DctMmButtons").entries())
            e.draw(row[name], state.selections[i] === choice ? "Down" : "Up", {
              action: () => change(i, choice),
              label: `${labels[i]} option ${choice + 1}`,
            });
          e.button(
            g.d("DctMmButtons").PLAY_BTN[i],
            `Audition ${labels[i].toLowerCase()}`,
            () => g.voice(tracks()[i], undefined, { channel: "sample" }),
          );
          e.draw(g.d("DctMmButtons").GREEN_LIGHT[i], playing ? "On" : "Off");
          e.draw(g.d("DctMmButtons").RED_LIGHT[i], "Off");
        }
      }
      for (const [name, label, fn] of [
        ["BtnMmPlay", "Play mix", play],
        ["BtnMmStop", "Stop mix", stop],
        ["BtnMmRecord", "Record mix", record],
        ["BtnMmDone", effects ? "Finish recording" : "Check mix", submit],
      ])
        if (name !== "BtnMmRecord" || effects) e.button(name, label, fn);
      if (!effects) e.button(params.SAMPLE_PLAY_BTN, "Listen to reference", () => g.voice(brief.WAVE, undefined, {channel:"sample"}));
      e.hit("reference-video", "Watch reference", {x: 662, y: 100, w: 120, h: 300}, () => g.movie(brief.SMACKER));
    };

    function panel() {
      g.ui.brief = () => {
        const p = g.note("Making Trax", brief.INSTRUCT);
        g.btn("Listen to the reference", () => g.voice(brief.WAVE, undefined, {channel:"sample"}), p);
        g.btn("Watch reference", () => {g.close(); g.movie(brief.SMACKER);}, p);
        if (state.recording) {
          g.btn("Play recording", () => g.playRecording(state.recording), p);
          g.btn("Export WAV", () => g.exportRecording(state.recording), p);
        }
        g.btn("Next brief", () => {stop(); state.brief = (state.brief + 1) % briefs.length; state.mode = "mix"; state.recording = null; state.savedMix = null; g.save(); g.close(); music();}, p);
      };
      const p = g.panel(
        "Making Trax",
        `<p class="paper">${esc(plain(brief.INSTRUCT))}</p>`,
        "Music studio · earn $40",
      );
      g.ui.help =
        "Match the reference track by choosing one of four samples for each instrument. Play them together, add effect pads, and record your performance. Stop saves the take; Export WAV makes a sound file.";
      const jobs = g.group(p, "tabs");
      briefs.forEach((_, i) =>
        g.btn(
          `Brief ${i + 1}`,
          () => {
            stop();
            state.brief = i;
            state.mode = "mix";
            state.recording = null;
            state.savedMix = null;
            g.save();
            music();
          },
          jobs,
          i === state.brief ? "selected" : "",
        ),
      );
      const refs = g.group(p, "row");
      g.btn(
        "▶ Reference track",
        () => g.voice(brief.WAVE, undefined, { channel: "sample" }),
        refs,
      );
      g.btn("Watch reference", () => g.movie(brief.SMACKER), refs);
      for (let i = 0; state.mode !== "effects" && i < 4; i++) {
        const label = document.createElement("label");
        label.className = "field spaced";
        label.textContent = labels[i];
        const select = document.createElement("select");
        for (let c = 0; c < options.length; c++) {
          const op = document.createElement("option");
          op.value = c;
          op.textContent = `Sample ${c + 1}`;
          select.append(op);
        }
        select.value = state.selections[i];
        select.onchange = () => change(i, +select.value);
        label.append(select);
        p.append(label);
        g.btn(
          `Audition ${labels[i].toLowerCase()}`,
          () => g.voice(tracks()[i], undefined, { channel: "sample" }),
          p,
        );
      }
      const transport = g.group(p, "row spaced");
      g.btn(playing ? "Playing…" : "▶ Play", play, transport);
      g.btn("■ Stop", stop, transport);
      if (state.mode === "effects") g.btn(
        recording ? "● Recording · stop" : "● Record",
        record,
        transport,
        recording ? "selected" : "",
      );
      const pads = g.group(p, "grid spaced");
      for (const [i, item] of (state.mode === "effects" ? staff : []).entries())
        g.btn(`Pad ${i + 1}`, () => stab(item), pads);
      if (state.recording) {
        const rec = g.group(p, "row spaced");
        g.btn("Play recording", () => g.playRecording(state.recording), rec);
        g.btn("Export WAV", () => g.exportRecording(state.recording), rec);
      }
      const a = g.group(p);
      g.btn(state.mode === "effects" ? "Done · finish recording" : "Done · check my mix", submit, a, "primary");
      g.btn(
        "Back outside",
        () => {
          stop();
          g.street(g.p.area);
        },
        a,
      );
    }
    panel();
    const first = firstVisit(g, scene);
    speakSequence(g, state.mode === "effects"
      ? [[`VocMmVO${g.pre === "Che" ? "Chel" : g.pre}`,"Pt02Intro01"]]
      : [["VocMmJezVO",first ? "Pt01Intro" : "ReturnIntro01"]]);
    g.save();
  }
  g.renderRecording = async (recording) => {
    const names = [
        ...new Set(recording.events.flatMap((e) => e.tracks || [e.pad])),
      ].filter(Boolean),
      buffers = new Map(
        await Promise.all(names.map(async (n) => [n, await g.sound.buffer(n)])),
      );
    const duration = Math.min(60, Math.max(1, recording.duration)),
      offline = new OfflineAudioContext(2, Math.ceil(duration * 44100), 44100);
    for (const [i, event] of recording.events.entries()) {
      if (event.time >= duration) continue;
      if (event.tracks) {
        const next =
          recording.events.slice(i + 1).find((e) => e.tracks)?.time || duration;
        for (const n of event.tracks) {
          const buffer = buffers.get(n);
          if (!buffer) continue;
          const s = offline.createBufferSource(),
            gain = offline.createGain();
          s.buffer = buffer;
          s.loop = true;
          gain.gain.value = 0.25;
          s.connect(gain).connect(offline.destination);
          s.start(event.time, event.time % buffer.duration);
          s.stop(Math.min(duration, next));
        }
      } else if (event.pad && buffers.get(event.pad)) {
        const s = offline.createBufferSource(),
          gain = offline.createGain();
        s.buffer = buffers.get(event.pad);
        gain.gain.value = 0.45;
        s.connect(gain).connect(offline.destination);
        s.start(event.time);
      }
    }
    return offline.startRendering();
  };
  g.playRecording = async (recording) => {
    g.sound.stopMix();
    g.sound.stopVoice();
    const buffer = await g.renderRecording(recording);
    await g.sound.activate();
    const s = g.sound.context.createBufferSource();
    s.buffer = buffer;
    s.connect(g.sound.master);
    s.start();
    g.sound.voice = s;
    g.text("Playing your recorded mix.");
    return s;
  };
  g.exportRecording = async (recording) => {
    g.text("Preparing your WAV file…");
    g.download(
      wav(await g.renderRecording(recording)),
      "my-scene-mix.wav",
      "audio/wav",
    );
    g.text("Your mix is ready.");
  };
  g.handlers.ScCdClothesDes = () => design(false);
  g.handlers.ScWdWinDress = () => design(true);
  g.handlers.ScMmMusMix = music;
}
