async page => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const assert = (value, message) => { if (!value) throw new Error(message); };
  await page.reload();
  await page.waitForFunction(() => window.myScene && document.querySelector("#loading").hidden);
  await page.evaluate(async () => {
    await myScene.load({ version: 1, id: crypto.randomUUID(), name: "Fidelity QA", week: 1, money: 100,
      weeks: {}, activities: {}, designs: [], photos: [], boys: [], quizzes: {}, jumbles: {},
      area: 3, x: 215, location: "ScBaBarApt", completedWeeks: [], created: Date.now() });
    myScene.close(); myScene.sound.mute(true);
  });
  const movement = await page.evaluate(async () => {
    const g = myScene;
    await g.street(1);
    const actors = g.actors.map(a => ({ actual: a.x, authored: a.STARTX, delayed: a.readyAt > g.e.clock }));
    const originalVoice = g.voice, clips = [];
    g.sound.stopVoice(); g.actorTalking = null;
    g.voice = async (_, fx) => { clips.push(fx); return null; };
    const actor = g.actors[0]; actor.readyAt = 0;
    for (const distance of [190, 80, 250]) {
      actor.x = g.p.x + distance; g.currentRender(g.e.clock, .001); await Promise.resolve();
    }
    const events = [actor.greeted, actor.chatted, actor.saidBye];
    g.voice = originalVoice;
    const start = g.p.x; g.target = start + 100; g.currentRender(g.e.clock, .1);
    return { actors, events, clips, moved: g.p.x - start, speed: g.doll.SPEED };
  });
  assert(movement.actors.every(a => a.actual === a.authored && a.delayed), "Authored actor scheduling");
  assert(movement.events.every(Boolean) && movement.clips.length === 3, "Greeting/chat/goodbye sequence");
  assert(Math.abs(movement.moved - movement.speed * .1) < .001, "Authored walking speed");

  await page.evaluate(() => { myScene.p.jumbles = {}; myScene.zine(1); });
  await page.getByRole("textbox", { name: "Word jumble 1 bank letter 1", exact: true }).dragTo(
    page.getByRole("textbox", { name: "Word jumble 1 answer letter 1", exact: true }));
  assert(await page.evaluate(() => myScene.p.jumbles[1][0][0] === "S"), "Drag letter into answer slot");
  let puzzles = 0;
  for (let week = 1; week <= 12; week++) {
    const words = await page.evaluate(week => {
      myScene.p.week = week; myScene.zine(week);
      const d = myScene.week;
      return d.PUZZLE_WORD.filter((_, i) => i % 3 === 1).map((word, i) => ({ word, mask: d.PUZZLE_WORD[i * 3 + 2] }));
    }, week);
    for (const [i, { word, mask }] of words.entries()) {
      for (let j = 0; j < word.length; j++) if (mask[j] !== "1" && word[j] !== " ")
        await page.getByRole("textbox", { name: `Word jumble ${i + 1} answer letter ${j + 1}`, exact: true }).fill(word[j]);
      puzzles++;
    }
    await page.getByRole("button", { name: "Check my words", exact: true }).click();
    assert((await page.locator("#status").textContent()).startsWith("All solved!"), `Week ${week} puzzle solutions`);
    const geometry = await page.evaluate(() => myScene.native.textFields.every(f => f.x >= 200 && f.x + f.w <= 601 && f.y + f.h <= 510));
    assert(geometry, `Week ${week} tile geometry`);
  }
  await page.evaluate(() => myScene.flush());
  const saved = await page.evaluate(async () => (await myScene.saves.all()).find(p => p.id === myScene.p.id).jumbles);
  assert(Object.keys(saved).length === 12, "All puzzle states saved");

  const help = await page.evaluate(async () => {
    const g = myScene, oldVoice = g.voice, contexts = [], missing = [];
    g.voice = (name, fx) => { if (!g.sound.key(name, fx)) missing.push(`${name}/${fx}`); };
    g.phone(); g.help(true); contexts.push(g.lastHelpContext);
    g.map(); g.help(true); contexts.push(g.lastHelpContext);
    await g.street(4); g.help(true); contexts.push(g.lastHelpContext);
    await g.go("ScCdClothesDes");
    for (const tab of ["Fasteners", "Stamps", "Trims"]) { g.activity(g.scene, {}).tab = tab; g.help(true); contexts.push(g.lastHelpContext); }
    await g.go("ScClClothesDt"); g.activity(g.scene, {}).top = "holding"; g.help(true); contexts.push(g.lastHelpContext);
    g.voice = oldVoice;
    return { contexts, missing };
  });
  assert(help.contexts.join(",") === "DctStIdlePhone,DctStHelpMap,DctStIdlePark,DctCdIdleFasteners,DctCdIdleStamps,DctCdIdleTrims,DctClGameIdleHold", "Context-specific help");
  assert(!help.missing.length, `Missing voice clips: ${help.missing}`);

  await page.evaluate(async () => { myScene.p.week = 1; await myScene.street(3); });
  await page.keyboard.down("Control");
  for (const key of "debug") await page.keyboard.press(key);
  await page.keyboard.up("Control");
  assert(await page.evaluate(() => myScene.debugMode), "Original Control+DEBUG activation");
  await page.keyboard.press("d");
  await page.waitForFunction(() => document.querySelector("#dialog").open && document.querySelectorAll("#dialog-hotspots button").length >= 20);
  await page.evaluate(() => myScene.close());
  await page.keyboard.press("2");
  await page.waitForFunction(() => myScene.p.week === 2 && document.querySelector("#loading").hidden);
  await page.keyboard.press("c");
  await page.waitForFunction(() => myScene.character === "Chelsea");
  await page.keyboard.press("w");
  assert(await page.evaluate(() => myScene.debugWalkSpeed === myScene.doll.SPEED + 1), "Developer speed shortcut");
  await page.evaluate(() => { myScene.debugMode = false; myScene.debugDoll = null; myScene.close(); });
  assert(!errors.length, errors.join("; "));
  return { puzzles, encounters: movement.events, helpContexts: help.contexts, developerMode: true, browserErrors: errors };
}
