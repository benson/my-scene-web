async (page) => {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  const assert = (value, message) => {
    if (!value) throw new Error(message);
  };
  const p = page.locator("#panel"),
    button = (name) => p.getByRole("button", { name, exact: true });
  const enter = async (scene) => {
    await page.evaluate((s) => myScene.go(s), scene);
    await page.waitForFunction(() => document.querySelector("#loading").hidden);
  };
  const canvasPoint = async (x, y) => {
    const b = await page.locator("#stage").boundingBox();
    return { x: b.x + (x * b.width) / 800, y: b.y + (y * b.height) / 600 };
  };
  const clickPoint = async (x, y) => {
    const pt = await canvasPoint(x, y);
    await page.mouse.click(pt.x, pt.y);
  };
  await page.reload();
  await page
    .getByRole("button", { name: "QA · Weekend 12", exact: true })
    .click();
  await page.waitForFunction(
    () => myScene.p && document.querySelector("#loading").hidden,
  );
  await page.evaluate(() => {
    const g = myScene;
    g.close();
    g.p.id = crypto.randomUUID();
    g.p.name = "Details QA";
    g.p.week = 2;
    g.p.money = 100;
    g.p.activities = {};
    g.save();
  });
  await enter("ScWdWinDress");
  const answer = await page.evaluate(() => {
    const g = myScene,
      s = g.activity("ScWdWinDress", {}),
      b = g.d(g.week.WINDOW_DRESS_DICT[s.brief]),
      inventory = g.r("DctWdInvFashion").filter((x) => x.ICON);
    return {
      top: b.CORRECT_TOP.find((n) => inventory.some((x) => x.CURSOR === n)),
      bottom: b.CORRECT_BOTTOM.find((n) =>
        inventory.some((x) => x.CURSOR === n),
      ),
      trim: b.CORRECT_TRIM[0],
      inventory,
    };
  });
  await button("Done · check my work").click();
  assert(
    await page
      .getByRole("heading", { name: "Let’s make a few changes" })
      .isVisible(),
    "Empty window should fail",
  );
  await page
    .getByRole("button", { name: "Keep designing", exact: true })
    .click();
  for (let i = 0; i < 6; i++) {
    const id = i < 3 ? answer.top : answer.bottom,
      index = answer.inventory.findIndex((x) => x.CURSOR === id);
    await button("Clothes " + (index + 1)).click();
    await button("Spot " + (i + 1)).click();
  }
  await button("Trims").click();
  await button("Trims " + Number(answer.trim.match(/\d+$/)[0])).click();
  const a = await canvasPoint(480, 350),
    b = await canvasPoint(650, 350);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(b.x, b.y, { steps: 10 });
  await page.mouse.up();
  assert(
    await page.evaluate(
      () => myScene.activity("ScWdWinDress", {}).marks.length > 3,
    ),
    "Trim dragging did not create a chain",
  );
  await button("Move").click();
  const from = await canvasPoint(480, 350),
    to = await canvasPoint(490, 390);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 4 });
  await page.mouse.up();
  assert(
    await page.evaluate(
      () => myScene.activity("ScWdWinDress", {}).marks[0].y > 375,
    ),
    "Moving decoration failed",
  );
  await button("Eraser").click();
  const before = await page.evaluate(
    () => myScene.activity("ScWdWinDress", {}).marks.length,
  );
  await clickPoint(490, 390);
  assert(
    (await page.evaluate(
      () => myScene.activity("ScWdWinDress", {}).marks.length,
    )) ===
      before - 1,
    "Erasing decoration failed",
  );
  await button("Undo").click();
  await page.waitForFunction(() => document.querySelector("#loading").hidden);
  assert(
    (await page.evaluate(
      () => myScene.activity("ScWdWinDress", {}).marks.length,
    )) === before,
    "Undo failed",
  );
  await button("Done · check my work").click();
  assert(
    await page.getByRole("heading", { name: "Fabulous work!" }).isVisible(),
    "Valid window did not pass",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: ".local/window.png" });
  assert(
    await page.evaluate(
      () => myScene.p.money === 140 && Boolean(myScene.p.latestWindow),
    ),
    "Window payment or storefront persistence failed",
  );
  await page.evaluate(() => myScene.street(1));
  await page.waitForFunction(() => document.querySelector("#loading").hidden);
  await page.evaluate(() => {
    myScene.p.x = 250;
    myScene.target = 250;
  });
  await page.screenshot({ path: ".local/storefront.png" });
  await page.evaluate(() => {
    myScene.p.week = 1;
    myScene.save();
  });
  await enter("ScCdClothesDes");
  await p.getByLabel("Sketch").selectOption("DctScDesign09");
  await page.waitForFunction(() => document.querySelector("#loading").hidden);
  await button("Fabrics 30").click();
  const region = await page.evaluate(() => {
    const g = myScene,
      d = g.d("DctScDesign09"),
      part = d.FORMS[1],
      f = g.e.effect(part),
      c = document.createElement("canvas");
    c.width = 800;
    c.height = 600;
    g.e.draw(part, "Still", { ctx: c.getContext("2d"), dx: 357, dy: 7 });
    const pixels = c.getContext("2d").getImageData(0, 0, 800, 600).data;
    for (let y = 10; y < 515; y++)
      for (let x = 360; x < 790; x++)
        if (pixels[(y * 800 + x) * 4 + 3] === 255) return { x, y };
  });
  await clickPoint(region.x, region.y);
  assert(
    await page.evaluate(() =>
      Object.values(myScene.activity("ScCdClothesDes", {}).fills).includes(
        "AniCdFabric30",
      ),
    ),
    "Pointer fabric fill failed",
  );
  const parts = await p.getByLabel("Garment section").locator("option").count();
  for (let i = 0; i < parts; i++) {
    await p.getByLabel("Garment section").selectOption(String(i));
    await button("Fill selected section").click();
  }
  await button("Fasteners").click();
  await button("Fasteners 1").click();
  await clickPoint(570, 260);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: ".local/design.png" });
  await button("Done · check my work").click();
  assert(
    await page.getByRole("heading", { name: "Fabulous work!" }).isVisible(),
    "Valid fashion design failed",
  );
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await enter("ScMmMusMix");
  await button("▶ Play").click();
  await page.waitForFunction(() => myScene.sound.sources.length === 4);
  await p.locator("select").nth(1).selectOption("2");
  await button("Done · check my mix").click();
  assert(
    (await page.locator("#status").innerText()).includes(
      "/4 instruments match",
    ),
    "Wrong mix feedback absent",
  );
  await button("■ Stop").click();
  await button("● Record").click();
  await page.waitForFunction(() => myScene.sound.sources.length === 4);
  await button("Pad 1").click();
  await p.locator("select").nth(1).selectOption("0");
  await button("Pad 9").click();
  await button("■ Stop").click();
  const recording = await page.evaluate(
    () => myScene.activity("ScMmMusMix", {}).recording,
  );
  assert(
    recording.events.some((e) => e.pad) &&
      recording.events.filter((e) => e.tracks).length > 1,
    "Recording did not preserve pads and changes",
  );
  await button("Play recording").click();
  const audioDownload = page.waitForEvent("download");
  await button("Export WAV").click();
  const audio = await audioDownload;
  await audio.saveAs(".local/qa-mix.wav");
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: ".local/music.png" });
  await page
    .getByRole("button", { name: "Save & options", exact: true })
    .click();
  const saveDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Save file", exact: true }).click();
  const save = await saveDownload;
  await save.saveAs(".local/qa-save.json");
  await page.evaluate(() => myScene.importSave(false));
  await page.locator("#save-import").setInputFiles(".local/qa-save.json");
  await page.waitForFunction(
    () =>
      document.querySelector("#status").textContent === "Saved game imported.",
  );
  assert(
    await page.evaluate(
      () => myScene.activity("ScMmMusMix", {}).recording.events.length > 2,
    ),
    "Import lost recording",
  );
  await page.evaluate(() => myScene.flush());
  await page.reload();
  await page
    .getByRole("button", { name: "Details QA · Weekend 1", exact: true })
    .first()
    .click();
  await page.waitForFunction(
    () => myScene.p && document.querySelector("#loading").hidden,
  );
  assert(
    await page.evaluate(
      () =>
        myScene.p.designs.some((d) => d.type === "window") &&
        myScene.p.activities["1:ScCdClothesDes"].fills,
    ),
    "Reload lost artwork",
  );
  assert(failures.length === 0, "Browser errors: " + failures.join("; "));
  return {
    window: "fill, trim, move, erase, undo, payment, storefront",
    clothes: "pointer fill, sections, decoration, payment",
    music: "mix, mismatch, record changes and pads, playback, WAV export",
    save: "export, import, reload",
    errors: failures,
  };
};
