async (page) => {
  const failures = [];
  page.on("pageerror", (error) => failures.push(error.message));
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const panel = page.locator("#panel");
  const button = (name) => panel.getByRole("button", { name, exact: true });
  const enter = async (scene) => {
    await page.evaluate(async (scene) => {
      await window.myScene.go(scene);
    }, scene);
    await page.waitForFunction(() => document.querySelector("#loading").hidden);
  };
  const ready = async () =>
    page.evaluate(() => ({
      week: myScene.p.week,
      money: myScene.p.money,
      done: myScene.progress.done.length,
      complete: myScene.complete,
    }));
  const reports = [];
  for (let weekend = (await ready()).week; weekend <= 12; weekend++) {
    const start = await ready();
    check(
      start.week === weekend,
      `Expected weekend ${weekend}, got ${start.week}`,
    );
    if (start.money < (5 - start.done) * 10) {
      const job = await page.evaluate(() =>
        ["ScMmMusMix", "ScCdClothesDes", "ScWdWinDress"].find((s) =>
          myScene.canEnter(s),
        ),
      );
      await enter(job);
      if (job === "ScMmMusMix") {
        const answers = await page.evaluate(() => {
          const g = myScene,
            s = g.activity("ScMmMusMix", {}),
            d = g.d(g.week.MUSIC_MIX[s.brief]),
            n = d.TEMPLATE.length;
          const rows = Array.from({ length: d.FORMS.length / n }, (_, i) =>
            Object.fromEntries(
              d.TEMPLATE.map((k, j) => [k, d.FORMS[i * n + j]]),
            ),
          );
          return [1, 2, 3, 4].map((k) =>
            rows.findIndex((r) => r["CORRECT" + k]),
          );
        });
        for (let i = 0; i < 4; i++)
          await panel.locator("select").nth(i).selectOption(String(answers[i]));
        await button("Done · check my mix").click();
      } else if (job === "ScCdClothesDes") {
        const solution = await page.evaluate(() => {
          const g = myScene,
            s = g.activity("ScCdClothesDes", {}),
            b = g.d(g.week.CLOTHING_DESIGN_DICT[s.brief]);
          return {
            design: b.DESIGN_CORRECT[0],
            fabric: (b.CORRECT_FABRIC || [])[0] || "AniCdFabric30",
            fast: (b.CORRECT_FASTENER || [])[0],
            stamp: (b.CORRECT_STAMP || [])[0],
            trim: (b.CORRECT_TRIM || [])[0],
          };
        });
        await panel.locator("select").first().selectOption(solution.design);
        await page.waitForFunction(
          () => document.querySelector("#loading").hidden,
        );
        await button("Fabrics").click();
        const fabric = Number(solution.fabric.match(/\d+$/)[0]);
        await button("Fabrics " + fabric).click();
        const count = await panel
          .getByLabel("Garment section")
          .locator("option")
          .count();
        for (let i = 0; i < count; i++) {
          await panel.getByLabel("Garment section").selectOption(String(i));
          await button("Fill selected section").click();
        }
        for (const [kind, id] of [
          ["Fasteners", solution.fast],
          ["Stamps", solution.stamp],
          ["Trims", solution.trim],
        ])
          if (id) {
            await button(kind).click();
            await button(kind + " " + Number(id.match(/\d+$/)[0])).click();
            await button("Place decoration in center").click();
          }
        await button("Done · check my work").click();
        check(
          await page
            .getByRole("heading", { name: "Fabulous work!" })
            .isVisible(),
          "Clothing job failed",
        );
        await page
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
      } else {
        const answer = await page.evaluate(() => {
          const g = myScene,
            s = g.activity("ScWdWinDress", {}),
            b = g.d(g.week.WINDOW_DRESS_DICT[s.brief]);
          return {
            top: b.CORRECT_TOP[0],
            bottom: b.CORRECT_BOTTOM[0],
            trim: b.CORRECT_TRIM[0],
            stamp: b.CORRECT_STICKER[0],
            inventory: g.r("DctWdInvFashion").filter((x) => x.ICON),
          };
        });
        for (let i = 0; i < 6; i++) {
          const id = i < 3 ? answer.top : answer.bottom,
            index = answer.inventory.findIndex((x) => x.CURSOR === id);
          check(index >= 0, "Window solution missing from inventory");
          await button("Clothes " + (index + 1)).click();
          await button("Spot " + (i + 1)).click();
        }
        for (const [kind, id] of [
          ["Trims", answer.trim],
          ["Letters & stamps", answer.stamp],
        ])
          if (id) {
            await button(kind).click();
            await button(kind + " " + Number(id.match(/\d+$/)[0])).click();
            await button("Place decoration in center").click();
          }
        await button("Done · check my work").click();
        check(
          await page
            .getByRole("heading", { name: "Fabulous work!" })
            .isVisible(),
          "Window job failed",
        );
        await page
          .getByRole("button", { name: "Close dialog", exact: true })
          .click();
      }
      const earned = await ready();
      check(
        earned.money === start.money + 40,
        `Weekend ${weekend}: job did not pay $40`,
      );
    }
    const tasks = await page.evaluate(() => myScene.tasks);
    for (let taskIndex = 0; taskIndex < tasks.length; taskIndex++) {
      const task = tasks[taskIndex];
      if (
        await page.evaluate((i) => myScene.progress.done.includes(i), taskIndex)
      )
        continue;
      await enter(task.SCENE);
      if (task.SCENE === "ScAcAccess" || task.SCENE === "ScMuMakeUp") {
        const categories =
          task.SCENE === "ScAcAccess"
            ? ["Earrings", "Hair clips", "Necklaces", "Sunglasses"]
            : ["Lipstick", "Eye shadow"];
        await button(categories[task.DATA]).click();
        await page.waitForFunction(
          () => document.querySelector("#loading").hidden,
        );
        const target = await page.evaluate(
          (scene) =>
            myScene.activity(scene, {}).rounds[
              myScene.activity(scene, {}).category
            ].target,
          task.SCENE,
        );
        await button(categories[task.DATA] + " " + (target + 1)).click();
        await button("Guess").click();
        await button("Buy · $10").click();
      } else if (task.SCENE.startsWith("ScClClothes")) {
        const correct = await page.evaluate((scene) => {
          const g = myScene,
            w = g.week;
          const dict = {
            ScClClothesDt: "DctClClothingDt",
            ScClClothesUe: "DctClClothingUe",
            ScClClothesVil: "DctClClothingVil",
          }[scene];
          return g.itemLabel(
            w.CLOTHING_STORE_TOP === dict ? w.CLOTHING_TOP : w.CLOTHING_BOTTOM,
          );
        }, task.SCENE);
        await button(correct).click();
        await button("Model this look").click();
        await button("Buy · $10 each").click();
      } else if (task.SCENE === "ScGtGift" || task.SCENE === "ScFdFood") {
        const food = task.SCENE === "ScFdFood",
          answers = await page.evaluate(
            ({ scene, food }) => {
              const g = myScene,
                code = food ? "Fd" : "Gt",
                task = g.taskFor(scene)[0],
                content = g.d(g.r("Dct" + code + "ContentIdx")[task.DATA].DICT);
              return content.ANSWERS.map((s) => Number(s.match(/\d+$/)[0]));
            },
            { scene: task.SCENE, food },
          );
        const questions = panel.locator(".quiz-answer");
        for (let i = 0; i < (await questions.count()); i++)
          await questions.nth(i).click();
        for (const answer of answers)
          await button((food ? "Food " : "Gift ") + answer).click();
        await button("Buy selection · $10").click();
      } else if (task.SCENE === "ScCsCDShop") {
        const answer = await page.evaluate(() => {
          const s = myScene.activity("ScCsCDShop", {});
          return s.tracks.indexOf(s.target);
        });
        await button("Hear humming clue").click();
        await button("CD " + (answer + 1)).click();
        await button("Buy · $10").click();
      } else throw new Error("Uncovered task scene " + task.SCENE);
      const completed = await page.evaluate(
        (i) => myScene.progress.done.includes(i),
        taskIndex,
      );
      check(
        completed,
        `Weekend ${weekend}, task ${taskIndex + 1} did not complete`,
      );
    }
    const state = await ready();
    check(state.complete, "Weekend tasks are incomplete");
    await page.getByRole("button", { name: "☷ To-do", exact: true }).click();
    await page
      .getByRole("button", {
        name: "Everything’s ready — go to the event!",
        exact: true,
      })
      .click();
    for (let photo = 0; photo < 4; photo++)
      await page.getByRole("button", { name: "Next →", exact: true }).click();
    await page.waitForFunction(
      (w) => myScene.p.week === Math.min(12, w + 1),
      weekend,
    );
    reports.push({ weekend, tasks: state.done, money: state.money });
    if (weekend < 12 && (await page.locator("#dialog").evaluate((d) => d.open)))
      await page
        .getByRole("button", { name: "Close dialog", exact: true })
        .click();
  }
  check(failures.length === 0, "Browser errors: " + failures.join("; "));
  await page.evaluate(() => myScene.flush());
  return {
    reports,
    errors: failures,
    completed: await page.evaluate(() => myScene.p.completedWeeks),
  };
};
