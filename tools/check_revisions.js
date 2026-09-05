async (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const assert = (ok, message) => { if (!ok) throw new Error(message); };
  const button = (name) => page.locator("#panel").getByRole("button", { name, exact: true });
  await page.reload();
  await page.getByRole("button", { name: "Details QA · Weekend 1", exact: true }).first().click();
  await page.waitForFunction(() => myScene.p && document.querySelector("#loading").hidden);
  await page.evaluate(async () => {
    const g = myScene;
    g.close();
    g.p.id = crypto.randomUUID();
    g.p.name = "Revisions QA";
    g.p.weeks = {};
    g.p.money = 100;
    delete g.p.activities["1:ScAcAccess"];
    await g.go("ScAcAccess");
  });
  const choice = await page.evaluate(() => {
    const g = myScene, s = g.activity("ScAcAccess", {}),
      d = g.r("DctAccessParams" + g.pre).find(r => r.CONTTYPE === s.category),
      items = g.r(d.CONTDICT), target = s.rounds[s.category].target,
      answer = items[target], wrong = items.findIndex(x => x.ATTRIB1 !== answer.ATTRIB1 || x.ATTRIB2 !== answer.ATTRIB2);
    return { target, wrong, category: ["Earrings", "Hair clips", "Necklaces", "Sunglasses"][s.category], cat: s.category };
  });
  await button(choice.category + " " + (choice.wrong + 1)).click();
  for (let i = 0; i < 5; i++) await button("Guess").click();
  assert(await page.evaluate(cat => myScene.activity("ScAcAccess", {}).rounds[cat].attempts.length === 4, choice.cat), "Guess limit failed");
  await button("Try again").click();
  await button(choice.category + " " + (choice.target + 1)).click();
  await button("Guess").click();
  await button(choice.category + " " + (choice.wrong + 1)).click();
  await button("Buy · $10").click();
  assert(await page.evaluate(() => myScene.p.money === 100), "Wrong selection could be bought after correct guess");
  await button(choice.category + " " + (choice.target + 1)).click();
  await button("Buy · $10").click();
  assert(await page.evaluate(() => myScene.p.money === 90), "Correct selection could not be purchased after retry");
  await page.evaluate(async () => {
    const g = myScene;
    await g.photo(g.p.designs.find(d => d.type === "clothes" && d.state));
  });
  await page.getByRole("button", { name: "Edit this design", exact: true }).click();
  await page.waitForFunction(() => document.querySelector("#loading").hidden);
  assert(await page.evaluate(() => Object.keys(myScene.activity("ScCdClothesDes", {}).fills).length > 0), "Saved design lost fills when reopened");
  await button("Stamps").click();
  await button("Stamps 2").click();
  await button("Place decoration in center").click();
  assert(await page.evaluate(() => myScene.activity("ScCdClothesDes", {}).marks.some(m => m.id === "AniCdStamp02")), "Reopened design cannot be edited");
  await page.evaluate(async () => {
    const g = myScene;
    await g.photo(g.p.designs.find(d => d.src));
    g.download = async (blob) => {
      window.qaPng = Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0, 8));
    };
  });
  await page.locator("#dialog-body").getByRole("button", { name: "Download picture", exact: true }).click();
  await page.waitForFunction(() => window.qaPng);
  assert((await page.evaluate(() => qaPng)).join(",") === "137,80,78,71,13,10,26,10", "Download is not PNG encoded");
  assert(errors.length === 0, errors.join("; "));
  return { guesses: "four attempts, retry, selection invalidation, purchase", savedDesign: "reopen and edit", picture: "PNG signature verified", errors };
}
