async (page) => {
  // A disposable profile and fixed animation time make visual review repeatable.
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.setViewportSize({ width: 1280, height: 900 });
  // Playwright routing disables the HTTP cache for this visual review session.
  await page.route("**/*", route => route.continue());
  await page.reload();
  await page.waitForFunction(() => window.myScene && document.querySelector("#loading").hidden);
  const capture = async (name) => {
    await page.waitForFunction(() => document.querySelector("#loading").hidden);
    await page.evaluate(async () => {
      myScene.sound.mute(true);
      myScene.e.motion = false;
      await Promise.allSettled([...myScene.e.pending.values()]);
      scrollTo(0, 0);
    });
    await page.waitForTimeout(200);
    await page.mouse.move(1, 1);
    await page.screenshot({ path: `.local/visuals/${name}.png` });
  };
  await capture("01-signin");
  await page.evaluate(async () => {
    const g = myScene;
    await g.load({ version: 1, id: crypto.randomUUID(), name: "Visual QA", week: 1, money: 100,
      weeks: {}, activities: {}, designs: [], photos: [], boys: [], quizzes: {}, jumbles: {},
      area: 3, x: 215, location: "ScBaBarApt", completedWeeks: [], created: Date.now() });
  });
  for (const [i, who] of ["Barbie", "Chelsea", "Madison"].entries()) {
    await page.evaluate(who => myScene.apartment(who), who);
    await capture(`02-${i}-${who}-apartment`);
  }
  for (let area = 1; area <= 4; area++) {
    await page.evaluate(async a => {
      await myScene.street(a);
      myScene.p.x = a === 4 ? 574 : 1200;
      myScene.target = myScene.p.x;
    }, area);
    await capture(`03-street-${area}`);
  }
  for (const scene of ["ScClClothesDt", "ScClClothesUe", "ScClClothesVil", "ScAcAccess", "ScMuMakeUp", "ScGtGift", "ScFdFood", "ScCsCDShop", "ScCdClothesDes", "ScWdWinDress", "ScMmMusMix"]) {
    await page.evaluate(scene => myScene.go(scene), scene);
    await capture(`04-${scene}`);
  }
  await page.evaluate(async () => { await myScene.street(3); myScene.p.x = 1200; myScene.target = 1200; });
  for (const method of ["map", "todo", "phone", "zine", "scrapbook", "musicLibrary", "options", "credits"]) {
    await page.evaluate(method => { myScene.close(); return myScene[method](); }, method);
    await capture(`05-${method}`);
  }
  await page.evaluate(() => myScene.close());
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("06-mobile-street");
  await page.evaluate(() => myScene.signin());
  await capture("06-mobile-signin");
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.evaluate(async () => {
    const g = myScene, profile = (await g.saves.all()).find(p => p.name === "Visual QA");
    profile.name = "Alexandria WWWWWWWWWWWWWWWWWWWW".slice(0, 30);
    await g.saves.put(profile);
    await g.signin();
  });
  await capture("07-signin-long-name");
  if (errors.length) throw new Error(errors.join("; "));
  return { screenshots: 30, browserErrors: errors };
}
