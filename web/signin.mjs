export function installSignIn(g) {
  g.signinMessage = (id, accept) => {
    g.cancelSigninSequence?.();
    const row = g.r("DctSiMessages").find(r => r.MESSAGE === id);
    const p = g.d("DctSiMessages"), e = g.native.e;
    const close = () => { g.close(); document.querySelector("#signin-name").focus(); };
    let busy = false;
    g.native.open(row.TEXT, () => {
      e.draw(p.DIALOG_BOX);
      const yes = async () => { if (busy) return; busy = true; g.close(); await accept?.(); };
      if (row.TYPE === "YesNo") {
        e.button(p.DIALOG_BUTTON_YES, "Yes", yes);
        e.button(p.DIALOG_BUTTON_NO, "No", close);
      } else e.button(p.DIALOG_BUTTON_OK, "OK", close);
    });
    g.native.textSprite(p.DIALOG_TEXT, row.TEXT);
    if (row.VO_SPRITE) g.voice(row.VO_SPRITE, row.VO_FX);
  };

  g.signin = async () => {
    await g.flush(); g.cancelMovie?.(); g.cancelStory?.(); g.close();
    g.designCleanup?.(); g.musicCleanup?.();
    g.p = null; g.sound.stopMix(); g.sound.stopAmbient(); g.sound.stopVoice();
    g.scene = "signin"; g.pointer = null; g.e.canvas.style.cursor = "default";
    document.querySelector("#quick").replaceChildren();
    document.querySelector("#status").textContent = "";
    const config = g.d("DctSiListBox");
    const profiles = (await g.saves.all()).sort((a,b) => a.name.localeCompare(b.name, "en", {sensitivity:"base"}));
    const limit = config.PAGE_LENGTH, maxStart = Math.max(0, profiles.length - limit);
    let first = 0, selected = null;
    const phoneName = document.querySelector("#signin-name");
    phoneName.hidden = false; phoneName.value = ""; phoneName.placeholder = "";
    phoneName.maxLength = config.SIGNIN_NAME_LENGTH;
    const edit = g.data.sprites[config.EDIT_SPRITE].properties;
    Object.assign(phoneName.style, {left:`${edit.HOME[0]/8}%`,top:`${edit.HOME[1]/6}%`,width:`${edit.SIZE[0]/8}%`,height:`${edit.SIZE[1]/6}%`,fontFamily:edit.FONTNAME,color:`rgb(${edit.COLOR})`,textAlign:"left"});
    const panel = g.panel("Sign in", `<form id="new-profile"><label class="field">Your name<input name="name" maxlength="${config.SIGNIN_NAME_LENGTH}" autocomplete="off"></label><button>New game</button></form>`);
    const sidebarName = panel.querySelector("input");
    const select = profile => {
      selected = profile;
      phoneName.value = sidebarName.value = profile.name;
      const i = profiles.indexOf(profile);
      first = Math.max(0, Math.min(maxStart, i < first ? i : i >= first + limit ? i - limit + 1 : first));
    };
    const editName = source => {
      const clean = source.value.replace(/[^\p{L}\p{N} ]/gu, "").slice(0, config.SIGNIN_NAME_LENGTH);
      phoneName.value = sidebarName.value = clean;
      selected = profiles.find(p => p.name.toLowerCase() === clean.trim().toLowerCase()) || null;
      g.voice(config.TYPING_SOUND, undefined, {channel:"effect"});
    };
    phoneName.oninput = () => editName(phoneName);
    sidebarName.oninput = () => editName(sidebarName);
    const create = async (existing = null) => {
      const name = phoneName.value.trim();
      if (!name) { g.voice("VocSiNoName", "Play"); phoneName.focus(); return; }
      if (!existing && profiles.some(p => p.name.toLowerCase() === name.toLowerCase())) return g.signinMessage("DUPLICATE_NAME");
      if (!existing && profiles.length >= config.MAX_NAMES) return g.signinMessage("MAX_NAMES");
      const profile = {version:1, id:existing?.id || crypto.randomUUID(), name, week:1, money:40, weeks:{}, activities:{}, designs:[], photos:[], boys:[], quizzes:{}, jumbles:{}, area:4, x:400, location:"ScStStreet", completedWeeks:[], tutorial:"welcome", created:Date.now()};
      await g.load(profile, true);
    };
    const startNew = () => selected ? g.signinMessage("START_NEW_GAME", () => create(selected)) : create();
    const continueGame = () => selected && g.load(selected);
    const remove = profile => g.signinMessage("DELETE_PLAYER", async () => { await g.saves.delete(profile.id); await g.signin(); });
    panel.querySelector("form").onsubmit = ev => { ev.preventDefault(); startNew(); };
    phoneName.onkeydown = ev => {
      if (ev.key === "Enter") { ev.preventDefault(); selected ? continueGame() : startNew(); }
    };
    const controls = g.group(panel);
    g.btn("Continue saved game", continueGame, controls);
    for (const profile of profiles) {
      const row = g.group(panel, "profile-row");
      g.btn(profile.name, () => select(profile), row);
      g.btn(`Delete ${profile.name}`, () => remove(profile), row);
    }
    g.btn("Import a saved game", () => g.importSave(), panel);
    g.btn("Options", () => g.signinOptions(), panel);
    await g.prepare(["SignInMS:1", "BtnSiNewGame", "BtnSiContinueGame", "BtnSiHelp", config.DELETE_BUTTON, config.UP_ARROW, config.DOWN_ARROW, "BtnSiExit"]);
    g.currentRender = () => {
      const e = g.e;
      e.background("SignInMS:1");
      const button = (sprite, label, action, enabled) => enabled ? e.button(sprite,label,action) : e.draw(sprite,"Disabled");
      button("BtnSiNewGame", "Start a new game", startNew, !!phoneName.value.trim());
      button("BtnSiContinueGame", "Continue saved game", continueGame, !!selected);
      button(config.DELETE_BUTTON, "Delete selected player", () => selected && remove(selected), !!selected);
      button(config.UP_ARROW, "Scroll player names up", () => { first = Math.max(0, first - config.ARROW_SCROLL); }, first > 0);
      button(config.DOWN_ARROW, "Scroll player names down", () => { first = Math.min(maxStart, first + config.ARROW_SCROLL); }, first < maxStart);
      e.button("BtnSiHelp", "Sign-in help", () => g.signinHelp());
      e.button("BtnSiExit", "Options", () => g.signinOptions());
      profiles.slice(first, first + limit).forEach((profile, i) => {
        const color = selected?.id === profile.id ? [config.TEXT_HR,config.TEXT_HG,config.TEXT_HB] : [config.TEXT_R,config.TEXT_G,config.TEXT_B];
        const y = 150 + i * config.TEXT_DISTANCE;
        e.textBox(profile.name, 300, y, 215, config.TEXT_DISTANCE, {size:config.TEXT_SIZE,family:"Verdana",bold:!!config.TEXT_BOLD,color:`rgb(${color})`});
        e.hit(`profile-${profile.id}`, `Select ${profile.name}`, {x:300,y,w:215,h:config.TEXT_DISTANCE}, () => select(profile));
      });
    };
  };
}
