import { rows, pad, esc, plain } from "./engine.mjs";
import { speakSequence, leaveAfterVoice, oneOf } from "./narration.mjs";

export function installShops(g) {
  const e = g.e;
  function controls(title, scene, copy) {
    g.ui.help = copy;
    const p = g.panel(title, `<p>${esc(copy)}</p>`, `Shopping · $${scene.startsWith("ScClClothes") ? 40 : 10}`);
    const ts = g.taskFor(scene);
    for (const t of ts) {
      const n = document.createElement("p");
      n.className = "paper";
      n.textContent = `${g.progress.done.includes(t.index) ? "✓ " : ""}${plain(t.SHORT_TXT)}\n${plain(t.EXPANDED)}`;
      p.append(n);
    }
    return p;
  }
  function leave(p) {
    g.btn("Done · back outside", () => g.street(g.p.area), g.group(p));
  }

  async function accessories(makeup = false) {
    const scene = makeup ? "ScMuMakeUp" : "ScAcAccess",
      code = makeup ? "Mu" : "Ac";
    const params = g.d(`Dct${makeup ? "MakeUp" : "Access"}Params${g.pre}`),
      categories = makeup
        ? ["Lipstick", "Eye shadow"]
        : ["Earrings", "Hair clips", "Necklaces", "Sunglasses"];
    const tasks = g.taskFor(scene),
      state = g.activity(scene, {
        category:
          tasks.find((t) => !g.progress.done.includes(t.index))?.DATA || 0,
        selected: {},
        rounds: {},
        pose: "Still",
      });
    state.poseAt = e.clock;
    const cat = state.category,
      dictName = rows(params).find((r) => r.CONTTYPE === cat)?.CONTDICT,
      dict = g.d(dictName);
    let items = rows(dict).map((r) => ({ ...r }));
    if (makeup)
      items = items.map((r) => ({
        ...r,
        SPRITE: r.SPRITE.replace("AniMuM", `AniMu${g.character[0]}`),
        ONDOLL: r.ONDOLL.replace("AniMuM", `AniMu${g.character[0]}`),
      }));
    // The second necklace rack contains alternate forms of the same attributes.
    if (!makeup && cat === 2 && items.length === 9)
      items.push(
        ...items.map((r, i) => ({
          ...r,
          SPRITE: `AniAcNecklace${pad(i + 10)}`,
          ONDOLL: `AniAc${g.character[0]}Neck${pad(i + 10)}`,
        })),
      );
    const round = (state.rounds[cat] ||= {
      target: Math.floor(Math.random() * items.length),
      attempts: [],
      solved: false,
    });
    if (round.attempts.length >= 4 && !round.solved) {
      round.attempts = [];
      round.target = Math.floor(Math.random() * items.length);
    }
    let busy = false;
    const chosen = () => items.find((i) => i.SPRITE === state.selected[cat]);
    if (!await g.prepare([
      g.background(scene),
      params.DOLL_SP,
      params.DOLL_SP_NOEYE,
      params.DEFAULT_EYE,
      params.DEFAULT_LIPS,
      ...items.flatMap((i) => [i.SPRITE, i.ONDOLL]),
      `Ani${code}Chance`,
      `Btn${code}Guess`,
      `Btn${code}Buy`,
      `Btn${code}Done`,
      `Ani${code}PriceTag`,
    ])) return;
    const select = (item) => {
      if (busy) return;
      state.selected[cat] = item.SPRITE;
      round.solved = round.solutionSprite === item.SPRITE;
      state.pose = "Still";
      g.save();
      panel();
    };
    const changeCategory = (index) => { state.category = index; g.save(); accessories(makeup); };
    const guess = async () => {
      if (busy) return;
      if (round.attempts.length >= 4 && !round.solved)
        return;
      const item = chosen();
      if (!item) return g.text("Try something on first.");
      const task = tasks.find(t=>t.DATA === cat && !g.progress.done.includes(t.index));
      busy = true;
      if (task && !await g.canAfford(scene)) return;
      busy = false;
      const answer = items[round.target],
        matches =
          Number(item.ATTRIB1 === answer.ATTRIB1) +
          Number(item.ATTRIB2 === answer.ATTRIB2);
      round.attempts.push({ item: item.SPRITE, matches });
      round.solved = matches === 2;
      if (round.solved) round.solutionSprite = item.SPRITE;
      state.pose = matches === 2 ? "Pos01" : matches === 1 ? "SoSo01" : "Neg01";
      state.poseAt = e.clock;
      const voice = params.DOLL_VO;
      if (round.solved) {
        busy = true;
        if (!task || await g.purchase(scene,item.SPRITE,task.index)) {
          if (task) (state.bought ||= {})[cat] = item.SPRITE;
          g.save();
          await leaveAfterVoice(g, [[voice,task ? dict.FX_ALLCORRECT || "Correct01" : "CorrectGuess"]]);
        }
        return;
      }
      if (round.attempts.length === 4 && !round.solved) {
        busy = true; g.save();
        await leaveAfterVoice(g, [[makeup ? params.HOST_VO : voice, "AfterAllChances01"]]);
        return;
      }
      g.voice(voice, matches === 2 ? dict.FX_ALLCORRECT || "Correct01" : matches === 1 ? "SoSo01" : dict.FX_ALLWRONG || "Wrong01");
      g.text(
        matches === 2
          ? "That’s the one! Ready to buy."
          : matches === 1
            ? "One feature is right. Try changing the other."
            : "Neither feature matches. Try another style.",
      );
      g.save();
      panel();
    };
    g.currentRender = (t) => {
      e.background(g.background(scene));
      const pose = state.pose === "Still" ? "Still" : state.pose;
      const elapsed = t - (state.poseAt || 0);
      e.draw(
        !makeup && cat === 3 ? params.DOLL_SP_NOEYE : params.DOLL_SP,
        pose,
        { time: elapsed, loop: false },
      );
      if (makeup) {
        e.draw(params.DEFAULT_EYE, "Still");
        e.draw(params.DEFAULT_LIPS, "Still");
      }
      for (const [category, sprite] of Object.entries(state.selected)) {
        let row;
        if (+category === cat) row = items.find((i) => i.SPRITE === sprite);
        else {
          const key = rows(params).find(
            (r) => r.CONTTYPE === +category,
          )?.CONTDICT;
          row = rows(g.d(key)).find(
            (r) =>
              r.SPRITE === sprite ||
              r.SPRITE.replace("AniMuM", `AniMu${g.character[0]}`) === sprite,
          );
          if (row && makeup)
            row = {
              ...row,
              ONDOLL: row.ONDOLL.replace("AniMuM", `AniMu${g.character[0]}`),
            };
        }
        if (!row && !makeup && /^AniAcNecklace\d+$/.test(sprite))
          row = { ONDOLL: `AniAc${g.character[0]}Neck${sprite.match(/\d+$/)[0]}` };
      if (row) e.draw(row.ONDOLL);
      }
      items.forEach((item, i) =>
        e.draw(item.SPRITE, state.selected[cat] === item.SPRITE ? "Down" : e.hover === `shelf-${i}` ? "Highlight" : "Still", {
          action: () => select(item),
          label: `Try ${categories[cat]} ${i + 1}`,
          id: `shelf-${i}`,
        }),
      );
      e.draw(
        `Ani${code}Chance`,
        round.attempts.length
          ? `Chance${pad(Math.min(round.attempts.length, 4))}`
          : "Still",
      );
      if (busy) return;
      const pending = tasks.some(t=>t.DATA === cat && !g.progress.done.includes(t.index));
      e.button(`Btn${code}${pending ? "Buy" : "Guess"}`,pending ? "Buy" : "Guess",guess);
    };
    function panel() {
      const p = controls(
        makeup ? "The Glamour Shop" : "Angel Accessories",
        scene,
        "Try a look, then buy. You have four chances to find the right color and style.",
      );
      const tabs = g.group(p, "tabs");
      categories.forEach((label, i) =>
        g.btn(
          label,
          () => changeCategory(i),
          tabs,
          i === cat ? "selected" : "",
        ),
      );
      const actions = g.group(p, "row");
      const pending = tasks.some(t=>t.DATA === cat && !g.progress.done.includes(t.index));
      g.btn(pending ? "Buy · $10" : "Guess", guess, actions, "primary");
      if (round.attempts.length) {
        const a = document.createElement("p");
        a.className = "hint";
        a.textContent = round.attempts
          .map((a, i) => `Try ${i + 1}: ${a.matches}/2 features matched`)
          .join(" · ");
        p.append(a);
      }
      g.grid(
        items.map((i, n) => ({
          sprite: i.SPRITE,
          label: `${categories[cat]} ${n + 1}`,
        })),
        (_, i) => select(items[i]),
        p,
        state.selected[cat],
      );
      leave(p);
    }
    panel();
    g.voice(params.AMBIENT_SND, undefined, {
      loop: true,
      channel: "ambient",
      gain: 0.2,
    });
    const completed = tasks.some(t=>g.progress.done.includes(t.index));
    g.voice(params.HOST_VO, completed ? "ReturnStoreIntro" : dict.INTRO_FX || "Intro", {priceTag:`Ani${code}PriceTag`});
    g.save();
  }

  async function clothing(scene) {
    const suffix = {
        ScClClothesDt: "Downtown",
        ScClClothesUe: "UpperEast",
        ScClClothesVil: "Village",
      }[scene],
      params = g.d(`DctClParams${suffix}`),
      doll = g.d(`DctClParams${g.pre}`),
      items = g.r(params.CLOTHING_DICT),
      locations = [g.r(params.LOC_DICT_BOTTOM), g.r(params.LOC_DICT)];
    const state = g.activity(scene, {
        top: null,
        bottom: null,
        pose: "Still",
        at: 0,
      }),
      bg = g.blob(params.BG_BLOB);
    state.at = e.clock;
    state.attempts = 0;
    let busy = false;
    const select = (item) => {
      if (busy) return;
      const type = item.CLOTH_TYPE ? "top" : "bottom";
      state[type] = state[type] === item.SPRITE ? null : item.SPRITE;
      state.pose =
        state.top && state.bottom
          ? "HeadlessBoth"
          : state.top
            ? "HeadlessTop"
            : state.bottom
              ? "HeadlessBottom"
              : "Still";
      state.at = e.clock;
      g.save();
      panel();
    };
    const model = () => {
      state.pose =
        state.top && state.bottom
          ? "ModelTopBottom"
          : state.top
            ? "ModelTop"
            : state.bottom
              ? "ModelBottom"
              : "Idle01";
      state.at = e.clock;
      g.save();
    };
    const buy = async () => {
      if (busy || state.attempts >= 4) return;
      const selected = [state.top, state.bottom].filter(Boolean);
      if (!selected.length)
        return g.text("Pick something from the racks first.");
      busy = true;
      if (!await g.canAfford(scene)) return;
      if (selected.length === 2) {
        g.voice(doll.VO_SP, oneOf(doll.TWO_ITEMS_FX));
        busy = false;
        return;
      }
      const tasks = g.taskFor(scene);
      for (const item of selected) {
        const t = tasks.find(
          (t) =>
            !g.progress.done.includes(t.index) &&
            (item === g.week.CLOTHING_TOP || item === g.week.CLOTHING_BOTTOM),
        );
        if (tasks.some((t) => !g.progress.done.includes(t.index)) && !t) {
          state.attempts++; g.save();
          const feedback = g.r("DctClVOFeedback").find(r=>r.SPRITE===item)?.[`Week${g.p.week}`] || "LookAtClues";
          if (state.attempts === 4) await leaveAfterVoice(g, [["VocClStoreKeeperVO",oneOf(doll.KICK_FX)]]);
          else await speakSequence(g, [[doll.VO_SP,feedback]]);
          busy = false;
          if (g.scene === scene) panel();
          return;
        }
        if (await g.purchase(scene, item, t?.index))
          await leaveAfterVoice(g, [[doll.VO_SP,oneOf(doll.CORRECT_FX)],["VocClStoreKeeperVO",oneOf(doll.HOST_CORRECT_FX)]]);
      }
      busy = false;
    };
    if (!await g.prepare([
      bg,
      doll.DOLL_SP,
      doll.DOLL_MOUTH,
      ...items.map((i) => i.SPRITE),
      "BtnClBuy",
      "BtnClDone",
      params.CHANCE_SP,
      "AniClPriceTag",
    ])) return;
    g.currentRender = (t) => {
      e.background(bg);
      const count = [0, 0];
      for (const item of items) {
        const point = locations[item.CLOTH_TYPE][count[item.CLOTH_TYPE]++];
        if (point)
          e.draw(item.SPRITE, "Hanger", {
            dx: point.XLOC,
            dy: point.YLOC,
            action: () => select(item),
            label: `Try ${g.itemLabel(item.SPRITE)}`,
            id: item.SPRITE,
          });
      }
      e.draw(doll.DOLL_SP, state.pose, { time: t - state.at, loop: false, action: model, label: "Model this look", id: "model-look" });
      g.drawSpeaking(doll.DOLL_MOUTH);
      const hand = g.d(doll.HAND_DICT),
        fx = state.pose;
      for (const [type, sprite] of [
        ["Top", state.top],
        ["Bottom", state.bottom],
      ]) {
        if (!sprite) continue;
        const sub =
          state.top && state.bottom ? (type === "Top" ? "Top" : "Bot") : "";
        const coord = hand[fx + sub] || hand[`Headless${type}`];
        if (coord) {
          const f = e.effect(doll.DOLL_SP, fx),
            index = Math.min(
              Math.floor((t - state.at) / Math.max(f?.delay || 100, 16)),
              coord.length / 2 - 1,
            );
          const x = coord[Math.max(0, index) * 2],
            y = coord[Math.max(0, index) * 2 + 1];
          if (x || y) e.draw(sprite, "Still", { dx: x, dy: y });
        }
      }
      const selected = [state.top, state.bottom].filter(Boolean);
      e.draw(params.CHANCE_SP,state.attempts ? `Chance${pad(state.attempts)}` : "Still");
      if (selected.length && selected.every(item => g.progress.bought.includes(scene + ":" + item)))
        e.button("BtnClDone", "Done", () => g.street(g.p.area));
      else e.button("BtnClBuy", "Buy clothes", buy);
    };
    function panel() {
      const p = controls(
        { Downtown: "Digs", UpperEast: "Très Chic", Village: "Urban Threads" }[
          suffix
        ],
        scene,
        "Browse the racks and hold clothes up to see how they look. Your to-do list, messages and Zine have the fashion clues.",
      );
      const a = g.group(p, "row");
      g.btn("Model this look", model, a);
      g.btn("Buy · $40 each", buy, a, "primary");
      g.grid(
        items.map((i) => ({
          sprite: i.SPRITE,
          fx: "Hanger",
          label: g.itemLabel(i.SPRITE),
        })),
        (_, i) => select(items[i]),
        p,
      );
      leave(p);
    }
    panel();
    g.voice(params.AMBIENT_SND, undefined, {
      loop: true,
      channel: "ambient",
      gain: 0.2,
    });
    g.voice(doll.VO_SP, params.INTRO_FX, {priceTag:"AniClPriceTag"});
    g.save();
  }

  async function selectionShop(food = false) {
    const code = food ? "Fd" : "Gt",
      scene = food ? "ScFdFood" : "ScGtGift",
      params = g.d(`Dct${code}Params`),
      doll = g.d(`Dct${code}Params${g.pre}`),
      task = g.taskFor(scene)[0],
      contentName = g.r(params.CONTENT_IDX)[task?.DATA || 0]?.DICT,
      content = g.d(contentName),
      items = g.r(params.OBJECT_DICT);
    const state = g.activity(scene, {});
    // Native keeps candidate identity (index zero is correct) separate from the
    // shuffled box positions. Re-entry starts a fresh three-question round.
    const boxes = rows(params).slice();
    for (let i=boxes.length-1;i>0;i--) {
      const j=Math.floor(Math.random()*(i+1));
      [boxes[i],boxes[j]]=[boxes[j],boxes[i]];
    }
    const candidates = (content.ANSWERS || []).map((sprite, index) => ({
      ...items.find(item => item.SPRITE === sprite), index, box: boxes[index],
    }));
    state.selected = null; state.questions = []; state.answer = null;
    let busy = false;
    const choose = item => {
      if (busy) return;
      state.selected = item.SPRITE;
      g.voice(params.STOREKEEPER_VO, item.SND);
      g.save(); panel();
    };
    const buy = async () => {
      if (busy || !state.selected) return;
      busy = true;
      if (!await g.canAfford(scene)) return;
      const correct = state.selected === content.ANSWERS[0];
      if (!correct) {
        await leaveAfterVoice(g, [[doll.DOLL_MOUTH, oneOf(doll.INCORRECT_SND)]]);
      } else if (await g.purchase(scene, state.selected, task?.index)) {
        await leaveAfterVoice(g, [[doll.DOLL_MOUTH, oneOf(doll.CORRECT_SND)]]);
      }
      busy = false;
    };
    const disabled = index => busy || (state.questions.length >= 3 && !state.questions.includes(index));
    const ask = (q, index) => {
      if (disabled(index)) return;
      state.answer = q.ANSWER;
      if (!state.questions.includes(index)) state.questions.push(index);
      g.save(); panel();
    };
    if (!await g.prepare([g.background(scene), doll.DOLL_SP, doll.DOLL_MOUTH,
      ...candidates.map(item => item.SPRITE), params.BTN_BUY, params.BTN_QUES_MARKER,`Ani${code}PriceTag`,
      ...boxes.map(box => box.BOX)])) return;
    g.currentRender = t => {
      e.background(g.background(scene));
      e.draw(doll.DOLL_SP, "Still", {time:t}); g.drawSpeaking(doll.DOLL_MOUTH);
      candidates.forEach(item => {
        const selected = state.selected === item.SPRITE;
        e.draw(item.box.BOX, selected ? "Down" : e.hover === `candidate-${item.index}` ? "Highlight" : "Still", {
          action: () => choose(item), label: `Choose ${g.itemLabel(item.SPRITE)}`, id:`candidate-${item.index}`,
        });
        e.draw(item.SPRITE, "Still", {dx:item.box.XLOC,dy:item.box.YLOC});
      });
      rows(content).forEach((q,i) => {
        const asked = state.questions.includes(i), off = disabled(i);
        const hover = e.hover === `question-marker-${i}` || e.hover === `question-${i}`;
        e.draw(params.BTN_QUES_MARKER, off ? "Disabled" : hover ? "Hilite" : asked ? "Down" : "Up", {
          dy:i * params.BTN_QUES_OFF_Y,
          ...(off ? {} : {action:()=>ask(q,i)}), label:q.QUESTION, id:`question-marker-${i}`,
        });
        g.ink(q.QUESTION, params.QUES_TEXT_START_X, params.QUES_TEXT_START_Y+i*58,205,45,
          off ? undefined : ()=>ask(q,i), {size:16,bold:true,hoverColor:`rgb(${params[off ? "QUES_TEXT_RGB_DISABLED" : "QUES_TEXT_RGB_ROLL"].join(",")})`,color:`rgb(${params[off ? "QUES_TEXT_RGB_DISABLED" : asked ? "QUES_TEXT_RGB_SELECTED" : "QUES_TEXT_RGB_NORMAL"].join(",")})`,id:`question-${i}`});
      });
      if (state.answer) e.text(state.answer,353,445,{size:18,maxWidth:264,color:"#3446a5",bold:true});
      if (state.selected) e.button(params.BTN_BUY,"Buy selection",buy);
    };
    function panel() {
      const p = controls(food ? "Village Depot" : "Tiff’s",scene,
        "Ask up to three questions, then choose the one item that fits the occasion.");
      const qs = g.group(p);
      rows(content).forEach((q,i) => { const b=g.btn(q.QUESTION,()=>ask(q,i),qs,"quiz-answer"); b.disabled=disabled(i); b.setAttribute("aria-pressed",String(state.questions.includes(i))); });
      if (state.answer) { const a=document.createElement("p"); a.textContent=state.answer; p.append(a); }
      g.btn("Buy selection · $10",buy,p,"primary");
      g.grid(candidates.map(item=>({sprite:item.SPRITE,label:`${food ? "Food" : "Gift"} ${Number(item.SPRITE.match(/\d+$/)[0])}`})),
        (_,i)=>choose(candidates[i]),p,state.selected);
      leave(p);
    }
    panel();
    g.voice(`Snd${code}Ambient`,undefined,{loop:true,channel:"ambient",gain:.2});
    // Both native shop instances explicitly select the keeper's Intro effect.
    g.voice(params.STOREKEEPER_VO,"Intro",{priceTag:`Ani${code}PriceTag`});
    g.save();
  }

  async function cds() {
    const scene = "ScCsCDShop",
      doll = g.d(`DctCsParams${g.pre}`),
      hums = g.r("DctCsHums"),
      sprites = g.r("DctCsCDs").map((r) => r.SPRITE),
      locs = g.r("DctCsCDLocations");
    const state = g.activity(scene, {
      target: hums
        .map((h, i) => ({ h, i }))
        .filter(({ h }) => g.sound.key(`AniCs${g.character}VO`, h.HUM))[
        Math.floor(Math.random() * 6)
      ].i,
      tracks: [],
      selected: null,
    });
    if (!state.tracks.length)
      state.tracks = [
        state.target,
        ...hums
          .map((_, i) => i)
          .filter((i) => i !== state.target)
          .sort(() => Math.random() - 0.5)
          .slice(0, 8),
      ].sort(() => Math.random() - 0.5);
    const select = (i) => {
      state.selected = i;
      g.voice(hums[state.tracks[i]].MUSIC, undefined, { channel: "sample" });
      g.save();
      panel();
    };
    const clue = () => g.voice(`AniCs${g.character}VO`, hums[state.target].HUM);
    const buy = async () => {
      if (state.selected === null)
        return g.text("Listen to a CD and select it first.");
      if (!await g.canAfford(scene)) return;
      const task = g.taskFor(scene)[0];
      if (
        task &&
        !g.progress.done.includes(task.index) &&
        state.tracks[state.selected] !== state.target
      ) {
        g.text("That’s not the tune. Listen to the humming clue again.");
        g.voice(doll.DOLL_MOUTH, "Wrong01");
        return;
      }
      if (
        await g.purchase(
          scene,
          hums[state.tracks[state.selected]].MUSIC,
          task?.index,
        )
      )
        panel();
    };
    if (!await g.prepare([
      g.background(scene),
      doll.DOLL_SP,
      doll.DOLL_MOUTH,
      ...sprites,
      "BtnCsBuy",
      "BtnCsDone",
      "AniCsPriceTag",
    ])) return;
    g.currentRender = (t) => {
      e.background(g.background(scene));
      e.draw(doll.DOLL_SP, "Still", { time: t, action: clue, label: "Hear humming clue", id: "humming-clue" });
      g.drawSpeaking(doll.DOLL_MOUTH);
      sprites.forEach((s, i) =>
        e.draw(s, state.selected === i ? "Down" : "Still", {
          dx: locs[i].XLOC,
          dy: locs[i].YLOC,
          action: () => select(i),
          label: `Listen to CD ${i + 1}`,
          id: s,
        }),
      );
      if (state.selected !== null && g.progress.bought.includes(scene + ":" + hums[state.tracks[state.selected]].MUSIC))
        e.button("BtnCsDone", "Done", () => g.street(g.p.area));
      else e.button("BtnCsBuy", "Buy CD", buy);
    };
    function panel() {
      const p = controls(
        "CD Store",
        scene,
        "Listen to the tune your friend hums, then find the matching CD. Each case plays a sample.",
      );
      const a = g.group(p, "row");
      g.btn("Hear humming clue", clue, a);
      g.btn("Buy · $10", buy, a, "primary");
      g.grid(
        sprites.map((s, i) => ({ sprite: s, label: `CD ${i + 1}` })),
        (_, i) => select(i),
        p,
      );
      leave(p);
    }
    panel();
    g.voice("SndCsAmbience01", undefined, {
      loop: true,
      channel: "ambient",
      gain: 0.2,
    });
    const voice = `AniCs${g.character}VO`;
    const completed = g.taskFor(scene).some(t=>g.progress.done.includes(t.index));
    speakSequence(g, completed ? [[voice,"RtnIntroCD"]]
      : [[voice,"Intro01",{priceTag:"AniCsPriceTag"}],[voice,hums[state.target].HUM],[voice,"Intro02"]]);
    g.save();
  }
  g.handlers.ScAcAccess = () => accessories(false);
  g.handlers.ScMuMakeUp = () => accessories(true);
  for (const s of ["ScClClothesDt", "ScClClothesUe", "ScClClothesVil"])
    g.handlers[s] = () => clothing(s);
  g.handlers.ScGtGift = () => selectionShop(false);
  g.handlers.ScFdFood = () => selectionShop(true);
  g.handlers.ScCsCDShop = cds;
}
