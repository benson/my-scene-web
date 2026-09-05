export async function waitForVoice(request) {
  const source = await request;
  if (!source || source.ended) return;
  await new Promise(resolve => source.addEventListener("ended", resolve, {once:true}));
}

export function installStory(g) {
  let generation = 0;
  g.cancelStory = () => { generation++; g.recapAlbum = null; g.sound.stopVoice(); };
  const speak = (name, fx) => waitForVoice(g.voice(name, fx));
  const stage = value => { g.p.tutorial = value; g.save(); };
  g.beginTutorial = async () => {
    const token = ++generation, profile = g.p;
    await g.street(4);
    if (token !== generation || g.p !== profile) return;
    stage("welcome");
    await speak("VocStBarbieVO", "Intro");
    if (token === generation && g.p === profile && g.p.tutorial === "welcome") stage("openPhone");
  };
  const gettingAround = async () => {
    const token = ++generation, profile = g.p;
    stage("gettingAround");
    await speak("VocStBarbieVO", "HelpGettingAround");
    if (token !== generation || g.p !== profile) return;
    stage("ringing");
    await speak("VocStBarbieVO", "PhoneRing");
  };
  const phone = g.phone;
  g.phone = (...args) => {
    const step = g.p.tutorial;
    if (["welcome","openPhone"].includes(step)) {
      ++generation; stage("phoneList");
      phone("tasks");
      speak("VocStBarbieVO", "HelpOpenPhoneIntro");
      document.querySelector("#dialog").addEventListener("close", () => {
        if (g.p?.tutorial === "phoneList") gettingAround();
      }, {once:true});
      return;
    }
    phone(...args);
    if (step === "ringing" && g.progress.heardCalls?.includes("intro")) {
      ++generation; stage("done");
    }
  };
  const map = g.map;
  g.map = (...args) => {
    map(...args);
    if (g.p.week === 1 && !g.p.hints?.map) {
      (g.p.hints ||= {}).map = true; g.save();
      g.voice("VocStBarbieVO", "HelpSubwayMap");
    }
  };
  g.resumeTutorial = () => {
    if (!g.p.tutorial || g.p.tutorial === "done") return;
    if (g.p.tutorial === "gettingAround") gettingAround();
    else if (g.p.tutorial === "ringing") g.voice("VocStBarbieVO", "PhoneRing");
    else g.beginTutorial();
  };

  g.credits = async (ending = false) => {
    const e = g.native.e, profile = g.p;
    const background = g.background("ScCrCredits");
    await e.preload([background, "AniCrCredits"]);
    const text = g.r("DctCredits").map(r => r.CREDITS).join("").replace(/&amp;/g,"&").replace(/&copy;/g,"©");
    const props = g.data.sprites.TxtCrCredits.properties;
    const lines = text.split(/\r?\n/), lineHeight = props.FONTSIZE * 1.15;
    const started = e.clock, dialog = document.querySelector("#dialog");
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true; g.sound.stopAmbient(); g.close();
      if (ending && g.p === profile) g.signin();
    };
    const cancel = ev => { ev.preventDefault(); finish(); };
    dialog.addEventListener("cancel", cancel);
    dialog.addEventListener("close", () => dialog.removeEventListener("cancel", cancel), {once:true});
    g.voice("SndCrMusic", undefined, {channel:"ambient",loop:true,gain:.3});
    g.native.open("My Scene credits", time => {
      e.background(background);
      const y = props.HOME[1] - (time - started) * .05;
      lines.forEach((line,i) => {
        const at = y + i * lineHeight;
        if (at > -lineHeight && at < 600) e.text(line,400,at,{size:props.FONTSIZE,family:props.FONTNAME,bold:true,color:"white",align:"center",maxWidth:760});
      });
      e.draw("AniCrCredits");
      e.hit("credits-close","Close credits",{x:0,y:0,w:800,h:600},finish);
      if (y + lines.length * lineHeight < 0) finish();
    });
    const accessible = document.createElement("div");
    accessible.className = "credits-text";
    accessible.textContent = text;
    Object.assign(accessible.style,{position:"absolute",width:"1px",height:"1px",overflow:"hidden",clipPath:"inset(50%)"});
    document.querySelector("#dialog-body").append(accessible);
  };

  g.finishWeekend = async () => {
    if (!g.complete) return g.todo();
    if (!g.p.completedWeeks.includes(g.p.week)) g.p.completedWeeks.push(g.p.week);
    const week = g.p.week, profile = g.p, token = ++generation;
    g.p.recapPending = week; g.save(); g.sound.stopVoice();
    const pictures = g.eventPictures(week), e = g.native.e;
    await e.preload(["AniSbSlideBG", ...pictures.flatMap(p => [p.sprite,p.overlay].filter(Boolean))]);
    if (token !== generation || g.p !== profile) return;
    g.voice(`SndZzMtgeWeek${String(week).padStart(2,"0")}`, undefined, {channel:"ambient",gain:.3});
    let index = 0, skipped = false;
    const dialog = document.querySelector("#dialog");
    g.native.open("Weekend memories", () => {
      e.draw("AniSbSlideBG");
      const picture = pictures[index];
      e.draw(picture.sprite, undefined, {dx:80,dy:60});
      if (picture.overlay) e.draw(picture.overlay, undefined, {dx:80,dy:60});
    });
    const skip = ev => { ev.preventDefault(); skipped = true; g.sound.stopVoice(); };
    dialog.addEventListener("cancel", skip);
    for (; index < pictures.length; index++) {
      if (token !== generation || g.p !== profile || skipped) break;
      await speak("SndSbVO", pictures[index].voice);
    }
    dialog.removeEventListener("cancel", skip);
    index = Math.min(index, pictures.length - 1);
    if (token !== generation || g.p !== profile) return;
    g.recapAlbum = week;
    await g.scrapbook("photos", week);
    dialog.addEventListener("close", () => {
      if (g.p !== profile || g.recapAlbum !== week) return;
      g.recapAlbum = null; delete g.p.recapPending;
      g.nextWeekend();
    }, {once:true});
  };
}
