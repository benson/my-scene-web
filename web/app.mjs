import { Engine, Sound, rows, pad, plain, esc } from "./engine.mjs";
import { installShops } from "./shops.mjs";
import { installCreative } from "./creative.mjs";
import { installExtras } from "./extras.mjs";
import { installNativeUI } from "./native-ui.mjs";
import { helpContext, installFidelity } from "./fidelity.mjs";
import { installSignIn } from "./signin.mjs";
import { installStory } from "./story.mjs";

export const names = {
  ScBaBarApt: "Apartment",
  ScClClothesUe: "Très Chic",
  ScClClothesVil: "Urban Threads",
  ScClClothesDt: "Digs",
  ScAcAccess: "Angel Accessories",
  ScMuMakeUp: "The Glamour Shop",
  ScGtGift: "Tiff’s",
  ScFdFood: "Village Depot",
  ScCsCDShop: "CD Store",
  ScCdClothesDes: "Design Lab",
  ScWdWinDress: "Glassy Fashions",
  ScMmMusMix: "Making Trax",
  ScFirestation: "Old Firestation",
  ScParkCafe: "Park Café",
  Sc11c: "Restaurant",
};
export const areas = [
  "",
  "Upper East Side",
  "The Village",
  "Downtown",
  "Parkside",
];
const $ = (s) => document.querySelector(s);
const request = (req) =>
  new Promise((ok, no) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => no(req.error);
  });
class Saves {
  async open() {
    const r = indexedDB.open("my-scene-browser", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("profiles", { keyPath: "id" });
    this.db = await request(r);
  }
  async all() {
    return request(
      this.db.transaction("profiles").objectStore("profiles").getAll(),
    );
  }
  async put(p) {
    const tx = this.db.transaction("profiles", "readwrite");
    tx.objectStore("profiles").put(structuredClone(p));
    return new Promise((ok, no) => {
      tx.oncomplete = ok;
      tx.onerror = () => no(tx.error);
    });
  }
  async delete(id) {
    const tx = this.db.transaction("profiles", "readwrite");
    tx.objectStore("profiles").delete(id);
    return new Promise((ok, no) => {
      tx.oncomplete = ok;
      tx.onerror = () => no(tx.error);
    });
  }
}
export class Game {
  constructor(data) {
    this.data = data;
    this.e = new Engine(data, $("#stage"), $("#hotspots"));
    this.sound = new Sound(data);
    this.saves = new Saves();
    this.p = null;
    this.handlers = {};
    this.ui = {};
    this.keys = new Set();
    this.animations = new Map();
    this.loadToken = 0;
    this.lastInput = performance.now();
    this.scene = "signin";
    this.currentRender = () => {};
    this.e.render = (t, dt) => {
      this.currentRender(t, dt);
      if (this.p) this.toolbar();
    };
    $("#stage-wrap").addEventListener("pointermove", ev => {
      const box = $("#stage").getBoundingClientRect();
      this.pointerPosition = { x: (ev.clientX - box.left) * 800 / box.width, y: (ev.clientY - box.top) * 600 / box.height };
    });
  }
  d(name) {
    return this.data.dictionaries[name] || {};
  }
  r(name) {
    return rows(this.d(name));
  }
  get week() {
    return this.d(`DctTaskWk${pad(this.p?.week || 1)}`);
  }
  get doll() {
    return this.d(this.debugDoll || this.week.DOLL_DICT);
  }
  get character() {
    return ["Barbie", "Chelsea", "Madison"][this.doll.DOLL_IDX || 0];
  }
  get pre() {
    return ["Bar", "Che", "Mad"][this.doll.DOLL_IDX || 0];
  }
  get tasks() {
    return rows(this.week);
  }
  get progress() {
    return (this.p.weeks[this.p.week] ||= {
      done: [],
      bought: [],
      jobs: {},
      calls: [],
      guess: {},
    });
  }
  get complete() {
    return this.tasks.every((_, i) => this.progress.done.includes(i));
  }
  text(message) {
    $("#status").textContent = plain(message);
    clearTimeout(this.statusTimer);
    this.statusTimer = setTimeout(() => { $("#status").textContent = ""; }, 6500);
  }
  async voice(name, fx, opts) {
    try {
      const resolved = /^VocCl(Barbie|Chelsea|Madison)VO$/.test(name)
        ? name.replace("VocCl", "AniCl").replace("VO", "Talk01")
        : name;
      const source = await this.sound.play(resolved, fx, opts);
      const cues = this.data.sprites[resolved]?.effects[fx]?.properties.CUELIST || [];
      for (let i = 0; source && i < cues.length; i += 3) {
        const cue = String(cues[i+2]).match(/^(.+)_(Highlight|Flash|Down)_(\d+)_(\w+)$/);
        if (cue && this.data.sprites[cue[1]]?.effects[cue[2]])
          this.e.cues?.set(cue[1], {source,fx:cue[2],start:source.context.currentTime + cues[i+1]/1000,duration:+cue[3]/1000});
      }
      if (source && this.data.sprites[resolved]?.effects[fx]?.image)
        this.speech = { name: resolved, fx, at: this.e.clock };
      return source;
    } catch {
      this.text("Sound could not load. The game is still ready to play.");
    }
  }
  drawSpeaking(name) {
    const speech = this.speech,
      fx = speech?.name === name ? this.e.effect(name, speech.fx) : null,
      active = fx && this.e.clock - speech.at < fx.frames.length * fx.delay;
    this.e.draw(name, active ? speech.fx : "Still", {
      time: active ? this.e.clock - speech.at : 0,
      loop: false,
    });
  }
  say(fx, name = "VocZzCellMessages") {
    return this.voice(name, fx);
  }
  background(scene) {
    const s = this.data.scenes[scene];
    return s?.BACKGROUND ? `${s.archive}:${s.BACKGROUND}` : null;
  }
  blob(name) {
    const b = this.data.blobs[name];
    return b ? `${b.archive}:${b.RESOURCE}` : null;
  }
  async prepare(keys) {
    const token = ++this.loadToken,
      loading = $("#loading");
    loading.hidden = false;
    loading.innerHTML = "Opening your world…<progress></progress>";
    let failed = false;
    try {
      await this.e.preload(keys.filter(Boolean));
      return token === this.loadToken;
    } catch (error) {
      failed = true;
      if (token === this.loadToken) {
        loading.innerHTML =
          '<p>Some artwork could not load.</p><button id="retry-loading">Reload game</button>';
        loading.querySelector("button").onclick = () => location.reload();
        this.text(error.message);
      }
      return false;
    } finally {
      if (token === this.loadToken && !failed) loading.hidden = true;
    }
  }

  panel(title, body = "", eyebrow = "") {
    const p = $("#panel");
    p.innerHTML = `${eyebrow ? `<div class="eyebrow">${esc(eyebrow)}</div>` : ""}<h1>${esc(title)}</h1>${body}`;
    return p;
  }
  btn(label, fn, parent = $("#panel"), cls = "") {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.className = cls;
    b.onclick = fn;
    parent.append(b);
    return b;
  }
  group(parent = $("#panel"), cls = "stack spaced") {
    const el = document.createElement("div");
    el.className = cls;
    parent.append(el);
    return el;
  }
  async grid(items, fn, parent = $("#panel"), selected) {
    const grid = this.group(parent, "grid spaced");
    for (const [i, item] of items.entries()) {
      const name = typeof item === "string" ? item : item.sprite,
        fx = typeof item === "string" ? undefined : item.fx;
      const label =
        typeof item === "string" ? this.itemLabel(name, i) : item.label;
      const b = this.btn(
        label,
        () => fn(item, i),
        grid,
        selected === name ? "selected" : "",
      );
      b.setAttribute("aria-label", label);
      const canvas = await this.e.thumbnail(name, fx);
      b.prepend(canvas);
      if (!grid.isConnected) break;
    }
    return grid;
  }
  itemLabel(name, i = 0) {
    return (
      name
        .replace(/^(Ani|Btn|Snd)[A-Z][a-z]/, "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^Set(\d+)Clothes/, "Collection $1 ")
        .replace(/(\D)(\d+)/g, "$1 $2")
        .trim() || `Item ${i + 1}`
    );
  }
  modal(title, body = "") {
    $("#dialog-body").innerHTML = `<h2>${esc(title)}</h2>${body}`;
    if (!$("#dialog").open) $("#dialog").showModal();
    return $("#dialog-body");
  }
  close() {
    if ($("#dialog").open) $("#dialog").close();
  }
  save() {
    if (!this.p) return;
    this.p.updated = Date.now();
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 150);
    this.header();
  }
  async flush() {
    clearTimeout(this.saveTimer);
    if (this.p)
      try {
        await this.saves.put(this.p);
      } catch {
        this.text(
          "Your browser could not save. Use Save file to keep a backup.",
        );
      }
  }
  header() {
    if (this.p)
      $("#week-label").textContent =
        `${this.p.name} · Weekend ${this.p.week} · ${this.character === "Madison" ? "Westley" : this.character} · $${this.p.money}`;
  }
  activity(key, initial) {
    return (this.p.activities[`${this.p.week}:${key}`] ||=
      structuredClone(initial));
  }
  async start() {
    await this.saves.open();
    installShops(this);
    installCreative(this);
    installExtras(this);
    installNativeUI(this);
    installSignIn(this);
    installFidelity(this);
    installStory(this);
    $("#dialog-close").onclick = () => this.close();
    $("#sound").onclick = () => {
      this.sound.mute(!this.sound.muted);
      $("#sound").textContent = this.sound.muted ? "♫ Sound off" : "♫ Sound on";
      $("#sound").setAttribute(
        "aria-label",
        this.sound.muted ? "Unmute sound" : "Mute sound",
      );
      const video = document.querySelector("#overlay video");
      if (video) video.muted = this.sound.muted;
    };
    $("#fullscreen").onclick = () =>
      document.fullscreenElement
        ? document.exitFullscreen()
        : $("#shell").requestFullscreen();
    document.addEventListener(
      "pointerdown",
      () => {
        this.lastInput = performance.now();
        this.sound.activate().then(() => {
          const video = $("#overlay video");
          if (video) { video.muted = this.sound.muted; if (!video.controls) video.play().catch(() => {}); }
        }).catch(() => {});
      },
      { passive: true },
    );
    document.addEventListener("keydown", (ev) => {
      this.lastInput = performance.now();
      if (ev.key === "F1" && this.p) { ev.preventDefault(); this.help(); return; }
      if (["INPUT", "TEXTAREA", "SELECT"].includes(ev.target.tagName)) return;
      if ($("#dialog").open) return;
      this.keys.add(ev.key);
      if (["ArrowLeft", "ArrowRight"].includes(ev.key)) ev.preventDefault();
      if (ev.key === "Escape" && !$("#dialog").open && this.p)
        this.options();
    });
    document.addEventListener("keyup", (ev) => this.keys.delete(ev.key));
    window.addEventListener("pagehide", () => this.flush());
    $("#stage").addEventListener("pointerdown", (ev) => {
      const r = ev.target.getBoundingClientRect();
      this.pointer?.(
        ((ev.clientX - r.left) * 800) / r.width,
        ((ev.clientY - r.top) * 600) / r.height,
        ev,
      );
    });
    setInterval(() => {
      if (this.p && performance.now() - this.lastInput > 45000) {
        this.help(true);
        this.lastInput = performance.now();
      }
    }, 12000);
    await this.signin();
  }
  async signin() {
    await this.flush();
    this.designCleanup?.();
    this.musicCleanup?.();
    this.p = null;
    this.sound.stopMix();
    this.sound.stopAmbient();
    this.scene = "signin";
    this.pointer = null;
    $("#quick").innerHTML = "";
    $("#week-label").textContent = "Fashion, friends & the big city";
    const profiles = await this.saves.all();
    await this.prepare([
      "SignInMS:1",
      "BtnSiNewGame",
      "BtnSiContinueGame",
      "BtnSiHelp",
      "BtnSiDeleteName",
      "BtnSiExit",
    ]);
    this.currentRender = () => {
      this.e.background("SignInMS:1");
      this.e.button("BtnSiNewGame", "Start a new game", () => {
        const f = document.querySelector("#new-profile");
        f.requestSubmit();
      });
      this.e.button("BtnSiContinueGame", "Continue saved game", () =>
        profiles[0]
          ? this.load(profiles[0])
          : document.querySelector("#new-profile input").focus(),
      );
      this.e.button("BtnSiHelp", "Sign-in help", () =>
        this.signinHelp(),
      );
      this.e.button("BtnSiExit", "Options", () => this.signinOptions());
      this.e.text("my scene", 320, 137, {
        size: 33,
        color: "#9f2591",
        bold: true,
      });
      this.e.text(
        profiles.length ? "Pick your name" : "Welcome, girlfriend!",
        302,
        199,
        { size: 19, maxWidth: 210 },
      );
      profiles.slice(0, 5).forEach((p, i) => {
        this.e.text(p.name, 302, 239 + i * 29, {
          size: 18,
          maxWidth: 215,
          singleLine: true,
        });
        this.e.hit(
          `profile-${i}`,
          `Continue ${p.name}`,
          { x: 300, y: 235 + i * 29, w: 218, h: 28 },
          () => this.load(p),
        );
      });
    };
    const p = this.panel(
      "Make it your scene",
      `<p>Meet the girls. Explore the city. Make some weekend memories.</p><form id="new-profile" class="signin"><label class="field">Your name<input name="name" maxlength="30" autocomplete="off" required placeholder="Sign in here"></label><button class="primary">New game</button></form>`,
    );
    const phoneName = $("#signin-name"),
      sidebarName = p.querySelector("#new-profile input");
    phoneName.value = "";
    phoneName.hidden = false;
    phoneName.oninput = () => { sidebarName.value = phoneName.value; };
    sidebarName.oninput = () => { phoneName.value = sidebarName.value; };
    phoneName.onkeydown = (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        p.querySelector("form").requestSubmit();
      }
    };
    p.querySelector("form").onsubmit = async (ev) => {
      ev.preventDefault();
      const name = new FormData(ev.target).get("name").trim();
      if (!name) return;
      if (profiles.some((p) => p.name.toLowerCase() === name.toLowerCase()))
        return this.text(
          "That name already has a game. Continue below, or use another name.",
        );
      const profile = {
        version: 1,
        id: crypto.randomUUID(),
        name,
        week: 1,
        money: 20,
        weeks: {},
        activities: {},
        designs: [],
        photos: [],
        boys: [],
        quizzes: {},
        jumbles: {},
        area: 3,
        x: 215,
        location: "ScBaBarApt",
        completedWeeks: [],
        created: Date.now(),
      };
      await this.load(profile, true);
    };
    if (profiles.length) {
      const g = this.group(p);
      g.innerHTML = "<h3>Continue a game</h3>";
      for (const profile of profiles.sort((a, b) => b.updated - a.updated)) {
        const row = this.group(g, "profile-row");
        this.btn(
          `${profile.name} · Weekend ${profile.week}`,
          () => this.load(profile),
          row,
        );
        this.btn(
          "×",
          () => {
            const body = this.modal(
              `Delete ${profile.name}?`,
              "<p>This removes this saved game from this browser.</p>",
            );
            this.btn(
              "Delete game",
              async () => {
                await this.saves.delete(profile.id);
                this.close();
                this.signin();
              },
              body,
              "danger",
            );
          },
          row,
        ).setAttribute("aria-label", `Delete ${profile.name}`);
      }
    }
    const more = this.group(p);
    this.btn("Import a saved game", () => this.importSave(), more);
    this.btn("Watch the introduction", () => this.movie("intro"), more);
    this.btn("Credits", () => this.credits(), more);
  }
  async load(profile, isNew = false) {
    this.cancelStory?.();
    this.designCleanup?.(); this.musicCleanup?.();
    $("#signin-name").hidden = true;
    this.p = structuredClone(profile);
    this.header();
    this.quick();
    this.save();
    if (isNew) {
      await this.street(4);
      this.movie("intro", () => this.beginTutorial());
    } else {
      await this.go(this.p.location || "ScBaBarApt", { resume: true });
      if (this.p.recapPending) this.finishWeekend();
      else this.resumeTutorial();
    }
  }
  quick() {
    const q = $("#quick");
    q.innerHTML = "";
    for (const [label, fn] of [
      ["⌖ Map", () => this.map()],
      ["☷ To-do", () => this.todo()],
      ["♧ Phone", () => this.phone()],
      ["▧ Zine", () => this.zine()],
      ["♡ Scrapbook", () => this.scrapbook()],
      ["▣ Camera", () => this.camera()],
      ["♫ Music", () => this.musicLibrary()],
      ["? Help", () => this.help()],
      ["Save & options", () => this.options()],
    ])
      this.btn(label, fn, q);
  }
  toolbar() {
    const e = this.e;
    e.draw("AniZzToolbar");
    for (const [n, label, fn] of [
      ["BtnZzExit", "Leave", () => this.scene === "ScStStreet" ? this.options() : this.street(this.p.area)],
      ["BtnZzHelp", "Help", () => this.help()],
      ["BtnZzMap", "City map", () => this.map()],
      [`BtnZzPhone${this.pre === "Che" ? "Chel" : this.pre}`, "Phone", () => this.phone()],
      ["BtnZzPostIt", this.ui.brief ? "Job brief" : "To-do list", () => this.ui.brief ? this.ui.brief() : this.todo()],
      ["BtnZzWallet", `Wallet: $${this.p.money}`, () => this.wallet()],
    ])
      if (n.startsWith("BtnZzPhone") && (this.p.tutorial === "ringing" || (this.week.PHONE_CALLS || []).some((_, i) => this.progress.done.length >= this.week.PHONE_CALLS_TRIGGER_TASK[i] && !this.progress.heardCalls?.includes(i))))
        e.draw(n, "Ring", { action: fn, label, time: e.clock });
      else e.button(n, label, fn);
    e.text(`$${this.p.money}`, 140, 571, {size: 17, align: "center", color: "#2a4735", bold: true});
  }
  async go(scene, options = {}) {
    this.e.canvas.style.cursor = "default";
    this.ui.brief = null;
    this.close();
    this.pointer = null;
    this.designCleanup?.();
    this.musicCleanup?.();
    this.sound.stopMix();
    this.sound.stopVoice();
    this.scene = scene;
    this.p.location = scene;
    this.save();
    if (scene === "ScStStreet") return this.street(this.p.area);
    if (scene === "ScBaBarApt")
      return this.apartment(options.apartment || this.p.apartment);
    if (this.handlers[scene]) return this.handlers[scene](options);
    return this.destination(scene);
  }
  storeRule(scene) {
    return this.r(this.week.CLOSED_STORE_DICT).find((s) => s.SCENE === scene);
  }
  canEnter(scene) {
    const r = this.storeRule(scene);
    return (
      !r ||
      (r.STATE === 1 &&
        (r.OPEN_AFTER <= 0 || this.progress.done.length >= r.OPEN_AFTER))
    );
  }
  destination(scene, area = this.p.area) {
    if (scene === "ScStStreet") return this.map();
    if (scene === "ScBaBarApt") {
      const apt = { 1: "Madison", 2: "Chelsea", 3: "Barbie" }[area];
      if (
        this.complete &&
        this.week.FINAL_LOCATION === "ScBaBarApt" &&
        this.week.FINAL_LOCATION_ID === area
      )
        return this.finishWeekend();
      return this.apartment(apt);
    }
    if (this.complete && this.week.FINAL_LOCATION === scene)
      return this.finishWeekend();
    if (!this.canEnter(scene)) {
      this.voice(this.doll.STREET_VO, "Closed");
      return this.modal(
        names[scene] || scene,
        "<p>Closed this weekend. Check your to-do list for this weekend’s plans.</p>",
      );
    }
    if (this.handlers[scene]) return this.go(scene);
    if (["ScFirestation", "ScParkCafe", "Sc11c"].includes(scene))
      return this.modal(
        names[scene],
        "<p>The event starts when everything on your to-do list is ready.</p>",
      );
    this.text("This destination could not be opened.");
  }
  async apartment(which = this.character) {
    this.ui.brief = null;
    this.ui.help =
      "Click the scrapbook to look through your memories, try the music player, or click the door to go outside.";
    this.scene = "ScBaBarApt";
    this.p.location = "ScBaBarApt";
    this.p.apartment = which;
    this.apartmentIntro = null;
    this.pointer = null;
    const dict = this.d(
      { Barbie: "DctBarApt", Chelsea: "DctChrApt", Madison: "DctMadApt" }[
        which
      ],
    );
    const bg = this.blob(dict.APT_BG),
      door = dict.DOOR_SPOT;
    await this.prepare([
      bg,
      dict.DOLL,
      door,
      dict.BTN_SCRAPBOOK,
      dict.MUSIC_SP,
    ]);
    this.currentRender = (t) => {
      this.e.background(bg);
      if (this.apartmentIntro) {
        const intro = this.apartmentIntro;
        for (const sprite of intro.sprites)
          this.e.draw(sprite, "Anim", { time: t - intro.start, loop: false });
        if (t - intro.start > intro.duration) this.apartmentIntro = null;
      } else
        this.e.draw(dict.DOLL, "Anim", {
          time: t,
          action: () =>
            this.voice(
              `VocBa${{ Barbie: "Bar", Chelsea: "Chel", Madison: "Mad" }[which]}VO`,
              "Idle",
            ),
          label: `Talk to ${which}`,
          id: "apartment-girl",
        });
      this.e.button(dict.BTN_SCRAPBOOK, "Open scrapbook", () =>
        this.scrapbook(),
      );
      if (dict.MUSIC_SP)
        this.e.button(dict.MUSIC_SP, "Listen to music", () =>
          this.musicLibrary(),
        );
      this.e.draw(door, "Still", {
        action: () => this.street({ Barbie: 3, Chelsea: 2, Madison: 1 }[which]),
        label: "Go outside",
      });
    };
    const display = which === "Madison" ? "Westley" : which;
    const p = this.panel(
      `${display}’s apartment`,
      "<p>Home sweet home. Look through your scrapbook or head out into the city.</p>",
      `Weekend ${this.p.week}`,
    );
    const buttons = this.group(p);
    this.btn(
      "Go outside",
      () => this.street({ Barbie: 3, Chelsea: 2, Madison: 1 }[which]),
      buttons,
      "primary",
    );
    this.btn("Scrapbook", () => this.scrapbook(), buttons);
    this.btn("Weekend plans", () => this.todo(), buttons);
    if (which === this.character)
      this.btn("Play weekend introduction", () => this.weekIntro(), buttons);
    if (this.complete)
      this.btn(
        "Go to the weekend event",
        () => this.finishWeekend(),
        buttons,
        "primary",
      );
    this.voice("SndBaAmbient", undefined, {
      loop: true,
      channel: "ambient",
      gain: 0.3,
    });
    this.voice(
      `VocBa${{ Barbie: "Bar", Chelsea: "Chel", Madison: "Mad" }[which]}VO`,
      dict.APT_INTRO,
    );
    this.save();
  }
  weekIntro() {
    const sprite = this.week.WEEK_INTRO_SP;
    if (sprite && this.data.sprites[sprite]) {
      const stem = sprite.replace(/(Bar|Chel|Mad)$/, ""),
        sprites = Object.keys(this.data.sprites).filter((n) =>
          n.startsWith(stem),
        ),
        duration = Math.max(
          ...sprites.map((n) => {
            const f = this.e.effect(n);
            return (f?.frames.length || 1) * (f?.delay || 100);
          }),
        );
      this.e.preload(sprites);
      this.apartmentIntro = { sprites, start: this.e.clock, duration };
      this.voice(sprite, "Anim");
      this.text(
        `Weekend ${this.p.week} is here! Listen to the girls, then check your weekend plans.`,
      );
    } else {
      this.say(`VocZzWeek${pad(this.p.week)}Call01`);
      this.todo();
    }
  }

  async street(area = 3) {
    this.sound.stopVoice(); this.actorTalking = null;
    this.ui.brief = null;
    this.close();
    this.designCleanup?.();
    this.musicCleanup?.();
    this.pointer = null;
    this.scene = "ScStStreet";
    this.p.location = "ScStStreet";
    const changed = this.p.area !== area;
    this.p.area = area;
    if (changed) this.p.x = area === 4 ? 574 : 1200;
    const world = this.d(
        area === 4 ? "DctStreetPark" : `DctStreetWorld${area}`,
      ),
      items = rows(world);
    this.ui.help =
      "Click the pavement or use the arrow keys to walk. Click doors to enter, people to chat, birds and street details to see what happens. The subway opens the city map.";
    this.world = world;
    this.target = this.p.x || 400;
    const actors = this.r(world.ACTOR_DICT)
      .filter((a) => a.ACTOR !== this.doll.DOLL_SP)
      .map((a, i) => ({
        ...a,
        x: a.STARTX,
        readyAt: this.e.clock + a.DELAY + Math.random() * a.DELAYDX,
        dir: a.ENDX > a.STARTX ? 1 : -1,
        paused: false,
      }));
    this.actors = actors;
    await this.prepare([
      ...items.map((i) => i.SPRITE),
      this.doll.DOLL_SP,
      ...actors.map((a) => a.ACTOR),
      "AniStBirdFlying",
      "AniStCurHeart",
      "AniStSmallArrowIn",
    ]);
    const doorArrow = await this.e.thumbnail("AniStSmallArrowIn", "Highlight", 34, 35);
    const doorCursor = `url("${doorArrow.toDataURL()}") 17 17, pointer`;
    this.voice(world.BG_MUSIC, undefined, {
      loop: true,
      channel: "ambient",
      gain: 0.25,
    });
    this.currentRender = (t, dt) => {
      const cursorX = this.pointerPosition?.x ?? 400;
      const cursorSide = cursorX < this.p.x - (this.cameraX || 0) ? "L" : "R";
      const cursorY = this.pointerPosition?.y ?? 0;
      this.e.canvas.style.cursor = cursorY > 350 && cursorY < 552
        ? this.e.cursor(cursorX < 40 || cursorX > 760 ? `AniStBigArrow${cursorSide}` : `AniStSmallArrow${cursorSide}`, "Highlight") : "default";
      if (this.keys.has("ArrowLeft"))
        this.target = Math.max(50, this.p.x - 130);
      if (this.keys.has("ArrowRight"))
        this.target = Math.min(world.WORLDWIDTH - 50, this.p.x + 130);
      const distance = this.target - this.p.x,
        moving = Math.abs(distance) > 2;
      if (moving && !$("#dialog").open)
        this.p.x +=
          Math.sign(distance) * Math.min(Math.abs(distance), (this.debugWalkSpeed || this.doll.SPEED) * dt);
      const cam = Math.max(0, Math.min(world.WORLDWIDTH - 800, this.p.x - 400));
      this.cameraX = cam;
      for (const [i, it] of items.entries()) {
        if (it.SPRITE.startsWith("Spt")) continue;
        const dx = it.RATE === 0 ? 0 : it.XLOC - cam,
          dy = it.YLOC;
        const extra = this.animations.get(`${area}:${i}`);
        const effects = Object.keys(
          this.data.sprites[it.SPRITE]?.effects || {},
        );
        this.e.draw(it.SPRITE, extra?.fx || effects[0], {
          dx,
          dy,
          time: extra ? t - extra.start : it.TYPE === 6 ? t : 0,
          alpha: extra?.fly ? 0 : 1,
          action:
            it.TYPE === 6 && it.SPRITE.startsWith("Ani")
              ? () => this.incidental(it, area, i)
              : undefined,
          label: this.itemLabel(it.SPRITE),
          id: `detail-${i}`,
        });
        if (extra?.fly) {
          const b = extra.bounds;
          this.e.draw("AniStBirdFlying", "Play", {
            fit: [
              dx + b.x + (t - extra.start) * 0.14,
              dy + b.y - (t - extra.start) * 0.12,
              64,
              55,
            ],
            time: t - extra.start,
          });
          if (t - extra.start > 3500) this.animations.delete(`${area}:${i}`);
        }
      }
      if (this.p.latestWindow) {
        const win = items.find((i) => i.SPRITE === "AniStWdWindow");
        if (win) {
          const im = this.e.cache.get(this.p.latestWindow);
          if (im) this.e.ctx.drawImage(im, win.XLOC - cam, win.YLOC, 210, 191);
          else this.imageData(this.p.latestWindow);
        }
      }
      for (const [i, it] of items.entries()) {
        if (!it.SPRITE.startsWith("Spt")) continue;
        const x = it.XLOC - cam;
        if (it.TYPE === 103 || it.TYPE === 104) {
          this.e.hit(
            `zine-${i}`,
            it.TYPE === 103 ? "Read the Zine" : "Take the personality quiz",
            {
              x: x - 50,
              y: it.YLOC - 150,
              w: it.TYPE === 103 ? 75 : 60,
              h: 140,
            },
            () => (it.TYPE === 103 ? this.zine() : this.quiz()),
          );
          continue;
        }
        const label =
          it.DATYPE === "ScStStreet"
            ? "Subway / city map"
            : it.DATYPE === "ScBaBarApt"
              ? `${{ 1: "Westley", 2: "Chelsea", 3: "Barbie" }[area]}’s apartment`
              : names[it.DATYPE];
        this.e.hit(
          `door-${i}`,
          label,
          { x: x - 44, y: it.YLOC - 148, w: 88, h: 148 },
          () => this.destination(it.DATYPE, area),
          doorCursor,
        );
      }
      for (const a of actors) {
        if (t < a.readyAt) continue;
        const modalOpen = $("#dialog").open;
        if (!a.paused && !modalOpen) a.x += a.dir * a.RATE * dt;
        if ((a.dir > 0 && a.x >= a.ENDX) || (a.dir < 0 && a.x <= a.ENDX)) {
          a.x = a.STARTX;
          a.readyAt = t + a.DELAY + Math.random() * a.DELAYDX;
          a.greeted = a.chatted = a.saidBye = false;
          continue;
        }
        const proximity = Math.abs(a.x - this.p.x), trigger = this.d("DctActorTrigger");
        const voiceFree = !this.actorTalking && (!this.sound.voice || this.sound.voice.ended);
        if (!modalOpen && voiceFree && !a.paused) {
          if (!a.greeted && proximity <= trigger.GREET_DISTANCE) {
            a.greeted = true; this.chat(a, "greet");
          } else if (a.greeted && !a.chatted && proximity <= trigger.CHAT_DISTANCE && /Barbie|Chelsea|Madison/.test(a.ACTOR)) {
            a.chatted = true; this.chat(a, "chat");
          } else if (a.greeted && !a.saidBye && proximity > trigger.GREET_DISTANCE) {
            a.saidBye = true; this.chat(a, "bye");
          }
        }
        this.e.draw(
          a.ACTOR,
          a.paused
            ? a.dir > 0
              ? "TalkR"
              : "TalkL"
            : a.dir > 0
              ? "WalkRt"
              : "WalkLt",
          {
            dx: a.x - cam,
            dy: 510 + (a.FORCED_Y || 0),
            time: t,
            action: () => this.chat(a),
            label: `Talk to ${this.actorName(a.ACTOR)}`,
            id: a.ACTOR,
            cursor: /Boy/.test(a.ACTOR) ? this.e.cursor("AniStCurHeart", "Highlight") : "pointer",
          },
        );
      }
      if (moving) {
        this.streetFacing = distance > 0 ? "RIGHT" : "LEFT";
        this.streetIdle = null;
      } else if (!this.streetIdle || t >= this.streetIdle.until) {
        const choices = this.r("DctDollIdle"), idle = choices[Math.floor(Math.random() * choices.length)];
        const fx = idle[this.streetFacing || "CENTER"], effect = this.e.effect(this.doll.DOLL_SP, fx);
        this.streetIdle = { fx, start: t, until: t + Math.max(1000, effect.frames.length * effect.delay) };
      }
      this.e.draw(
        this.doll.DOLL_SP,
        moving ? (distance > 0 ? "WalkRt" : "WalkLt") : this.streetIdle.fx,
        { dx: this.p.x - cam, dy: 530, time: moving ? t : t - this.streetIdle.start },
      );
    };
    this.pointer = (x, y) => {
      if (y > 350 && y < 552) {
        this.target = Math.min(
          world.WORLDWIDTH - 35,
          Math.max(35, x + this.cameraX),
        );
        this.save();
      }
    };
    const p = this.panel(
      areas[area],
      '<p>Click the pavement to walk. Visit the shops, say hi to people, and try the little things along the way.</p><p class="keys">← → to walk · Click a door to enter</p>',
    );
    const dirs = this.group(p, "row");
    this.btn(
      "← Walk left",
      () => {
        this.target = Math.max(40, this.p.x - 500);
      },
      dirs,
    );
    this.btn(
      "Walk right →",
      () => {
        this.target = Math.min(world.WORLDWIDTH - 40, this.p.x + 500);
      },
      dirs,
    );
    const dest = this.group(p);
    for (const it of items.filter((i) => i.SPRITE === "SptStDoor")) {
      const label =
        it.DATYPE === "ScStStreet"
          ? "Subway"
          : it.DATYPE === "ScBaBarApt"
            ? `${{ 1: "Westley", 2: "Chelsea", 3: "Barbie" }[area]}’s apartment`
            : names[it.DATYPE];
      this.btn(
        label,
        () => {
          this.target = it.XLOC;
          this.p.x = it.XLOC;
          this.destination(it.DATYPE, area);
        },
        dest,
      );
    }
    if (area === 4) {
      this.btn("Read the Zine", () => this.zine(), dest);
      this.btn("Personality quiz", () => this.quiz(), dest);
    }
    this.save();
  }
  incidental(it, area, i) {
    if (/Misc(Girl|Guy)/.test(it.SPRITE))
      return this.chat({ ACTOR: it.SPRITE });
    const effects = this.data.sprites[it.SPRITE]?.effects || {},
      fx = effects.Play ? "Play" : effects.Anim ? "Anim" : effects.Idle ? "Idle" : "Still";
    this.animations.set(`${area}:${i}`, {
      fx,
      start: this.e.clock,
      fly: /Bird/.test(it.SPRITE),
      bounds: this.e.bounds(it.SPRITE),
    });
    if (/Bird/.test(it.SPRITE))
      this.voice("SndZzSfx", `Bird${pad(1 + Math.floor(Math.random() * 3))}`, {
        channel: "effect",
      });
    else if (effects[fx]?.sound) this.voice(it.SPRITE, fx, { channel: "effect" });
  }
  actorName(n) {
    return (
      {
        AniStBarbie: "Barbie",
        AniStChelsea: "Chelsea",
        AniStMadison: "Westley",
        AniStBoy01: "Bryant",
        AniStBoy02: "River",
        AniStBoy03: "Hudson",
        AniStBoy04: "Ellis",
        AniStSkateboarder: "the skateboarder",
      }[n] || "a neighbor"
    );
  }
  chat(actor) {
    actor.paused = true;
    const n = actor.ACTOR,
      name = this.actorName(n),
      isGirl = /Barbie|Chelsea|Madison/.test(n),
      target = {
        AniStBarbie: "Bar",
        AniStChelsea: "Chel",
        AniStMadison: "Mad",
      }[n];
    const p = this.modal(name, "<p>A familiar face in the city!</p>");
    this.voice(
      "VocStGreetVO",
      isGirl ? `${target}Greet01` : "MiscCharaGreeting13",
    );
    this.btn(
      "Chat",
      () =>
        this.voice(
          "VocStGreetVO",
          isGirl
            ? `GenChat${this.pre === "Che" ? "Chel" : this.pre}${target}${pad(1 + Math.floor(Math.random() * 2))}`
            : "Chat1",
        ),
      p,
    );
    if (/Boy/.test(n)) {
      this.btn(
        "♡ Flirt",
        () => {
          this.voice(
            "VocStGreetVO",
            `KissBoy${pad(1 + Math.floor(Math.random() * 5))}`,
          );
          if (!this.p.boys.includes(n)) this.p.boys.push(n);
          this.e
            .thumbnail("AniStCurHeart", "Up", 54, 54)
            .then((c) => p.append(c));
          this.voice("SndStSfx", "Kiss", { channel: "effect" });
          this.save();
          this.text(`${name}’s picture is in your scrapbook.`);
        },
        p,
      );
      this.btn(
        "Play it cool",
        () =>
          this.voice(
            "VocStGreetVO",
            `KissBoy${pad(6 + Math.floor(Math.random() * 5))}`,
          ),
        p,
      );
    }
    this.btn(
      "See you!",
      () => {
        actor.paused = false;
        this.close();
      },
      p,
    );
    $("#dialog").addEventListener("close", () => (actor.paused = false), {
      once: true,
    });
  }
  async map() {
    const p = this.modal("Where to?");
    const can = await this.e.thumbnail("AniStMap", undefined, 520, 350);
    p.append(can);
    const g = this.group(p, "row");
    for (let area = 1; area <= 4; area++)
      this.btn(
        areas[area],
        () => {
          this.close();
          this.movie(`subway-${this.pre.toLowerCase()}`, () =>
            this.street(area),
          );
        },
        g,
      );
  }
  todo() {
    const p = this.modal(`Weekend ${this.p.week} plans`);
    for (const [i, t] of this.tasks.entries()) {
      const b = this.btn(
        `${this.progress.done.includes(i) ? "✓" : "○"} ${plain(t.SHORT_TXT)}`,
        () => this.text(t.EXPANDED),
        p,
        `task ${this.progress.done.includes(i) ? "done" : ""}`,
      );
      const s = document.createElement("small");
      s.textContent = plain(t.EXPANDED);
      b.append(s);
    }
    if (this.complete)
      this.btn(
        "Everything’s ready — go to the event!",
        () => this.finishWeekend(),
        p,
        "primary",
      );
  }
  taskFor(scene) {
    return this.tasks
      .map((t, i) => ({ ...t, index: i }))
      .filter((t) => t.SCENE === scene);
  }
  markTask(index) {
    if (this.progress.done.includes(index)) return;
    this.progress.done.push(index);
    this.text(`✓ ${plain(this.tasks[index].SHORT_TXT)}`);
    this.voice("SndZzSfx");
    this.triggerCalls();
    this.save();
  }
  triggerCalls() {
    const w = this.week;
    for (const [i, fx] of (w.PHONE_CALLS || []).entries())
      if (
        !this.progress.calls.includes(i) &&
        this.progress.done.length >= w.PHONE_CALLS_TRIGGER_TASK[i]
      ) {
        this.progress.calls.push(i);
        this.voice("SndCellSfx");
        this.text(
          `${w.PHONE_CALLS_TEXT[i]} called! Open your phone to listen.`,
        );
      }
  }
  async purchase(scene, item, taskIndex) {
    const cost =
      scene.startsWith("ScClClothes") ? 40 : this.r("DctStoreCost").find((r) => r.SCENE === scene)?.COST || 10;
    const key = scene + ":" + item;
    if (!this.progress.bought.includes(key)) {
      if (this.p.money < cost) {
        this.wallet("A creative job pays $40. Clothing costs $40 per item; other purchases cost $10.");
        return false;
      }
      this.p.money -= cost;
      this.progress.bought.push(key);
    }
    if (taskIndex !== undefined) this.markTask(taskIndex);
    this.save();
    this.text(`Bought! $${this.p.money} in your wallet.`);
    return true;
  }
  wallet(message = "") {
    const p = this.modal(
      `Your wallet: $${this.p.money}`,
      `<p>${esc(message || "Earn $40 for each completed design or music job. Clothing costs $40 per item; other purchases cost $10. Each weekend starts with $40.")}</p>`,
    );
    for (const scene of ["ScCdClothesDes", "ScWdWinDress", "ScMmMusMix"].filter(
      (s) => this.canEnter(s),
    ))
      this.btn(names[scene], () => this.go(scene), p);
  }
  help(idle = false) {
    const context = helpContext(this, idle);
    this.lastHelpContext = context?.[0];
    if (context) {
      const [key, voice] = context, entries = this.r(key);
      const available = entries.filter(r => r.FX !== this.lastHelpClip);
      const pool = available.length ? available : entries;
      const row = pool[Math.floor(Math.random() * pool.length)];
      if (row?.FX) { this.lastHelpClip = row.FX; this.voice(voice, row.FX); }
    }
    if (!idle && !$("#dialog").open) this.modal("A little help", `<p>${esc(this.ui.help || "Use the map, phone, and to-do list to plan your weekend.")}</p>`);
  }

  async imageData(url) {
    if (this.e.cache.has(url)) return this.e.cache.get(url);
    const im = new Image();
    im.src = url;
    await im.decode();
    this.e.cache.set(url, im);
    return im;
  }
  download(content, name, type = "application/json") {
    const blob =
      content instanceof Blob ? content : new Blob([content], { type });
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async exportSave() {
    await this.flush();
    this.download(
      JSON.stringify(this.p),
      `my-scene-${this.p.name.replace(/[^\w-]/g, "-")}.json`,
    );
  }
  importSave(openPicker = true) {
    const f = $("#save-import");
    f.value = "";
    f.onchange = async () => {
      try {
        const file = f.files[0];
        if (file.size > 100 * 1024 * 1024)
          throw new Error("File is too large.");
        const p = JSON.parse(await file.text());
        if (
          p.version !== 1 ||
          typeof p.name !== "string" ||
          !Number.isInteger(p.week) ||
          p.week < 1 ||
          p.week > 12 ||
          !Number.isFinite(p.money) ||
          p.money < 0 ||
          !p.weeks ||
          !p.activities ||
          !Array.isArray(p.photos) ||
          !Array.isArray(p.designs) ||
          !Array.isArray(p.completedWeeks)
        )
          throw new Error("This is not a My Scene save file.");
        p.id = crypto.randomUUID();
        p.name = p.name.slice(0, 30);
        await this.saves.put(p);
        this.close();
        await this.load(p);
        this.text("Saved game imported.");
      } catch (e) {
        this.text(`Could not import: ${e.message}`);
      }
    };
    if (openPicker) f.click();
  }
  options() {
    const p = this.modal(
      "Save & options",
      "<p>Your game saves automatically in this browser. Save a file to move it to another device.</p>",
    );
    const g = this.group(p);
    this.btn("Save file", () => this.exportSave(), g);
    this.btn("Import saved game", () => this.importSave(), g);
    this.btn(
      "Back to sign-in",
      async () => {
        this.close();
        await this.signin();
      },
      g,
    );
    this.btn(
      "Watch introduction",
      () => {
        this.close();
        this.movie("intro");
      },
      g,
    );
    this.btn("Credits", () => this.credits(), g);
  }
}

try {
  const response = await fetch("assets/game-data.json");
  if (!response.ok) throw new Error("Game data could not be downloaded.");
  const game = new Game(await response.json());
  window.myScene = game;
  await game.start();
} catch (error) {
  console.error(error);
  $("#loading").hidden = true;
  $("#panel").innerHTML =
    `<h1>Let’s try that again</h1><p>${esc(error.message)}</p><button onclick="location.reload()">Reload game</button>`;
  document.body.classList.add("load-error");
}
