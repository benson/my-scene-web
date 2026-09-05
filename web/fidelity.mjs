export function installFidelity(g) {
  let debugSequence = "";
  document.addEventListener("keydown", async ev => {
    if (!g.p || ev.target.closest("input, textarea, select, [contenteditable=true]")) return;
    const key = ev.key.toUpperCase();
    if (ev.ctrlKey && key.length === 1) {
      const next = debugSequence + key;
      debugSequence = "DEBUG".startsWith(next) ? next : key === "D" ? "D" : "";
      if (debugSequence) ev.preventDefault();
      if (debugSequence === "DEBUG") {
        g.debugMode = true; debugSequence = ""; g.text("-----Debug Mode------");
      }
      return;
    }
    if (!g.debugMode || ev.ctrlKey || ev.altKey || ev.metaKey || ev.repeat) return;
    if (key === "D") { g.map(true); return; }
    if (key === "M" || key === "N") {
      g.sound.musicVolume = Math.max(0, Math.min(100, (g.sound.musicVolume ?? 100) + (key === "M" ? 1 : -1)));
      if (g.sound.ambientGain) g.sound.ambientGain.gain.value = g.sound.ambientBaseGain * g.sound.musicVolume / 100;
      g.text(`Music Volume: ${g.sound.musicVolume}`);
    }
    if (g.scene !== "ScStStreet" || document.querySelector("#dialog").open) return;
    if (key === "Z") { g.zine(); return; }
    if (key === "X") { g.quiz(); return; }
    if (key === "W" || key === "Q") {
      g.debugWalkSpeed = Math.max(1, (g.debugWalkSpeed || g.doll.SPEED) + (key === "W" ? 1 : -1));
      g.text(`WalkSpeed: ${g.debugWalkSpeed}`);
    }
    if ({B:"Barbie",C:"Chelsea",M:"Madison"}[key]) {
      g.debugDoll = `DctDoll${{B:"Barbie",C:"Chelsea",M:"Madison"}[key]}`;
      g.debugWalkSpeed = null; await g.street(g.p.area);
    }
    const week = "1234567890OP".indexOf(key);
    if (week >= 0 && key.length === 1) {
      g.p.week = week + 1; g.debugDoll = null; g.debugWalkSpeed = null;
      await g.street(g.p.area); g.save();
    }
  });
  let sequenceToken = 0, introStarted = false, startupShown = false, startupPlaying = false, idleAt = 0;
  const stopStartup = () => {
    if (!startupPlaying) return;
    g.cancelMovie?.(); startupPlaying = false;
  };
  const flashes = new Map();
  g.cancelSigninSequence = () => { ++sequenceToken; g.sound.stopVoice(); flashes.clear(); };
  const wait = source => !source || source.ended ? Promise.resolve() : new Promise(resolve => source.addEventListener("ended", resolve, { once: true }));
  const flash = (name, fx) => {
    const effect = g.e.effect(name, fx);
    if (effect?.image) { g.e.preload([name]).catch(() => {}); flashes.set(name, { fx, at: g.e.clock, duration: effect.frames.length * effect.delay }); }
  };
  g.signinHelp = async () => {
    ++sequenceToken;
    const key = document.querySelector("#signin-name").value ? "DctSiHasNameHelp" : "DctSiNoNameHelp";
    for (const row of g.r(key)) {
      if (g.data.sprites[row.SPRITE]?.effects[row.FX]?.sound) g.voice(row.SPRITE, row.FX);
      else flash(row.SPRITE, row.FX);
    }
  };
  const runIntro = async () => {
    if (introStarted || g.scene !== "signin") return;
    introStarted = true;
    const token = ++sequenceToken;
    const sequence = g.d("DctSiMainIntroSeq").SEQUENCE;
    for (let i = 0; i < sequence.length; i += 5) {
      if (token !== sequenceToken || g.scene !== "signin") return;
      const [action, name, fx, , delay] = sequence.slice(i, i + 5);
      if (action === "WAIT") await wait(await g.voice(name, fx));
      if (action === "PLAY") {
        await new Promise(resolve => setTimeout(resolve, delay));
        if (token === sequenceToken && g.scene === "signin") flash(name, fx);
      }
    }
  };
  const oldSignin = g.signin.bind(g);
  g.signin = async () => {
    ++sequenceToken; introStarted = false; flashes.clear();
    await oldSignin();
    idleAt = g.e.clock;
    const draw = g.currentRender;
    g.currentRender = (t, dt) => {
      draw(t, dt);
      const idleKey = document.querySelector("#signin-name").value ? "DctSiHasNameIdles" : "DctSiNoNameIdles";
      if (!startupPlaying && t - Math.max(idleAt, g.lastInput) >= g.d(idleKey).INTERVAL) {
        const entries = g.r(idleKey), row = entries[Math.floor(Math.random() * entries.length)];
        flash(row.SPRITE, row.FX); idleAt = t;
      }
      for (const [name, f] of flashes) {
        if (t - f.at >= f.duration) { flashes.delete(name); continue; }
        g.e.draw(name, f.fx, { time: t - f.at, loop: false });
      }
    };
    if (!startupShown) {
      startupShown = startupPlaying = true;
      const token = sequenceToken;
      const names = g.d("DctSiIntroSeq").SEQUENCE.filter((_, i) => i % 5 === 1).filter((name, i, all) => all.indexOf(name) === i);
      const movies = names.map(name => {
        const sequence = g.d(name).SEQUENCE;
        for (let i = 0; i < sequence.length; i += 5) if (sequence[i] === "WAIT") return g.data.sprites[sequence[i + 1]]?.properties.XFILE?.replace(/\.smk$/i, "");
      }).filter(Boolean);
      const next = () => {
        if (g.scene !== "signin" || token !== sequenceToken) { startupPlaying = false; return; }
        const movie = movies.shift();
        if (movie) g.movie(movie, next, { onSkip: () => { startupPlaying = false; runIntro(); } });
        else { startupPlaying = false; if (g.sound.context?.state === "running") runIntro(); }
      };
      next();
    }
  };
  const oldLoad = g.load.bind(g);
  g.load = (...args) => {
    ++sequenceToken;
    stopStartup();
    return oldLoad(...args);
  };
  document.addEventListener("pointerdown", () => { if (!startupPlaying) runIntro(); }, { passive: true });
  document.addEventListener("keydown", ev => {
    if (g.scene !== "signin") return;
    if (ev.key === g.d("DctSiMain").KEY_INTERRUPT_SEQ?.replace("ESCAPE", "Escape")) { ++sequenceToken; stopStartup(); g.sound.stopVoice(); flashes.clear(); }
    else if (!startupPlaying) runIntro();
  });
}

// Authored help dictionaries vary by activity state, not just by scene.
export function helpContext(g, idle = false) {
  const kind = idle ? "Idle" : "Help", pre = g.pre === "Che" ? "Chel" : g.pre;
  const modal = document.querySelector("#dialog");
  const title = modal.open ? modal.getAttribute("aria-label") : "";
  if (title === "Your phone") return [`DctSt${kind}Phone`, `SndZzCell${pre}`];
  if (title === "City map") return [`DctSt${idle ? "Help" : kind}Map`, g.doll.STREET_VO];
  if (title === "My scrapbook") return [`DctBaScrap${kind}`, `VocBa${pre}VO`];
  const state = g.p?.activities[`${g.p.week}:${g.scene}`] || {};
  const done = g.taskFor(g.scene).length && g.taskFor(g.scene).every(t => g.progress.done.includes(t.index));
  if (g.scene === "ScStStreet") return [g.p.area === 4 ? `DctSt${kind}Park` : g.world?.[idle ? "IDLE_DICT" : "HELP_DICT"] || `DctSt${kind}Street`, g.doll.STREET_VO];
  if (/^ScClClothes/.test(g.scene)) return [`DctCl${done ? "Bought" : "Game"}${kind}${idle && (state.top || state.bottom) ? "Hold" : ""}`, `VocCl${g.character}VO`];
  if (/^Sc(Ac|Mu)/.test(g.scene)) {
    const code = g.scene === "ScAcAccess" ? "Ac" : "Mu";
    return [`Dct${code}${done ? "Bought" : "Game"}${kind}`, `Voc${code}StoreKeeperVO`];
  }
  if (g.scene === "ScCdClothesDes" || g.scene === "ScWdWinDress") {
    const code = g.scene === "ScCdClothesDes" ? "Cd" : "Wd";
    const tab = state.tab === "Letters & stamps" ? "Stamps" : state.tab;
    const suffix = ["Fasteners", "Stamps", "Trims"].includes(tab) ? tab : "";
    return [`Dct${code}${kind}${suffix}`, `Voc${code}VO`];
  }
  const choices = {
    ScCsCDShop: [`DctCs${done ? "Bought" : "Game"}${kind}`, `AniCs${g.character}VO`],
    ScGtGift: [`DctGt${kind}`, "AniGtStoreKeeperVO"],
    ScFdFood: [`DctFd${kind}`, "AniFdStoreKeeperVO"],
    ScMmMusMix: [`DctMm${kind}${g.sound.sources.length ? "Mix" : ""}`, "VocMmJezVO"],
    ScBaBarApt: [`DctBa${kind}${g.pre === "Che" ? "Che" : ""}`, `VocBa${pre}VO`],
  };
  return choices[g.scene];
}
