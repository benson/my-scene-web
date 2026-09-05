async page => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const assert = (value, message) => { if (!value) throw new Error(message); };
  await page.reload();
  await page.waitForFunction(() => window.myScene && document.querySelector("#loading").hidden);
  await page.evaluate(async () => {
    myScene.cancelMovie?.();
    window.storyVoice = myScene.voice;
    window.spoken = [];
    myScene.voice = async (name, fx) => { spoken.push([name,fx]); };
    const base = {version:1,week:1,money:40,weeks:{},activities:{},designs:[],photos:[],boys:[],quizzes:{},jumbles:{},area:4,x:400,location:"ScStStreet",completedWeeks:[],created:Date.now()};
    for (let i = 0; i < 10; i++) await myScene.saves.put({...base,id:`story-qa-${i}`,name:`Player ${i}`});
    await myScene.signin();
  });
  const hits = page.locator("#hotspots"), modal = page.locator("#dialog-hotspots");
  for (let i = 0; i < 24 && !(await hits.getByRole("button", {name:"Select Player 9",exact:true}).count()); i++) {
    const before = await hits.getByRole("button", {name:/^Select /}).evaluateAll(nodes=>nodes.map(b=>b.getAttribute("aria-label")).sort().join("|"));
    await hits.getByRole("button", {name:"Scroll player names down",exact:true}).click();
    await page.waitForFunction(labels => [...document.querySelectorAll("#hotspots button")].map(b=>b.getAttribute("aria-label")).filter(s=>s?.startsWith("Select ")).sort().join("|") !== labels, before);
  }
  await hits.getByRole("button", {name:"Select Player 9",exact:true}).click();
  assert(await page.evaluate(() => !myScene.p && document.querySelector("#signin-name").value === "Player 9"), "Selecting a name must not load it");
  await hits.getByRole("button", {name:"Delete selected player",exact:true}).click();
  await modal.getByRole("button", {name:"No",exact:true}).click();
  assert(await page.evaluate(async () => (await myScene.saves.all()).some(p => p.id === "story-qa-9")), "Cancel delete preserves profile");
  await page.screenshot({path:".local/story-signin.png"});
  await hits.getByRole("button", {name:"Continue saved game",exact:true}).click();
  await page.waitForFunction(() => myScene.p?.id === "story-qa-9");
  await page.evaluate(async () => { myScene.close(); await myScene.beginTutorial(); });
  assert(await page.evaluate(() => myScene.p.area === 4 && myScene.p.tutorial === "openPhone"), "Opening narration starts in Parkside");
  await page.evaluate(() => myScene.phone());
  await modal.getByRole("button", {name:"Close phone",exact:true}).click();
  await page.waitForFunction(() => myScene.p.tutorial === "ringing");
  await page.evaluate(() => myScene.phone());
  assert(await page.evaluate(() => myScene.p.tutorial === "done" && myScene.progress.heardCalls.includes("intro")), "Intro call finishes tutorial");
  await modal.getByRole("button", {name:"Close phone",exact:true}).click();
  assert(await page.evaluate(() => ["Intro","HelpOpenPhoneIntro","HelpGettingAround","PhoneRing"].every(fx => spoken.some(v => v[1] === fx))), "Tutorial uses authored voiceover sequence");
  await page.evaluate(async () => {
    myScene.p.money = 39;
    window.unaffordable = await myScene.purchase("ScClClothesDt", "qa-top");
  });
  assert(await page.evaluate(() => !unaffordable && myScene.p.money === 39), "Clothing requires $40");
  await page.evaluate(async () => { myScene.close(); myScene.p.money = 50; await myScene.purchase("ScClClothesDt","qa-top"); });
  assert(await page.evaluate(() => myScene.p.money === 10), "Clothing deducts $40");
  await page.evaluate(async () => { await myScene.purchase("ScAcAccess","qa-item"); });
  assert(await page.evaluate(() => myScene.p.money === 0), "Other shops deduct $10");
  await page.evaluate(async () => {
    myScene.progress.done = myScene.tasks.map((_,i) => i);
    await myScene.finishWeekend();
  });
  await modal.getByRole("button", {name:"Save scrapbook page",exact:true}).waitFor();
  assert(await page.evaluate(() => myScene.recapAlbum === 1 && myScene.p.week === 1), "Narrated recap opens album before advancing");
  await page.evaluate(() => {
    window.savedPage = null; window.printedPage = null;
    myScene.download = blob => { window.savedPage = {size:blob.size,type:blob.type}; };
    myScene.printImage = data => { window.printedPage = data; };
  });
  await modal.getByRole("button", {name:"Save scrapbook page",exact:true}).click();
  await page.waitForFunction(() => savedPage?.size > 1000);
  await modal.getByRole("button", {name:"Print scrapbook page",exact:true}).click();
  assert(await page.evaluate(() => printedPage.startsWith("data:image/png;base64,")), "Print receives rendered scrapbook page");
  await modal.getByRole("button", {name:"Scrapbook help",exact:true}).click();
  assert(await page.evaluate(() => !!myScene.lastHelpClip && document.querySelector("#dialog").getAttribute("aria-label") === "My scrapbook"), "Scrapbook help speaks without leaving the album");
  await page.screenshot({path:".local/story-album.png"});
  await modal.getByRole("button", {name:"Close scrapbook",exact:true}).click();
  await page.waitForFunction(() => myScene.p.week === 2);
  assert(await page.evaluate(() => myScene.p.money === 40 && !myScene.p.recapPending), "Album close advances once and resets wallet");
  await page.evaluate(() => { myScene.voice = window.storyVoice; myScene.close(); });
  assert(!errors.length, errors.join("\n"));
  return {passed:true,checks:"Sign-in scrolling/selection/delete cancellation; tutorial; economy; recap; scrapbook save/print",errors};
}
