import { Engine, esc, pad, plain, rows } from "./engine.mjs";

// The original game is an 800 × 600 composition. Keep its artwork, text boxes,
// and hit regions in that coordinate system, including modal screens.
export function installNativeUI(g) {
  const dialog = document.querySelector("#dialog"), body = document.querySelector("#dialog-body");
  const canvas = document.createElement("canvas"), hits = document.createElement("div");
  canvas.id = "dialog-stage"; canvas.width = 800; canvas.height = 600;
  hits.id = "dialog-hotspots";
  dialog.prepend(canvas, hits);
  const e = new Engine(g.data, canvas, hits);
  e.cache = g.e.cache; e.pending = g.e.pending;
  let render = () => {};
  e.render = (t) => { if (dialog.open) render(t); };
  const position = (element, x, y, w, h, size = 16) => {
    Object.assign(element.style, { position: "absolute", left: `${x / 8}%`, top: `${y / 6}%`, width: `${w / 8}%`, height: `${h / 6}%`, fontSize: `${size / 8}cqw` });
    return element;
  };
  const ink = (engine, label, x, y, w, h, action, options = {}) => {
    const id = options.id || label;
    engine.text(label, x, y + 3, { size: options.size || 16, color: engine.hover === id ? "#a32988" : options.color || "#233c79", maxWidth: w, bold: options.bold });
    engine.hit(id, options.label || label, { x, y, w, h }, action);
  };
  const field = (text, x, y, w, h, size = 16, tag = "div") => {
    const el = document.createElement(tag); el.className = "native-text";
    el.textContent = plain(text); position(el, x, y, w, h, size); body.append(el); return el;
  };
  const textSprite = (name, text, tag = "div") => {
    const p = g.data.sprites[name].properties;
    const el = field(text, p.HOME[0], p.HOME[1], p.SIZE[0], p.SIZE[1], p.FONTSIZE || 16, tag);
    el.style.fontFamily = p.FONTNAME || "Arial";
    if (p.COLOR) el.style.color = `rgb(${p.COLOR.join(",")})`;
    if (p.FONTSTYLE?.includes("BOLD")) el.style.fontWeight = "bold";
    if (p.ALIGNMENT?.includes("CENTER")) el.style.textAlign = "center";
    return el;
  };
  const open = (title, draw, mode = "native") => {
    body.replaceChildren(); dialog.dataset.mode = mode;
    dialog.setAttribute("aria-label", title); render = draw;
    hits.replaceChildren(); e.buttons.clear();
    if (!dialog.open) dialog.showModal();
    return body;
  };
  const closeButton = (sprite = "BtnZzPostItClose", options = {}) => e.button(sprite, "Close dialog", () => g.close(), options);
  g.native = { e, open, field, textSprite, position, ink, closeButton };
  g.ink = (...args) => ink(g.e, ...args);
  g.modal = (title, html = "") => {
    open(title, () => {
      e.draw("AniZzPostIt", "Still", { fit: [151, 45, 498, 494] });
      closeButton("BtnZzPostItClose", { fit: [581, 88, 25, 25] });
    }, "note");
    body.innerHTML = `<h2>${esc(title)}</h2>${html}`;
    return body;
  };
  g.note = (title, text) => g.modal(title, `<p>${esc(plain(text))}</p>`);

  g.map = () => {
    const spots = g.r("DctMapSpots").filter(s => s.SCENE === "ScStStreet");
    open("City map", () => {
      e.draw("AniStMap");
      for (const s of spots) {
        const labels = {1: "Upper East Side", 2: "The Village", 3: "Downtown", 4: "Parkside"};
        e.hit(`map-${s.ID}`, labels[s.ID], { x: s.MAP_X - 52, y: s.MAP_Y - 30, w: 120, h: 72 }, () => {
          g.close(); g.movie(`subway-${g.pre.toLowerCase()}`, () => g.street(s.ID));
        });
        if (e.hover === `map-${s.ID}`) e.draw({1:"AniStMapUpperEast",2:"AniStMapVillage",3:"AniStMapDowntown",4:"AniStMapPark"}[s.ID]);
      }
      closeButton("BtnStCloseMap");
    });
  };
  g.todo = () => {
    open(`Weekend ${g.p.week} plans`, () => {
      e.draw("AniZzPostIt");
      e.text(`Weekend ${g.p.week}`, 236, 130, { size: 19, bold: true });
      g.tasks.forEach((task, i) => ink(e, `${g.progress.done.includes(i) ? "✓ " : ""}${plain(task.SHORT_TXT)}`, 236, 160 + i * 42, 300, 40,
        () => g.phone("tasks", i), { size: 18, id: `task-${i}` }));
      if (g.complete) ink(e, "Everything’s ready — go to the event!", 236, 383, 300, 27, () => g.finishWeekend(), { size: 15 });
      closeButton();
    });
  };
  g.phone = (tab = "tasks", selected = null) => {
    const w = g.week, n = g.progress.done.length;
    const messages = (w.PHONE_MSG_TEXT_LONG || []).map((text, i) => ({ text, title: w.PHONE_MSG_TEXT[i], trigger: w.PHONE_MSG_TRIGGER_TASK?.[i] || 0 })).filter(m => n >= m.trigger);
    const calls = (w.PHONE_CALLS || []).map((fx, i) => ({ fx, title: w.PHONE_CALLS_TEXT[i], image: w.PHONE_CALLS_IMAGE[i], trigger: w.PHONE_CALLS_TRIGGER_TASK[i] })).filter(c => n >= c.trigger);
    const phone = "AniZzCellPhone" + (g.pre === "Che" ? "Chel" : g.pre);
    const title = { tasks: "To-do", messages: "Messages", calls: "Calls" }[tab];
    open("Your phone", () => {
      e.draw(phone);
      if (selected !== null) e.draw("AniZzDisplayScreen");
      e.text(title, 400, 190, { size: 19, align: "center", color: "#192299" });
      e.hit("phone-back", "Back to phone list", { x: 330, y: 188, w: 144, h: 28 }, () => g.phone(tab));
      e.button("BtnZzTask", "To-do list", () => g.phone("tasks"));
      e.button("BtnZzMessage", "Messages", () => g.phone("messages"));
      e.button("BtnZzCellPhone", "Calls", () => g.phone("calls"));
      e.button("BtnZzExitPhone", "Close phone", () => g.close());
      if (tab === "calls" && selected !== null && calls[selected]?.image)
        e.draw(calls[selected].image, undefined, { fit: [350, 248, 100, 92] });
    });
    if (selected !== null) {
      const text = tab === "tasks" ? g.tasks[selected].EXPANDED : tab === "messages" ? messages[selected]?.text : calls[selected]?.title;
      const el = field(text, 345, 224, 124, tab === "calls" ? 26 : 119, tab === "calls" ? 12 : 14);
      el.tabIndex = 0;
      if (tab === "calls") g.say(calls[selected].fx);
      if (tab === "messages" && w.PHONE_MSG_VO?.[selected]) g.say(w.PHONE_MSG_VO[selected]);
    } else {
      const list = field("", 343, 217, 129, 126, 14);
      const items = tab === "tasks" ? g.tasks.map((t, i) => ({ title: (g.progress.done.includes(i) ? "✓ " : "") + plain(t.SHORT_TXT) })) : tab === "messages" ? messages : calls;
      items.forEach((item, i) => g.btn(plain(item.title), () => g.phone(tab, i), list, "phone-row"));
      if (!items.length) list.textContent = "No new messages yet.";
      if (tab === "messages") (w.PHONE_MSG_VO || []).forEach((fx, i) => g.btn(`▶ Voice message ${i + 1}`, () => g.say(fx), list, "phone-row"));
    }
  };

  g.zine = (week = g.p.week) => {
    const w = g.d(`DctTaskWk${pad(week)}`), answers = (g.p.jumbles[week] ||= []);
    const check = () => {
      const correct = answers.filter((a, i) => a.replace(/[^A-Z]/g, "") === w.PUZZLE_WORD[i * 3 + 1].replace(/[^A-Z]/g, "")).length;
      g.text(correct === w.PUZZLE_WORD.length / 3 ? "All solved! Use those fashion clues in the shops." : `${correct} words solved. Keep rearranging the letters!`);
      g.voice("SndZineSfx");
    };
    open(`The Zine · Issue ${week}`, () => {
      e.draw("AniStZine");
      closeButton("BtnStZineClose");
      e.button("BtnStZineArrowL", "Previous issue", () => g.zine(week > 1 ? week - 1 : g.p.week));
      e.button("BtnStZineArrowR", "Personality quiz", () => g.quiz(week));
      e.button("BtnStZineAnswer", "Check my words", check);
      e.text(String(week), 400, 506, { size: 18, align: "center" });
    });
    textSprite("TxtStZineBody", w.ZINE_TEXT).tabIndex = 0;
    textSprite("TxtStPuzzleTitle", w.PUZZLE_TITLE);
    for (let i = 0; i < w.PUZZLE_WORD.length / 3; i++) {
      const [scramble, answer, mask] = w.PUZZLE_WORD.slice(i * 3, i * 3 + 3), y = [315, 385, 448][i];
      field(`${plain(w.PUZZLE_STR[i])} ${scramble}`, 235, y, 350, 25, 14);
      const input = field("", 235, y + 28, 320, 24, 17, "input");
      input.setAttribute("aria-label", `Word jumble ${i + 1}`);
      input.value = answers[i] || ""; input.maxLength = answer.length + 5; input.autocomplete = "off";
      input.placeholder = [...answer].map((c, j) => mask[j] === "1" ? c : "_").join(" ");
      input.oninput = () => { answers[i] = input.value.toUpperCase(); g.save(); };
      input.onkeydown = ev => { if (ev.key === "Enter") check(); };
    }
  };
  g.quiz = (week = g.p.week, index = 0) => {
    const d = g.d(`DctZineQuiz${pad(week)}`), questions = rows(d), answers = (g.p.quizzes[week] ||= []);
    const finish = index >= questions.length;
    open(d.TOPIC, () => {
      e.draw("AniStQuizBkg"); closeButton("BtnStQuizClose");
      if (!finish) for (let a = 1; a <= 3; a++) e.button(`BtnStZineRadio${pad(a)}`, questions[index][`ANS${a}`], () => choose(a));
      e.button("BtnStZineArrowL", "Back to the Zine", () => g.zine(week));
      e.button("BtnStZineArrowR", finish ? "Next issue" : "Next question", () => finish ? g.zine(week < g.p.week ? week + 1 : 1) : answers[index] && g.quiz(week, index + 1));
    });
    textSprite("TxtStQuizTopic", d.TOPIC);
    const choose = a => { answers[index] = a; g.save(); g.voice("SndZineQuizSfx"); g.quiz(week, index + 1); };
    if (finish) {
      const score = answers.reduce((sum, a, i) => sum + (questions[i][`PTS${a}`] || 0), 0), max = questions.length * 2;
      field(d[score >= max * .75 ? "SCOREGOOD" : score >= max * .4 ? "SCOREOKAY" : "SCOREBAD"], 250, 153, 305, 272, 17).tabIndex = 0;
      const retry = field("Take it again", 290, 449, 220, 30, 17, "button");
      retry.onclick = () => { g.p.quizzes[week] = []; g.quiz(week); };
    } else {
      textSprite("TxtStQuizQuestion", questions[index].QUESTION);
      for (let a = 1; a <= 3; a++) {
        const b = textSprite(`TxtStQuizAnswer${pad(a)}`, questions[index][`ANS${a}`], "button");
        b.onclick = () => choose(a);
      }
    }
  };

  const pictureImage = async (picture) => {
    if (!picture.sprite) return g.imageData(picture.src);
    await e.preload([picture.sprite, picture.overlay].filter(Boolean));
    const c = document.createElement("canvas"); c.width = 640; c.height = 480;
    e.draw(picture.sprite, undefined, {ctx:c.getContext("2d")});
    if (picture.overlay) e.draw(picture.overlay, undefined, {ctx:c.getContext("2d")});
    return c;
  };
  const fitImage = (im, x, y, w, h) => {
    const width = im.naturalWidth || im.width, height = im.naturalHeight || im.height;
    const scale = Math.min(w / width, h / height);
    e.ctx.drawImage(im, x + (w - width * scale) / 2, y + (h - height * scale) / 2, width * scale, height * scale);
  };
  g.photo = async (picture, {next, prev} = {}) => {
    const im = await pictureImage(picture);
    const png = document.createElement("canvas"); png.width = im.naturalWidth || im.width; png.height = im.naturalHeight || im.height;
    png.getContext("2d").drawImage(im, 0, 0);
    open(picture.caption || "A My Scene memory", () => {
      e.draw("AniSbSlideBG"); fitImage(im, 80, 25, 640, 480);
      if (prev) e.button("BtnSbMtgeArrowLt", "Previous picture", prev);
      if (next) e.button("BtnSbMtgeArrowRt", "Next picture", next);
      e.button("BtnSbMtgePrint", "Print picture", () => g.printImage(png.toDataURL("image/png"), picture.caption));
      e.button("BtnSbMtgeSave", "Download picture", () => png.toBlob(blob => g.download(blob, "my-scene-memory.png", "image/png"), "image/png"));
      e.button("BtnSbMtgeClose", "Back to scrapbook", () => g.scrapbook(picture.state ? "designs" : picture.sprite ? "photos" : "camera", picture.week || g.p.week));
      if (picture.state) ink(e, "Edit this design", 300, 545, 210, 28, () => {
        const scene = picture.type === "window" ? "ScWdWinDress" : "ScCdClothesDes", old = g.activity(scene, {});
        g.p.activities[`${g.p.week}:${scene}`] = {...structuredClone(picture.state), brief:0, undo:[], paid:old.paid || []};
        g.close(); g.go(scene);
      }, {size:17});
    });
    field(picture.caption, 135, 509, 530, 39, 16).style.textAlign = "center";
    if (picture.voice) g.voice("SndSbVO", picture.voice);
  };
  g.scrapbook = async (tab = "photos", week = g.p.completedWeeks.at(-1) || 1, page = 0, person = g.pre === "Che" ? "Chel" : g.pre) => {
    const param = g.d("DctScrapbookParam"), frames = rows(param);
    let pictures = tab === "designs" ? g.p.designs.filter(d => d.src) : tab === "camera" ? g.p.photos : tab === "boys" ? g.p.boys.map(n => ({sprite:n.replace("AniStBoy", "AniSbGuyPicture"), caption:g.actorName(n)}))
      : g.p.completedWeeks.includes(week) ? g.eventPictures(week) : [];
    const visible = pictures.slice(page * 4, page * 4 + 4);
    const images = await Promise.all(visible.map(pictureImage));
    const changePage = delta => {
      if (tab === "photos") {
        const weeks = g.p.completedWeeks, at = weeks.indexOf(week);
        if (weeks.length) g.scrapbook(tab, weeks[(at + delta + weeks.length) % weeks.length]);
      } else g.scrapbook(tab, week, (page + delta + Math.max(1, Math.ceil(pictures.length / 4))) % Math.max(1, Math.ceil(pictures.length / 4)), person);
    };
    open("My scrapbook", () => {
      e.draw(tab === "about" ? param.ABOUTME_BG : param.SCRAP_BG);
      if (tab !== "about") images.forEach((im, i) => {
        const f = frames[i]; fitImage(im, f.XLOC, f.YLOC, 246, 183);
        e.hit(`album-${i}`, visible[i].caption || `Picture ${i + 1}`, {x:f.XLOC,y:f.YLOC,w:246,h:183}, () => g.photo(visible[i]));
      });
      for (const [sprite, id, label] of [[param.PHOTO_BTN,"photos","Weekend photos"],[param.DESIGN_BTN,"designs","My designs"],[param.ABOUTME_BTN,"about","About the girls"]])
        e.draw(sprite, tab === id ? "Down" : "Up", {action:()=>g.scrapbook(id,week),label});
      e.button(param.ARROWLT,"Previous album page",()=>changePage(-1));
      e.button(param.ARROWRT,"Next album page",()=>changePage(1));
      e.button(param.CLOSE_SP,"Close scrapbook",()=>g.close());
      ink(e,"My camera",80,557,115,24,()=>g.scrapbook("camera",week),{size:15});
      ink(e,"Boys",222,557,65,24,()=>g.scrapbook("boys",week),{size:15});
      if (tab === "about") ["Bar","Chel","Mad"].forEach((pre,i)=>ink(e,{Bar:"Barbie",Chel:"Chelsea",Mad:"Westley"}[pre],355+i*107,520,100,28,()=>g.scrapbook("about",week,0,pre),{size:17}));
    });
    if (tab === "about") {
      const sprite = `TxtSbAboutMe${person}`;
      textSprite(sprite, g.data.sprites[sprite].effects.Text.properties.TEXT.replace(/\\r\\n/g,"\n")).tabIndex = 0;
      g.voice(`VocBa${person}VO`, "AboutMe");
    } else {
      visible.forEach((picture,i)=>textSprite(frames[i].TEXTSP,picture.caption));
      if (!visible.length) field(tab === "photos" ? "Your weekend photos will go here. Finish your plans and enjoy the event!" : tab === "boys" ? "Say hello to the boys around the city to collect their pictures." : "Your saved creations will go here.",110,55,230,145,18);
    }
  };
  g.chat = actor => {
    actor.paused = true;
    const n = actor.ACTOR, isGirl = /Barbie|Chelsea|Madison/.test(n), target = {AniStBarbie:"Bar",AniStChelsea:"Chel",AniStMadison:"Mad"}[n];
    g.voice("VocStGreetVO", isGirl ? `${target}Greet01` : "MiscCharaGreeting13");
    if (!/Boy/.test(n)) {
      g.voice("VocStGreetVO",isGirl ? `GenChat${g.pre === "Che" ? "Chel" : g.pre}${target}${pad(1 + Math.floor(Math.random()*2))}` : "Chat1");
      setTimeout(()=>{actor.paused=false;},6500); return;
    }
    open(g.actorName(n),()=>{
      e.button("BtnStKiss","Flirt",()=>{
        g.voice("VocStGreetVO",`KissBoy${pad(1+Math.floor(Math.random()*5))}`);
        if(!g.p.boys.includes(n)) g.p.boys.push(n);
        g.voice("SndStSfx","Kiss",{channel:"effect"}); g.save(); actor.paused=false; g.close();
      });
      e.button("BtnStDiss","Play it cool",()=>{g.voice("VocStGreetVO",`KissBoy${pad(6+Math.floor(Math.random()*5))}`);actor.paused=false;g.close();});
    });
    dialog.addEventListener("close",()=>{actor.paused=false;},{once:true});
  };
  g.credits = () => {
    open("My Scene credits",()=>{
      e.background(g.background("ScCrCredits"));
      e.button("BtnSbMtgeClose","Close credits",()=>g.close());
    });
    const lines = plain(g.r("DctCredits").map(r=>r.CREDITS).join("")).replace(/&amp;/g,"&").replace(/&copy;/g,"©");
    const text = field(lines,180,70,450,430,18); text.style.textAlign="center"; text.tabIndex=0;
    g.voice("SndCrMusic",undefined,{channel:"ambient",loop:true,gain:.3});
  };

  const oldOptions = g.options.bind(g);
  g.options = () => {
    oldOptions();
    g.btn(g.sound.muted ? "Sound on" : "Sound off", () => { document.querySelector("#sound").click(); g.options(); }, body);
    g.btn("Full screen", () => { g.close(); document.querySelector("#fullscreen").click(); }, body);
    g.btn("Keyboard / accessible controls", () => { g.close(); document.body.classList.toggle("show-controls"); }, body);
  };
  g.signinOptions = () => {
    const p = g.modal("Options");
    g.btn("Import a saved game", () => g.importSave(), p);
    g.btn("Watch the introduction", () => { g.close(); g.movie("intro"); }, p);
    g.btn("Credits", () => g.credits(), p);
    g.btn(g.sound.muted ? "Sound on" : "Sound off", () => { document.querySelector("#sound").click(); g.signinOptions(); }, p);
    g.btn("Full screen", () => { g.close(); document.querySelector("#fullscreen").click(); }, p);
  };
  g.nativeMenu = () => g.p ? g.options() : g.signinOptions();
  document.querySelector("#browser-options").onclick = () => g.nativeMenu();
}
