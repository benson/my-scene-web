async page => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const assert = (ok,msg) => { if (!ok) throw new Error(msg); };
  await page.reload();
  await page.waitForFunction(() => window.myScene && document.querySelector("#loading").hidden);
  await page.evaluate(async () => {
    myScene.cancelMovie?.();
    await myScene.load({version:1,id:crypto.randomUUID(),name:"Audio QA",week:1,money:40,weeks:{},activities:{},designs:[],photos:[],boys:[],quizzes:{},jumbles:{},area:4,x:400,location:"ScStStreet",completedWeeks:[],created:Date.now()});
    myScene.sound.mute(true);
    document.body.classList.add("show-controls");
    await myScene.go("ScMmMusMix");
  });
  const panel = page.locator("#panel"), button = name => panel.getByRole("button",{name,exact:true});
  assert(!(await button("Pad 1").count()) && !(await button("● Record").count()), "Freestyle controls stay unavailable before matching");
  const answers = await page.evaluate(() => {
    const g = myScene, d = g.d(g.week.MUSIC_MIX[0]), n = d.TEMPLATE.length;
    const rows = Array.from({length:d.FORMS.length/n},(_,i) => Object.fromEntries(d.TEMPLATE.map((k,j) => [k,d.FORMS[i*n+j]])));
    return [1,2,3,4].map(k => rows.findIndex(r=>r[`CORRECT${k}`]));
  });
  for (let i=0;i<4;i++) await panel.locator("select").nth(i).selectOption(String(answers[i]));
  await button("Done · check my mix").click();
  await button("Pad 1").waitFor();
  assert(await page.evaluate(() => myScene.p.money === 80 && myScene.activity("ScMmMusMix",{}).mode === "effects"), "Successful matching enters freestyle and pays $40");
  await button("● Record").click();
  await button("● Recording · stop").waitFor();
  await button("Pad 1").click();
  await page.waitForFunction(() => myScene.sound.context.currentTime - myScene.sound.mixStarted > 1);
  await button("■ Stop").click();
  assert(await page.evaluate(() => {
    const s = myScene.activity("ScMmMusMix",{}), saved = myScene.p.designs.find(d=>d.id===s.savedMix);
    return s.recording.events.some(e=>e.pad) && JSON.stringify(saved.recording) === JSON.stringify(s.recording);
  }), "Recorded effects persist to music library");
  await button("▶ Play").click();
  await page.waitForFunction(() => document.querySelector("#status").textContent === "Playing your recorded mix.");
  await button("■ Stop").click();
  await page.screenshot({path:".local/story-music.png"});
  await page.evaluate(async () => {
    await myScene.street(4);
    const source = await myScene.voice("VocStBarbieVO","HelpGettingAround");
    window.realNarration = {duration:source?.buffer.duration, cues:myScene.e.cues.size};
    myScene.sound.stopVoice();
    myScene.progress.done = myScene.tasks.map((_,i)=>i);
    myScene.finishWeekend();
  });
  await page.waitForFunction(() => document.querySelector("#dialog").getAttribute("aria-label") === "Weekend memories" && myScene.sound.voice?.buffer);
  assert(await page.evaluate(() => realNarration.duration > 1 && realNarration.cues > 0 && !myScene.recapAlbum), "Real voice and cue data load; montage waits for narration");
  await page.screenshot({path:".local/story-montage.png"});
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => myScene.recapAlbum === 1);
  await page.evaluate(async () => { myScene.cancelStory(); myScene.close(); await myScene.credits(); document.body.classList.remove("show-controls"); });
  await page.getByRole("button",{name:"Close credits",exact:true}).waitFor();
  await page.screenshot({path:".local/story-credits.png"});
  await page.keyboard.press("Escape");
  assert(await page.evaluate(() => !document.querySelector("#dialog").open), "Credits can be skipped");
  assert(!errors.length,errors.join("\n"));
  return {passed:true,checks:"Staged music, real recording/library, voice cues, narrated montage skip, credits",errors};
}
