import assert from "node:assert/strict";
import fs from "node:fs";
import { rows, pad } from "../web/engine.mjs";
import {
  validateClothes,
  validateWindow,
  validateMusic,
} from "../web/creative.mjs";

const data = JSON.parse(
  fs.readFileSync(new URL("../web/assets/game-data.json", import.meta.url)),
);
const d = (name) => {
  assert(data.dictionaries[name], `Missing dictionary ${name}`);
  return data.dictionaries[name];
};
const r = (name) => rows(d(name));
const sprite = (name) => assert(data.sprites[name], `Missing sprite ${name}`);
const reports = {
  weekends: 0,
  tasks: 0,
  clothesBriefs: 0,
  windowBriefs: 0,
  musicBriefs: 0,
  quizQuestions: 0,
  eventPhotos: 0,
};
for (const item of Object.values(data.images))
  assert(
    fs.existsSync(new URL("../web/" + item.src, import.meta.url)),
    item.src,
  );
for (const item of Object.values(data.audio))
  assert(fs.existsSync(new URL("../web/" + item, import.meta.url)), item);
for (let week = 1; week <= 12; week++) {
  const w = d(`DctTaskWk${pad(week)}`),
    tasks = rows(w);
  assert.equal(tasks.length, 5);
  reports.weekends++;
  reports.tasks += tasks.length;
  const openings = r(w.CLOSED_STORE_DICT);
  for (const t of tasks) {
    assert.equal(
      openings.find((o) => o.SCENE === t.SCENE)?.STATE,
      1,
      `Week ${week}: task store is closed`,
    );
  }
  for (const category of ["TOP", "BOTTOM"]) {
    sprite(w[`CLOTHING_${category}`]);
    assert(
      r(w[`CLOTHING_STORE_${category}`]).some(
        (i) => i.SPRITE === w[`CLOTHING_${category}`],
      ),
      `Week ${week}: missing clothing answer`,
    );
  }
  for (const t of tasks.filter((t) =>
    ["ScGtGift", "ScFdFood"].includes(t.SCENE),
  )) {
    const pre = t.SCENE === "ScGtGift" ? "Gt" : "Fd",
      content = d(r(`Dct${pre}ContentIdx`)[t.DATA].DICT);
    assert.equal(content.ANSWERS.length, 3);
    content.ANSWERS.forEach(sprite);
    assert.equal(rows(content).length, 5);
  }
  for (const key of w.CLOTHING_DESIGN_DICT) {
    const brief = d(key);
    if (!brief.DESIGN_CORRECT?.length) continue;
    const design = brief.DESIGN_CORRECT.find((n) => data.dictionaries[n]);
    assert(design, `${key}: no valid sketch`);
    const parts = r(design).map((p) => p.MATTESP);
    parts.forEach(sprite);
    const state = { design, fills: {}, marks: [] };
    const fabric =
      (brief.CORRECT_FABRIC || []).find(
        (n) => !brief.INCORRECT_FABRIC?.includes(n),
      ) || "AniCdFabric30";
    sprite(fabric);
    parts.forEach((p) => (state.fills[p] = fabric));
    for (const [kind, field] of [
      ["Fasteners", "FASTENER"],
      ["Stamps", "STAMP"],
      ["Trims", "TRIM"],
    ]) {
      const id = (brief[`CORRECT_${field}`] || []).find(
        (n) => !brief[`INCORRECT_${field}`]?.includes(n),
      );
      if (id) state.marks.push({ kind, id });
    }
    assert.deepEqual(validateClothes(brief, state, parts), [], key);
    assert(
      validateClothes(brief, { ...state, fills: {} }, parts).length > 0,
      `${key}: empty design accepted`,
    );
    reports.clothesBriefs++;
  }
  const fashions = r("DctWdInvFashion").map((x) => x.CURSOR);
  for (const key of w.WINDOW_DRESS_DICT) {
    const brief = d(key),
      top = brief.CORRECT_TOP?.find(
        (n) => fashions.includes(n) && !brief.INCORRECT_TOP?.includes(n),
      ),
      bottom = brief.CORRECT_BOTTOM?.find(
        (n) => fashions.includes(n) && !brief.INCORRECT_BOTTOM?.includes(n),
      );
    assert(top && bottom, `${key}: unavailable window clothes`);
    const state = { slots: [top, top, top, bottom, bottom, bottom], marks: [] };
    for (const [kind, field] of [
      ["Trims", "TRIM"],
      ["Letters & stamps", "STICKER"],
    ]) {
      const n = (brief[`CORRECT_${field}`] || []).find(
        (n) => data.sprites[n] && !brief[`INCORRECT_${field}`]?.includes(n),
      );
      if (n) state.marks.push({ kind, sprite: n });
    }
    assert.deepEqual(validateWindow(brief, state), [], key);
    assert(
      validateWindow(brief, { slots: [], marks: [] }).length > 0,
      `${key}: empty window accepted`,
    );
    reports.windowBriefs++;
  }
  for (const key of w.MUSIC_MIX || []) {
    const brief = d(key),
      options = rows(brief);
    for (const row of options)
      for (let k = 1; k <= 4; k++) {
        sprite(row[`KNOB${k}`]);
        const s = data.sprites[row[`KNOB${k}`]];
        assert(
          Object.values(s.effects).some((e) => data.audio[e.sound]),
          `Missing audio ${row[`KNOB${k}`]}`,
        );
      }
    const correct = [1, 2, 3, 4].map((k) =>
      options.findIndex((r) => r[`CORRECT${k}`]),
    );
    assert(correct.every((n) => n >= 0));
    assert(validateMusic(brief, correct).every(Boolean));
    reports.musicBriefs++;
  }
  const quiz = d(w.ZINE_QUIZ);
  for (const q of rows(quiz)) {
    assert(q.QUESTION);
    assert(
      [1, 2, 3].every((n) => q[`ANS${n}`] && Number.isInteger(q[`PTS${n}`])),
    );
    reports.quizQuestions++;
  }
  for (const pic of r(`DctScrapbookDataWk${pad(week)}`)) {
    sprite(pic.LARGE);
    assert.equal(typeof pic.CAPTION, "string");
    assert(
      data.sprites.SndSbVO.effects[pic.VO_FX]?.sound,
      `Missing narration ${pic.VO_FX}`,
    );
    reports.eventPhotos++;
  }
}
for (const pre of ["Bar", "Che", "Mad"])
  for (const type of ["Lip", "Eye"]) {
    const items = r(`DctMu${type}${pre}`);
    assert.equal(items.length, 9);
    items.forEach((i) => {
      sprite(i.SPRITE);
      sprite(i.ONDOLL);
    });
  }
console.log(JSON.stringify(reports, null, 2));
