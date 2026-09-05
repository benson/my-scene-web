async page => {
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  await page.reload();
  await page.waitForFunction(() => window.myScene && document.querySelector("#loading").hidden);
  await page.evaluate(async () => {
    await myScene.load({ version: 1, id: crypto.randomUUID(), name: "Interface QA", week: 1, money: 100,
      weeks: {}, activities: {}, designs: [], photos: [], boys: [], quizzes: {}, jumbles: {},
      area: 3, x: 215, location: "ScBaBarApt", completedWeeks: [], created: Date.now() });
    myScene.close(); myScene.sound.mute(true);
    window.movieDone = 0;
    myScene.movie("intro", () => window.movieDone++);
  });
  await page.waitForFunction(() => document.querySelector("video")?.currentTime > .1);
  assert(await page.evaluate(() => !document.querySelector("video").controls && getComputedStyle(document.querySelector(".video-close")).opacity === "0"), "Cutscene starts without browser chrome");
  await page.keyboard.press("Escape");
  assert(await page.evaluate(() => movieDone === 1 && document.querySelector("#overlay").hidden && !document.querySelector("#dialog").open), "Escape skips once without opening options");
  await page.evaluate(() => myScene.movie("intro", () => movieDone++));
  const overlay = page.locator("#overlay");
  const box = await overlay.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.getByRole("button", { name: "Skip cutscene", exact: true }).click();
  assert(await page.evaluate(() => movieDone === 2), "Pointer skip advances");
  await page.evaluate(() => { myScene.movie("intro", () => movieDone++); document.querySelector("video").dispatchEvent(new Event("ended")); });
  assert(await page.evaluate(() => movieDone === 3), "Movie completion advances");
  await page.evaluate(() => {
    window.realPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = () => Promise.reject(new DOMException("Blocked", "NotAllowedError"));
    myScene.movie("intro");
  });
  await page.getByRole("button", { name: "Play", exact: true }).waitFor({state:"visible"});
  await page.evaluate(() => { HTMLMediaElement.prototype.play = window.realPlay; });
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("video")?.currentTime > .1);
  await page.keyboard.press("Escape");
  await page.evaluate(() => myScene.options());
  await page.getByRole("button", { name: "Video playback controls: hidden", exact: true }).click();
  await page.evaluate(() => { myScene.close(); myScene.movie("intro"); });
  assert(await page.evaluate(() => document.querySelector("video").controls), "Options enables playback controls");
  await page.keyboard.press("Escape");
  await page.evaluate(async () => { myScene.movieControls = false; await myScene.street(1); myScene.phone(); });
  const labels = ["To-do list", "Messages", "Close phone"];
  const buttons = [];
  for (const label of labels) buttons.push(await page.locator("#dialog-hotspots").getByRole("button", { name: label, exact: true }).boundingBox());
  assert(buttons.every((b, i) => b && (!i || b.x >= buttons[i-1].x + buttons[i-1].width - .5)), "Phone hit regions do not overlap");
  for (const label of labels.slice(0, 2)) await page.locator("#dialog-hotspots").getByRole("button", {name:label,exact:true}).click();
  await page.waitForFunction(() => document.querySelectorAll("#dialog-hotspots button").length === 6);
  await page.getByRole("button", {name:"From Gina",exact:true}).click();
  await page.getByRole("button", {name:"Back to phone list",exact:true}).click();
  await page.evaluate(() => { myScene.progress.done = [0,1]; myScene.progress.heardCalls = []; myScene.phone(); });
  assert(await page.evaluate(() => document.querySelector("#dialog-body").textContent.includes("Incoming Call") && myScene.progress.heardCalls.includes(0)), "Ringing phone opens the unheard call");
  await page.getByRole("button", {name:"Replay call",exact:true}).click();
  await page.screenshot({path:".local/interface-phone.png"});
  await page.getByRole("button", {name:"Close phone",exact:true}).click();
  assert(await page.evaluate(() => !document.querySelector("#dialog").open), "Phone closes");
  const stage = await page.locator("#stage").boundingBox();
  await page.mouse.move(stage.x + stage.width * .5, stage.y + stage.height * .1);
  await page.waitForFunction(() => document.querySelector("#stage").style.cursor === "default");
  await page.mouse.move(stage.x + stage.width * .5, stage.y + stage.height * .85);
  await page.waitForFunction(() => document.querySelector("#stage").style.cursor.startsWith("url("));
  const hoverBox = await page.evaluate(() => {
    const b = document.querySelector("#hotspots button");
    return getComputedStyle(b).boxShadow;
  });
  assert(hoverBox === "none", "No generic hotspot border");
  assert(!errors.length, errors.join("\n"));
  return { passed: true, checks: "Cutscene playback, Escape/click/end, autoplay recovery, optional controls, phone targets, pavement cursor", errors };
}
