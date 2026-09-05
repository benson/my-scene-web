import { rows, pad, esc, plain } from "./engine.mjs";
import { installCutscenes } from "./cutscenes.mjs";

export function installExtras(g) {
  const e = g.e;
  installCutscenes(g);

  g.phone = () => {
    const w = g.week,
      p = g.modal("Your phone"),
      tabs = g.group(p, "tabs");
    e.thumbnail(
      "AniZzCellPhone" + (g.pre === "Che" ? "Chel" : g.pre),
      undefined,
      110,
      185,
    ).then((c) => {
      c.className = "phone-art";
      p.prepend(c);
    });
    g.btn("Messages", () => g.phone(), tabs, "selected");
    g.btn("To-do list", () => g.todo(), tabs);
    const n = g.progress.done.length;
    for (const [i, msg] of (w.PHONE_MSG_TEXT_LONG || []).entries()) {
      if (n < (w.PHONE_MSG_TRIGGER_TASK?.[i] || 0)) continue;
      const box = g.group(p, "paper spaced");
      const h = document.createElement("h3");
      h.textContent = plain(w.PHONE_MSG_TEXT?.[i] || "Message");
      box.append(h);
      const t = document.createElement("p");
      t.textContent = plain(msg);
      box.append(t);
    }
    const voices = g.group(p);
    for (const fx of w.PHONE_MSG_VO || []) {
      const from = /Chel/.test(fx)
        ? "Chelsea"
        : /Mad/.test(fx)
          ? "Westley"
          : "Barbie";
      g.btn(`▶ Voice message from ${from}`, () => g.say(fx), voices);
    }
    const calls = g.group(p);
    calls.innerHTML = "<h3>Calls</h3>";
    const available = (w.PHONE_CALLS || [])
      .map((fx, i) => ({ fx, i }))
      .filter(({ i }) => n >= w.PHONE_CALLS_TRIGGER_TASK[i]);
    if (!available.length)
      calls.append(
        document.createTextNode(
          "New calls will arrive as your weekend plans come together.",
        ),
      );
    for (const { fx, i } of available) {
      const row = g.group(calls, "row spaced");
      const b = g.btn(
        `▶ ${w.PHONE_CALLS_TEXT[i]}`,
        async () => {
          g.say(fx);
          const img = w.PHONE_CALLS_IMAGE[i];
          if (img) {
            const old = row.querySelector("canvas");
            old?.remove();
            row.prepend(await e.thumbnail(img, undefined, 70, 70));
          }
        },
        row,
      );
      b.title = "Replay this call";
    }
    g.btn("Close phone", () => g.close(), g.group(p));
  };

  g.zine = (week = g.p.week) => {
    const w = g.d(`DctTaskWk${pad(week)}`),
      p = g.modal(`The Zine · Issue ${week}`);
    const nav = g.group(p, "row");
    if (week > 1) g.btn("← Previous issue", () => g.zine(week - 1), nav);
    if (week < g.p.week) g.btn("Next issue →", () => g.zine(week + 1), nav);
    const article = document.createElement("p");
    article.className = "zine-article spaced";
    article.textContent = plain(w.ZINE_TEXT);
    p.append(article);
    const photo = g.data.sprites[w.ZINE_PHOTO];
    if (photo)
      e.thumbnail(w.ZINE_PHOTO, undefined, 460, 170).then((c) => p.append(c));
    const title = document.createElement("h3");
    title.textContent = plain(w.PUZZLE_TITLE);
    p.append(title);
    const answers = (g.p.jumbles[week] ||= []);
    for (let i = 0; i < (w.PUZZLE_WORD || []).length / 3; i++) {
      const [scramble, answer, mask] = w.PUZZLE_WORD.slice(i * 3, i * 3 + 3);
      const label = document.createElement("label");
      label.className = "field";
      label.textContent = `${plain(w.PUZZLE_STR[i])} ${scramble}`;
      const input = document.createElement("input");
      input.value = answers[i] || "";
      input.placeholder = [...answer]
        .map((c, j) => (mask[j] === "1" ? c : "_"))
        .join(" ");
      input.maxLength = answer.length + 5;
      input.autocomplete = "off";
      input.setAttribute("aria-label", `Word jumble ${i + 1}`);
      input.oninput = () => {
        answers[i] = input.value.toUpperCase();
        g.save();
      };
      label.append(input);
      p.append(label);
    }
    g.btn(
      "Check my words",
      () => {
        const correct = answers.filter(
          (a, i) =>
            a.replace(/[^A-Z]/g, "") ===
            w.PUZZLE_WORD[i * 3 + 1].replace(/[^A-Z]/g, ""),
        ).length;
        g.text(
          correct === w.PUZZLE_WORD.length / 3
            ? "All solved! Use those fashion clues in the shops."
            : `${correct} words solved. Keep rearranging the letters!`,
        );
        g.voice("SndZineSfx");
      },
      p,
      "primary",
    );
    g.btn("Take this issue’s personality quiz", () => g.quiz(week), g.group(p));
  };

  g.quiz = (week = g.p.week, index = 0) => {
    const d = g.d(`DctZineQuiz${pad(week)}`),
      questions = rows(d),
      answers = (g.p.quizzes[week] ||= []),
      p = g.modal(d.TOPIC);
    if (index >= questions.length) {
      const score = answers.reduce(
          (sum, a, i) => sum + (questions[i][`PTS${a}`] || 0),
          0,
        ),
        max = questions.length * 2,
        key =
          score >= max * 0.75
            ? "SCOREGOOD"
            : score >= max * 0.4
              ? "SCOREOKAY"
              : "SCOREBAD";
      const text = document.createElement("p");
      text.className = "paper";
      text.textContent = d[key];
      p.append(text);
      g.btn(
        "Take it again",
        () => {
          g.p.quizzes[week] = [];
          g.save();
          g.quiz(week);
        },
        p,
      );
      g.btn("Back to the Zine", () => g.zine(week), p);
      return;
    }
    const q = questions[index];
    const n = document.createElement("p");
    n.className = "muted";
    n.textContent = `Question ${index + 1} of ${questions.length}`;
    p.append(n);
    const h = document.createElement("h3");
    h.textContent = q.QUESTION;
    p.append(h);
    for (let a = 1; a <= 3; a++)
      g.btn(
        q[`ANS${a}`],
        () => {
          answers[index] = a;
          g.save();
          g.voice("SndZineQuizSfx");
          g.quiz(week, index + 1);
        },
        p,
        `quiz-answer ${answers[index] === a ? "selected" : ""}`,
      );
    if (index > 0) g.btn("← Back", () => g.quiz(week, index - 1), p);
  };

  g.camera = async () => {
    g.close();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    const url = e.canvas.toDataURL("image/webp", 0.92);
    const picture = {
      id: crypto.randomUUID(),
      src: url,
      caption: `Weekend ${g.p.week} · ${g.scene === "ScStStreet" ? "Out in the city" : "A My Scene moment"}`,
      week: g.p.week,
    };
    g.p.photos.push(picture);
    g.save();
    g.voice("SndZzSfx", "Camera");
    g.photo(picture);
  };
  g.photo = async (picture, { next, prev } = {}) => {
    const p = g.modal(picture.caption || "A My Scene memory");
    const figure = document.createElement("figure");
    figure.className = "photo";
    const im = document.createElement("img");
    im.alt = picture.caption || "Saved picture";
    if (picture.sprite) {
      await e.preload([picture.sprite, picture.overlay].filter(Boolean));
      const c = document.createElement("canvas");
      c.width = 640;
      c.height = 480;
      e.draw(picture.sprite, undefined, { ctx: c.getContext("2d") });
      if (picture.overlay)
        e.draw(picture.overlay, undefined, { ctx: c.getContext("2d") });
      im.src = c.toDataURL("image/png");
    } else im.src = picture.src;
    figure.append(im);
    const caption = document.createElement("figcaption");
    caption.textContent = picture.caption;
    figure.append(caption);
    p.append(figure);
    const actions = g.group(p, "row");
    if (prev) g.btn("← Previous", prev, actions);
    if (next) g.btn("Next →", next, actions);
    g.btn(
      "Download picture",
      async () => {
        await im.decode();
        const c = document.createElement("canvas");
        c.width = im.naturalWidth;
        c.height = im.naturalHeight;
        c.getContext("2d").drawImage(im, 0, 0);
        c.toBlob(
          (blob) => g.download(blob, "my-scene-memory.png", "image/png"),
          "image/png",
        );
      },
      actions,
    );
    g.btn(
      "Print picture",
      () => g.printImage(im.src, picture.caption),
      actions,
    );
    if (picture.state)
      g.btn(
        "Edit this design",
        () => {
          const scene =
              picture.type === "window" ? "ScWdWinDress" : "ScCdClothesDes",
            old = g.activity(scene, {});
          g.p.activities[`${g.p.week}:${scene}`] = {
            ...structuredClone(picture.state),
            brief: 0,
            undo: [],
            paid: old.paid || [],
          };
          g.close();
          g.go(scene);
        },
        actions,
      );
    g.btn(
      "Back to scrapbook",
      () =>
        g.scrapbook(
          picture.state ? "designs" : picture.sprite ? "photos" : "camera",
          picture.week || g.p.week,
        ),
      actions,
    );
    if (picture.voice)
      g.btn("▶ Narration", () => g.voice("SndSbVO", picture.voice), actions);
    if (picture.voice) g.voice("SndSbVO", picture.voice);
  };
  g.printImage = (src, title = "My Scene") => {
    const frame = document.createElement("iframe");
    frame.style.cssText = "position:fixed;width:1px;height:1px;left:-100px;";
    document.body.append(frame);
    const doc = frame.contentDocument;
    doc.open();
    doc.write(
      "<!doctype html><title>" +
        esc(title) +
        "</title><style>@page{margin:12mm}body{margin:0;text-align:center;font:18px Arial}img{max-width:100%;max-height:85vh;object-fit:contain}</style>",
    );
    doc.close();
    const im = doc.createElement("img");
    im.src = src;
    im.alt = title;
    doc.body.append(im);
    const p = doc.createElement("p");
    p.textContent = title;
    doc.body.append(p);
    im.onload = () => {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 30000);
    };
  };

  g.scrapbook = async (
    tab = "photos",
    week = g.p.completedWeeks.at(-1) || 1,
  ) => {
    const p = g.modal("My scrapbook"),
      tabs = g.group(p, "tabs");
    for (const [id, label] of [
      ["photos", "Weekend photos"],
      ["designs", "My designs"],
      ["camera", "My pictures"],
      ["about", "About the girls"],
      ["boys", "Boys"],
    ])
      g.btn(
        label,
        () => g.scrapbook(id, week),
        tabs,
        tab === id ? "selected" : "",
      );
    if (tab === "about") {
      const select = g.group(p, "row");
      for (const [pre, label] of [
        ["Bar", "Barbie"],
        ["Chel", "Chelsea"],
        ["Mad", "Westley"],
      ])
        g.btn(
          label,
          () => {
            p.querySelector(".biography")?.remove();
            const bio = document.createElement("p");
            bio.className = "biography paper spaced";
            bio.textContent = plain(
              g.data.sprites[`TxtSbAboutMe${pre}`].effects.Text.properties.TEXT,
            ).replace(/\\r\\n/g, "\n");
            p.append(bio);
            g.voice(`VocBa${pre}VO`, "AboutMe");
          },
          select,
        );
      select.firstChild.click();
      return;
    }
    if (tab === "boys") {
      if (!g.p.boys.length) {
        p.append(
          document.createTextNode(
            "Say hello to the boys around the city to collect their pictures.",
          ),
        );
        return;
      }
      await g.grid(
        g.p.boys.map((n) => ({
          sprite: n.replace("AniStBoy", "AniSbGuyPicture"),
          label: g.actorName(n),
        })),
        (item) => g.photo({ sprite: item.sprite, caption: item.label }),
        p,
      );
      return;
    }
    if (tab === "designs" || tab === "camera") {
      const pictures =
        tab === "designs" ? g.p.designs.filter((d) => d.src) : g.p.photos;
      if (!pictures.length)
        p.append(
          document.createTextNode(
            tab === "designs"
              ? "Save your creations at the Design Lab and Glassy Fashions."
              : "Use the camera to capture a moment.",
          ),
        );
      const grid = g.group(p, "grid spaced");
      for (const picture of pictures) {
        const b = g.btn(picture.caption, () => g.photo(picture), grid);
        const im = document.createElement("img");
        im.src = picture.src;
        im.alt = "";
        im.style.width = "100%";
        b.prepend(im);
      }
      return;
    }
    if (!g.p.completedWeeks.length) {
      p.append(
        document.createTextNode(
          "Your weekend memories will appear here after the event. Get your to-do list ready!",
        ),
      );
      return;
    }
    const nav = g.group(p, "tabs");
    for (const w of g.p.completedWeeks)
      g.btn(
        `Weekend ${w}`,
        () => g.scrapbook("photos", w),
        nav,
        w === week ? "selected" : "",
      );
    const pics = g.eventPictures(week);
    await g.grid(
      pics.map((pic) => ({ sprite: pic.sprite, label: pic.caption })),
      (_, i) => g.eventPhoto(week, i),
      p,
    );
  };
  g.eventPictures = (week) => {
    const d = g.d(`DctScrapbookDataWk${pad(week)}`),
      progress = g.p.weeks[week];
    return rows(d).map((r) => {
      let overlay;
      if (r.LG_ACCESS) {
        const accessories = Object.entries(g.p.activities).find(
          ([key]) => key === `${week}:ScAcAccess`,
        )?.[1]?.bought;
        const bought = Object.values(accessories || {})[0];
        const suffix = bought?.match(/\d+$/)?.[0];
        if (suffix && g.data.sprites[r.LG_ACCESS + suffix])
          overlay = r.LG_ACCESS + suffix;
      }
      return {
        sprite: r.LARGE,
        caption: r.CAPTION,
        voice: r.VO_FX,
        overlay,
        week,
      };
    });
  };
  g.eventPhoto = (week, index, ending = false) => {
    const pics = g.eventPictures(week);
    g.photo(pics[index], {
      prev: index ? () => g.eventPhoto(week, index - 1, ending) : undefined,
      next:
        index < 3
          ? () => g.eventPhoto(week, index + 1, ending)
          : ending
            ? () => g.nextWeekend()
            : undefined,
    });
  };
  g.finishWeekend = () => {
    if (!g.complete) return g.todo();
    if (!g.p.completedWeeks.includes(g.p.week))
      g.p.completedWeeks.push(g.p.week);
    g.save();
    g.voice(`SndZzMtgeWeek${pad(g.p.week)}`, undefined, {
      channel: "ambient",
      gain: 0.3,
    });
    g.eventPhoto(g.p.week, 0, true);
  };
  g.nextWeekend = async () => {
    if (g.p.week === 12) {
      g.save();
      return g.credits(true);
    }
    g.p.week++;
    g.p.money = 40;
    g.p.area = g.doll.APART_STREET || 1;
    g.p.x = 400;
    g.save();
    g.close();
    await g.apartment();
    g.weekIntro();
  };

  g.musicLibrary = () => {
    const p = g.modal("Music player"),
      tracks = [
        ...g
          .r("DctZzMusic")
          .map((r, i) => ({
            sprite: r.MUSIC,
            label: `My Scene track ${i + 1}`,
          })),
        ...Object.keys(g.data.sprites)
          .filter((s) => /^SndCsCd(?:HipHop|Dance|Rock)/.test(s))
          .map((s) => ({ sprite: s, label: g.itemLabel(s) })),
      ];
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Choose music");
    for (const t of tracks) {
      const o = document.createElement("option");
      o.value = t.sprite;
      o.textContent = t.label;
      select.append(o);
    }
    p.append(select);
    const controls = g.group(p, "row");
    g.btn(
      "▶ Play",
      () =>
        g.voice(select.value, undefined, {
          channel: "ambient",
          loop: true,
          gain: 0.5,
        }),
      controls,
    );
    g.btn("■ Stop", () => g.sound.stopAmbient(), controls);
    const mixes = g.p?.designs.filter((d) => d.type === "music") || [];
    if (mixes.length) {
      const h = document.createElement("h3");
      h.textContent = "My mixes";
      p.append(h);
      for (const mix of mixes)
        g.btn(mix.caption, () => g.playRecording(mix.recording), p);
    }
    g.voice(`VocBa${g.pre === "Che" ? "Chel" : g.pre}VO`, "ClickMp3");
  };
  g.credits = async () => {
    const p = g.modal(
      "My Scene · Credits",
      "<p>Original game © 2003 Mattel, Inc. Published by Vivendi Universal Games.</p>",
    );
    const lines = g
      .r("DctCredits")
      .map((r) => r.CREDITS)
      .join("");
    const text = document.createElement("p");
    text.className = "credits-text";
    text.textContent = plain(lines)
      .replace(/&amp;/g, "&")
      .replace(/&copy;/g, "©");
    p.append(text);
    g.voice("SndCrMusic", undefined, {
      channel: "ambient",
      loop: true,
      gain: 0.3,
    });
    g.btn(
      "Original publisher logo",
      () => {
        g.close();
        g.movie("SmkLogo");
      },
      p,
    );
    const note = document.createElement("p");
    note.className = "muted spaced";
    note.textContent =
      "Native browser restoration from the supplied CD-ROM. Gameplay handlers rewritten for the web.";
    p.append(note);
  };
}
