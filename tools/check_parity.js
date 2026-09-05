// Run with Playwright CLI run-code in a disposable local browser.
// Exercises controls against native-derived rules; sound routing is captured.
async page => {
  const errors = [], checks = [];
  page.on("pageerror",e=>errors.push(e.message));
  const check = (value,message) => { if (!value) throw new Error(message); checks.push(message); };
  const panel = page.locator("#panel");
  const button = name => panel.getByRole("button",{name,exact:true});
  await page.reload();
  await page.waitForFunction(()=>window.myScene && document.querySelector("#loading").hidden);
  await page.evaluate(async()=>{
    const g=myScene;
    g.cancelMovie?.(); g.cancelStory?.();
    window.paritySounds=[]; window.parityAllSounds=[]; window.parityPlay=g.sound.play;
    g.sound.play=async(name,fx,options={})=>{
      paritySounds.push({name,fx,key:g.sound.key(name,fx)||null,channel:options.channel||"voice"});
      parityAllSounds.push(paritySounds.at(-1));
      return null;
    };
    document.body.classList.add("show-controls");
    await g.load({version:1,id:crypto.randomUUID(),name:"Native parity checks",week:1,money:200,weeks:{},activities:{},visits:{},designs:[],photos:[],boys:[],quizzes:{},jumbles:{},area:4,x:400,location:"ScStStreet",completedWeeks:[],created:Date.now()});
  });
  const enter=async scene=>{
    await page.evaluate(async scene=>{myScene.p.money=200;await myScene.go(scene);},scene);
    await page.waitForFunction(()=>document.querySelector("#loading").hidden);
  };
  const outside=()=>page.waitForFunction(()=>myScene.scene === "ScStStreet");
  for (const [scene,code,label] of [["ScGtGift","Gt","Gift"],["ScFdFood","Fd","Food"]]) {
    await enter(scene);
    const candidates = await page.evaluate(code=>{
      const g=myScene,p=g.d(`Dct${code}Params`),t=g.taskFor(g.scene)[0];
      const content=g.d(g.r(p.CONTENT_IDX)[t.DATA].DICT);
      return {answers:content.ANSWERS,questions:g.r(g.r(p.CONTENT_IDX)[t.DATA].DICT).map(r=>r.QUESTION)};
    },code);
    await page.waitForFunction(()=>document.querySelectorAll("#panel .grid button").length === 3);
    check(await panel.locator(".grid button").count() === 3,`${code}: three fixed candidates`);
    for(const q of candidates.questions.slice(0,3)) await button(q).click();
    check(await button(candidates.questions[3]).isDisabled(),`${code}: fourth new question disabled`);
    check(await button(candidates.questions[0]).isEnabled(),`${code}: an asked question remains readable`);
    await button(`${label} ${Number(candidates.answers[1].match(/\d+$/)[0])}`).click();
    await button("Buy selection · $10").click(); await outside();
    check(await page.evaluate(()=>myScene.p.money===200),`${code}: wrong candidate exits without charge`);
    await enter(scene);
    check(await button(candidates.questions[3]).isEnabled(),`${code}: re-entry resets questions`);
    await button(`${label} ${Number(candidates.answers[0].match(/\d+$/)[0])}`).click();
    await button("Buy selection · $10").click(); await outside();
    check(await page.evaluate(()=>myScene.p.money===190),`${code}: one correct candidate costs $10`);
  }
  await enter("ScClClothesDt");
  const clothing = await page.evaluate(()=>{
    const g=myScene,items=g.r("DctClClothingDt"),bad=items.filter(i=>![g.week.CLOTHING_TOP,g.week.CLOTHING_BOTTOM].includes(i.SPRITE));
    return {top:g.itemLabel(bad.find(i=>i.CLOTH_TYPE).SPRITE),bottom:g.itemLabel(bad.find(i=>!i.CLOTH_TYPE).SPRITE)};
  });
  await button(clothing.top).click(); await button(clothing.bottom).click();
  await button("Buy · $40 each").click();
  check(await page.evaluate(()=>myScene.activity("ScClClothesDt",{}).attempts===0 && myScene.p.money===200),"Clothing: two items do not consume a chance or charge");
  await button(clothing.bottom).click();
  check(await page.evaluate(()=>myScene.activity("ScClClothesDt",{}).attempts===0),"Clothing: try-on does not consume a chance");
  for(let i=1;i<=4;i++) {
    await button("Buy · $40 each").click();
    await page.waitForFunction(i=>myScene.activity("ScClClothesDt",{}).attempts===i,i);
  }
  await outside();
  check(await page.evaluate(()=>myScene.p.money===200),"Clothing: fourth wrong Buy exits without charge");
  await enter("ScClClothesDt");
  check(await page.evaluate(()=>myScene.activity("ScClClothesDt",{}).attempts===0),"Clothing: re-entry resets chances");
  await page.evaluate(()=>myScene.p.money=0);
  await button("Buy · $40 each").click(); await outside();
  check(await page.evaluate(()=>paritySounds.some(s=>s.name==="VocClStoreKeeperVO" && s.fx==="NoMon")),"Clothing: native insufficient-money voice and exit");

  for(const [scene,voice,first,again] of [
    ["ScCdClothesDes","VocCdVO","Intro","ReturnIntro"],
    ["ScWdWinDress","VocWdVO","Intro","RtnIntroWork"],
    ["ScAcAccess","VocAcStoreKeeperVO","Intro","ReturnStoreIntro"],
    ["ScMuMakeUp","VocMuStoreKeeperVO","Intro01","ReturnStoreIntro"],
    ["ScMmMusMix","VocMmJezVO","Pt01Intro","ReturnIntro01"],
  ]) {
    if (scene === "ScMuMakeUp") await page.evaluate(()=>myScene.p.week=2);
    await page.evaluate(scene=>{delete myScene.p.visits[scene];paritySounds.length=0;},scene);
    await enter(scene);
    if(scene==="ScMuMakeUp") {
      // The first category comes from this weekend's task, not a generic Intro.
      const fx=await page.evaluate(()=>myScene.activity("ScMuMakeUp",{}).category===0?"Intro01":"Intro02");
      check(await page.evaluate(({voice,fx})=>paritySounds.some(s=>s.name===voice&&s.fx===fx),{voice,fx}),`${scene}: first category greeting`);
    } else check(await page.evaluate(({voice,first})=>paritySounds.some(s=>s.name===voice&&s.fx===first),{voice,first}),`${scene}: first introduction`);
    if (["ScAcAccess","ScMuMakeUp"].includes(scene))
      await page.evaluate(scene=>{for(const t of myScene.taskFor(scene)) myScene.progress.done.push(t.index);},scene);
    await enter(scene);
    check(await page.evaluate(({voice,again})=>paritySounds.some(s=>s.name===voice&&s.fx===again),{voice,again}),`${scene}: return introduction`);
    if (["ScCdClothesDes","ScWdWinDress"].includes(scene)) {
      await page.evaluate(scene=>{
        if(scene==="ScWdWinDress") myScene.p.week=2;
        else myScene.activity(scene,{}).brief=1;
      },scene);
      await enter(scene);
      check(await page.evaluate(voice=>paritySounds.some(s=>s.name===voice&&s.fx===`Comment${myScene.pre==="Che"?"Chel":myScene.pre}`),voice),`${scene}: a new brief gets its character-specific job introduction`);
      await page.evaluate(()=>myScene.p.week=1);
    }
    if (scene === "ScMuMakeUp") await page.evaluate(()=>myScene.p.week=1);
  }
  for(const [scene,week,categories] of [["ScAcAccess",1,["Earrings","Hair clips","Necklaces","Sunglasses"]],["ScMuMakeUp",2,["Lipstick","Eye shadow"]]]) {
    await page.evaluate(({scene,week})=>{
      const g=myScene;g.p.week=week;delete g.p.activities[`${week}:${scene}`];
      g.progress.done=g.progress.done.filter(i=>g.tasks[i].SCENE!==scene);
    },{scene,week});
    await enter(scene);
    const wrong=await page.evaluate(scene=>{
      const g=myScene,s=g.activity(scene,{}),p=g.d(`Dct${scene==="ScAcAccess"?"Access":"MakeUp"}Params${g.pre}`),d=g.r(g.r(p.NAME).find(r=>r.CONTTYPE===s.category).CONTDICT),target=d[s.rounds[s.category].target];
      return {category:s.category,index:d.findIndex(r=>r.ATTRIB1!==target.ATTRIB1&&r.ATTRIB2!==target.ATTRIB2)};
    },scene);
    check(await button("Guess").count()===0,`${scene}: task uses Buy, not the practice Guess control`);
    await button(`${categories[wrong.category]} ${wrong.index+1}`).click();
    for(let i=1;i<=4;i++) {
      await button("Buy · $10").click();
      await page.waitForFunction(({scene,i})=>{const s=myScene.activity(scene,{});return s.rounds[s.category].attempts.length===i;},{scene,i});
    }
    await outside();
    check(await page.evaluate(()=>myScene.p.money===200),`${scene}: four wrong buys exit without charge`);
    await enter(scene);
    const round=await page.evaluate(scene=>{const s=myScene.activity(scene,{});return {category:s.category,...s.rounds[s.category]};},scene);
    check(round.attempts.length===0,`${scene}: failed-round re-entry has four fresh chances`);
    await button(`${categories[round.category]} ${round.target+1}`).click();
    await button("Buy · $10").click();await outside();
    check(await page.evaluate(()=>myScene.p.money===190),`${scene}: a correct Buy purchases in one action`);
  }
  await page.evaluate(()=>myScene.p.week=1);
  await enter("ScCsCDShop");
  await page.waitForFunction(()=>paritySounds.some(s=>s.name==="AniCsBarbieVO"&&s.fx==="Intro02"));
  check(await page.evaluate(()=>paritySounds.some(s=>s.name==="AniCsBarbieVO"&&/^Hum/.test(s.fx))),"CD store: automatic humming clue");
  check(await page.evaluate(()=>paritySounds.some(s=>s.name==="SndCsAmbience01"&&s.key)),"CD store: resolved ambience");

  await page.evaluate(()=>{myScene.close();myScene.zine();});
  check(await page.evaluate(()=>paritySounds.some(s=>s.fx==="PickUpZine")),"Zine: first-use guidance");
  await page.evaluate(()=>{myScene.close();paritySounds.length=0;myScene.zine();});
  check(await page.evaluate(()=>!paritySounds.some(s=>s.fx==="PickUpZine")),"Zine: guidance is once per profile");
  await page.evaluate(async()=>{myScene.close();await myScene.scrapbook();});
  check(await page.evaluate(()=>paritySounds.some(s=>s.fx==="ScrpBkIntro")),"Scrapbook: first entry narration");
  await page.evaluate(()=>myScene.scrapbook("designs"));
  check(await page.evaluate(()=>paritySounds.some(s=>s.fx==="ClickDesTab")),"Scrapbook: design-tab narration");
  await page.evaluate(()=>myScene.scrapbook("photos"));
  check(await page.evaluate(()=>paritySounds.some(s=>s.fx==="ClickPhotoTab")),"Scrapbook: photo-tab narration");
  await page.evaluate(()=>myScene.scrapbook("about"));
  check(await page.evaluate(()=>paritySounds.some(s=>s.fx==="AboutMe")),"Scrapbook: about narration");
  const missing=await page.evaluate(()=>parityAllSounds.filter(s=>!s.key));
  check(missing.length===0,`All exercised sound requests resolve: ${JSON.stringify(missing)}`);
  check(errors.length===0,`No page errors: ${errors.join("; ")}`);
  await page.evaluate(()=>{myScene.close();myScene.sound.play=parityPlay;});
  return {checks};
}
