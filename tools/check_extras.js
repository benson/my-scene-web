async (page) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const assert = (ok, message) => {
    if (!ok) throw new Error(message);
  };
  const close = async () => {
    if (await page.locator("#dialog").evaluate((d) => d.open))
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
  };
  await page.reload();
  await page.waitForFunction(() => window.myScene && document.querySelector("#loading").hidden);
  await page.evaluate(async () => {
    myScene.cancelMovie?.(); document.body.classList.add("show-controls");
    const profile = (await myScene.saves.all()).find(p => p.completedWeeks?.length === 12);
    if (!profile) throw new Error("Run the campaign check first");
    await myScene.load(profile);
  });
  await page.waitForFunction(
    () => myScene.p && document.querySelector("#loading").hidden,
  );
  await page.evaluate(() => {
    myScene.p = structuredClone(myScene.p);
    myScene.p.id = crypto.randomUUID();
    myScene.p.name = "Extras QA";
    myScene.save();
  });
  let quizOutcomes = 0,
    jumbles = 0,
    calls = 0;
  for (let week = 1; week <= 12; week++) {
    await page.evaluate((w) => {
      myScene.p.week = w;
      myScene.zine(w);
    }, week);
    const words = await page.evaluate(
      (w) =>
        myScene
          .d("DctTaskWk" + String(w).padStart(2, "0"))
          .PUZZLE_WORD.filter((_, i) => i % 3 === 1),
      week,
    );
    for (let i = 0; i < words.length; i++)
      await page
        .getByRole("textbox", { name: "Word jumble " + (i + 1), exact: true })
        .fill(words[i]);
    await page
      .getByRole("button", { name: "Check my words", exact: true })
      .click();
    assert(
      (await page.locator("#status").innerText()).startsWith("All solved!"),
      "Word jumble failed in week " + week,
    );
    jumbles += words.length;
    const quiz = await page.evaluate((w) => {
      const g = myScene,
        d = g.d("DctZineQuiz" + String(w).padStart(2, "0"));
      return {
        rows: g.r(d.NAME),
        outcomes: [d.SCOREBAD, d.SCOREOKAY, d.SCOREGOOD],
      };
    }, week);
    for (let outcome = 0; outcome < 3; outcome++) {
      await page.evaluate((w) => myScene.quiz(w), week);
      for (const q of quiz.rows) {
        const choice = [1, 2, 3].find((i) => q["PTS" + i] === outcome);
        await page
          .getByRole("button", { name: q["ANS" + choice], exact: true })
          .click();
      }
      assert(
        (await page.locator("#dialog-body").innerText())
          .replace(/\s+/g, " ")
          .includes(quiz.outcomes[outcome].replace(/\s+/g, " ")),
        "Wrong quiz outcome",
      );
      quizOutcomes++;
    }
    await page.evaluate(() => myScene.phone());
    const expected = await page.evaluate(() => ({
      messages: myScene.week.PHONE_MSG_TEXT_LONG || [],
      calls: myScene.week.PHONE_CALLS || [],
      from: myScene.week.PHONE_CALLS_TEXT || [],
      voice: myScene.week.PHONE_MSG_VO || [],
    }));
    for (const msg of expected.messages)
      assert(
        (await page.locator("#dialog-body").innerText()).includes(msg.trim()),
        "Missing phone message",
      );
    if (expected.calls.length) {
      await page
        .locator("#dialog-body")
        .getByRole("button", { name: "▶ " + expected.from[0], exact: true })
        .first()
        .click();
      calls += expected.calls.length;
    }
    const soundRefs = await page.evaluate(() =>
      [
        ...(myScene.week.PHONE_CALLS || []),
        ...(myScene.week.PHONE_MSG_VO || []),
      ].every((fx) => myScene.sound.key("VocZzCellMessages", fx)),
    );
    assert(soundRefs, "A phone voice is unavailable");
  }
  await close();
  for (const [area, label] of [
    [1, "Upper East Side"],
    [2, "The Village"],
    [3, "Downtown"],
    [4, "Parkside"],
  ]) {
    await page.getByRole("button", { name: "⌖ Map", exact: true }).click();
    await page
      .locator("#dialog-body")
      .getByRole("button", { name: label, exact: true })
      .click();
    await page.waitForFunction(
      () => document.querySelector("#overlay video")?.readyState >= 2,
    );
    await page.keyboard.press("Escape");
    await page.waitForFunction(
      (a) => myScene.p.area === a && document.querySelector("#loading").hidden,
      area,
    );
    const x = await page.evaluate(() => myScene.p.x);
    await page.keyboard.down("ArrowRight");
    await page.waitForFunction((x) => myScene.p.x > x + 5, x);
    await page.keyboard.up("ArrowRight");
    const destinations = await page
      .locator("#panel .stack")
      .getByRole("button")
      .allTextContents();
    for (const destination of destinations) {
      if (
        destination === "Subway" ||
        destination.includes("Zine") ||
        destination.includes("quiz")
      )
        continue;
      await page
        .locator("#panel")
        .getByRole("button", { name: destination, exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector("#loading").hidden,
      );
      assert(
        await page.locator("#panel h1").isVisible(),
        "Destination failed: " + destination,
      );
      await close();
      await page.evaluate((a) => myScene.street(a), area);
    }
  }
  await page.evaluate(() => myScene.street(1));
  const bird = await page.evaluate(() => {
    const g = myScene,
      items = g.r("DctStreetWorld1"),
      i = items.findIndex((x) => x.SPRITE.includes("Bird"));
    return { i, item: items[i] };
  });
  await page.evaluate(({ i, item }) => myScene.incidental(item, 1, i), bird);
  assert(
    await page.evaluate(({ i }) => myScene.animations.get("1:" + i)?.fly, bird),
    "Bird flight did not start",
  );
  const boy = await page.evaluate(
    () => myScene.actors.find((a) => a.ACTOR.includes("Boy"))?.ACTOR,
  );
  assert(boy, "No boy in the street");
  await page.evaluate(
    (n) => myScene.chat(myScene.actors.find((a) => a.ACTOR === n)),
    boy,
  );
  await page.getByRole("button", { name: "♡ Flirt", exact: true }).click();
  assert(
    await page.evaluate((n) => myScene.p.boys.includes(n), boy),
    "Boy picture not collected",
  );
  await close();
  await page.getByRole("button", { name: "▣ Camera", exact: true }).click();
  await page.waitForFunction(
    () => document.querySelector("#dialog-body img")?.complete,
  );
  const photoDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Download picture", exact: true })
    .click();
  await (await photoDownload).saveAs(".local/qa-photo.png");
  await page.evaluate(() => {
    const original = myScene.printImage;
    window.printCalls = 0;
    myScene.printImage = (...args) => {
      original(...args);
      document.querySelector("iframe").contentWindow.print = () =>
        window.printCalls++;
    };
  });
  await page
    .getByRole("button", { name: "Print picture", exact: true })
    .click();
  await page.waitForFunction(() => window.printCalls === 1);
  await close();
  await page.getByRole("button", { name: "♡ Scrapbook", exact: true }).click();
  assert(
    await page
      .getByRole("button", { name: "Weekend 12", exact: true })
      .isVisible(),
    "Scrapbook missing final weekend",
  );
  await page
    .getByRole("button", { name: "About the girls", exact: true })
    .click();
  for (const name of ["Barbie", "Chelsea", "Westley"]) {
    await page
      .locator("#dialog-body")
      .getByRole("button", { name, exact: true })
      .click();
    assert(
      (await page.locator(".biography").innerText()).includes(name),
      "Missing biography",
    );
  }
  await close();
  await page
    .getByRole("button", { name: "Save & options", exact: true })
    .click();
  await page
    .locator("#dialog-body")
    .getByRole("button", { name: "Credits", exact: true })
    .click();
  assert(
    (await page.locator(".credits-text").innerText()).includes(
      "Lead Programmer - Eric Laun",
    ),
    "Original credits missing",
  );
  await page.getByRole("button",{name:"Close credits",exact:true}).click();
  await page.evaluate(() => {
    myScene.p.week = 1;
    myScene.go("ScMmMusMix");
  });
  await page.waitForFunction(() => document.querySelector("#loading").hidden);
  await page
    .locator("#panel")
    .getByRole("button", { name: "Watch reference", exact: true })
    .click();
  await page.waitForFunction(
    () => document.querySelector("#overlay video")?.currentTime > 0,
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Mute sound", exact: true }).click();
  assert(
    await page.evaluate(
      () => myScene.sound.master.gain.value === 0 || myScene.sound.muted,
    ),
    "Mute failed",
  );
  await page.getByRole("button", { name: "Unmute sound", exact: true }).click();
  const browser = page.context().browser(),
    touch = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
  const mobile = await touch.newPage();
  await mobile.goto("http://127.0.0.1:4173/");
  await mobile
    .getByRole("textbox", { name: "Your name", exact: true })
    .fill("Touch QA");
  await mobile.getByRole("button", { name: "New game", exact: true }).click();
  await mobile.locator("#overlay video").tap();
  await mobile.getByRole("button", { name: "Skip cutscene", exact: true }).tap();
  await mobile
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await mobile
    .locator("#panel")
    .getByRole("button", { name: "Go outside", exact: true })
    .click();
  await mobile.waitForFunction(
    () =>
      myScene.scene === "ScStStreet" &&
      document.querySelector("#loading").hidden,
  );
  const beforeX = await mobile.evaluate(() => myScene.p.x),
    rect = await mobile.locator("#stage").boundingBox();
  await mobile.touchscreen.tap(
    rect.x + rect.width * 0.76,
    rect.y + rect.height * 0.83,
  );
  await mobile.waitForFunction((x) => myScene.p.x > x + 5, beforeX);
  assert(
    await mobile.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Mobile horizontal overflow",
  );
  await mobile.screenshot({ path: ".local/mobile.png" });
  await touch.close();
  await page.route("**/assets/game-data.json", (route) => route.abort());
  await page.reload();
  await page
    .getByRole("heading", { name: "Let’s try that again", exact: true })
    .waitFor();
  await page.unroute("**/assets/game-data.json");
  await page.getByRole("button", { name: "Reload game", exact: true }).click();
  await page
    .getByRole("heading", { name: "Make it your scene", exact: true })
    .waitFor();
  assert(errors.length === 0, "Browser errors: " + errors.join("; "));
  return {
    quizOutcomes,
    jumbles,
    calls,
    world: "4 areas, doors, walking, subway, birds, boys",
    keepsakes: "camera, download, print, scrapbook, biographies",
    media: "reference movie, original credits, mute",
    mobile: "real touch input at 390px; no overflow",
    loading: "failure and recovery",
    errors,
  };
};
