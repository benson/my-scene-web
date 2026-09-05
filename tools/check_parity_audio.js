// Actual Web Audio playback, ordered narration, cancellation, Help and cue QA.
// Lesson playback is accelerated; the authored cue check runs at normal speed.
async page => {
  const checks=[],errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  const check=(ok,msg)=>{if(!ok)throw new Error(msg);checks.push(msg);};
  await page.reload();
  await page.waitForFunction(()=>window.myScene && document.querySelector("#loading").hidden);
  await page.evaluate(async()=>{
    const g=myScene;g.cancelMovie?.();
    await g.load({version:1,id:crypto.randomUUID(),name:"Parity audio",week:1,money:40,weeks:{},activities:{},visits:{},designs:[],photos:[],boys:[],quizzes:{},jumbles:{},area:4,x:400,location:"ScStStreet",completedWeeks:[],created:Date.now()});
    g.sound.mute(true);g.sound.stopVoice();
    window.audioCalls=[];window.normalSpeed=false;
    const play=g.sound.play.bind(g.sound);
    g.sound.play=async(name,fx,options={})=>{
      const source=await play(name,fx,options);
      if(source && (!options.channel || options.channel==="voice")) {
        audioCalls.push({name,fx});
        if(!normalSpeed) source.playbackRate.value=32;
      }
      return source;
    };
    document.body.classList.add("show-controls");
    await g.go("ScMmMusMix");
  });
  const panel=page.locator("#panel"),button=name=>panel.getByRole("button",{name,exact:true});
  await page.waitForFunction(()=>audioCalls.some(c=>c.fx==="Pt01Intro"));
  check(await page.evaluate(()=>myScene.sound.voice.buffer.duration>10),"Full original music introduction decodes");
  // A newer request cancels queued follow-up clips, including during decode.
  await page.evaluate(async()=>{
    const {speakSequence}=await import("./narration.mjs");
    audioCalls.length=0;
    window.cancelledLesson=speakSequence(myScene,[["VocMmJezVO","Pt01Intro"],["VocMmJezVO","Wrong02"]]);
    await myScene.voice("VocMmJezVO","Idle01");
  });
  check(await page.evaluate(async()=>await cancelledLesson===false && !audioCalls.some(c=>c.fx==="Wrong02")),"A newer voice cancels the rest of a lesson");
  await page.evaluate(async()=>{
    const {speakSequence}=await import("./narration.mjs");
    audioCalls.length=0;
    window.departingLesson=speakSequence(myScene,[["VocMmJezVO","Pt01Intro"],["VocMmJezVO","Wrong02"]]);
    await myScene.street(4);
  });
  check(await page.evaluate(async()=>await departingLesson===false && !audioCalls.some(c=>c.fx==="Wrong02")),"Leaving a scene cancels queued narration");

  await page.evaluate(()=>myScene.go("ScMmMusMix"));
  const solution=await page.evaluate(()=>{
    const g=myScene,b=g.d(g.week.MUSIC_MIX[0]),r=g.r(g.week.MUSIC_MIX[0]);
    return [1,2,3,4].map(i=>r.findIndex(x=>x[`CORRECT${i}`]));
  });
  for(let i=0;i<4;i++)await panel.locator("select").nth(i).selectOption(String(solution[i]));
  await page.evaluate(()=>audioCalls.length=0);
  await button("Done · check my mix").click();
  await page.waitForFunction(()=>audioCalls.some(c=>c.fx==="Pt02MixIntro"));
  check(await page.evaluate(()=>{
    const clips=audioCalls.filter(c=>c.name.startsWith("VocMm"));
    return /^PosFeedback/.test(clips[0]?.fx) && clips[1]?.fx==="Correct01" && clips[2]?.fx==="Pt02MixIntro";
  }),"Character feedback, payment dialogue and freestyle lesson play in order");
  await page.evaluate(()=>myScene.go("ScMmMusMix"));
  await page.waitForFunction(()=>audioCalls.some(c=>c.name==="VocMmVOBar"&&c.fx==="Pt02Intro01"));
  check(true,"Returning to freestyle uses the character's second-stage introduction");
  await page.evaluate(()=>audioCalls.length=0);
  await button("Done · finish recording").click();
  await page.waitForFunction(()=>myScene.scene==="ScStStreet");
  check(await page.evaluate(()=>audioCalls.some(c=>c.fx==="PosFeedback01"&&c.name==="VocMmJezVO")),"Finished music plays the original take-home response before exiting");

  const contexts=await page.evaluate(async()=>{
    const {helpContext}=await import("./fidelity.mjs"),g=myScene,results=[];
    g.scene="ScMmMusMix";
    for(const mode of ["mix","effects"])for(const playing of [false,true]){
      g.activity(g.scene,{}).mode=mode;g.sound.sources=playing?[{stop(){}}]:[];
      results.push({mode,playing,context:helpContext(g)[0]});
    }
    g.sound.sources=[];g.scene="ScBaBarApt";
    for(const week of [1,2,3])for(const apartment of ["Barbie","Chelsea","Madison"]){
      g.p.week=week;g.p.apartment=apartment;
      results.push({apartment,week,context:helpContext(g)[0],idle:helpContext(g,true)[0],voice:helpContext(g)[1]});
    }
    g.p.week=1;return results;
  });
  check(contexts.filter(c=>c.mode).every(c=>c.context===(c.mode==="effects"?"DctMmHelpMix":"DctMmHelp")),"Music Help follows stage independently of playback");
  const apt={Barbie:["DctBaHelpMp3","DctBaIdleMp3","VocBaBarVO"],Chelsea:["DctBaHelpChe","DctBaIdleChe","VocBaChelVO"],Madison:["DctBaHelp","DctBaIdle","VocBaMadVO"]};
  check(contexts.filter(c=>c.apartment).every(c=>[c.context,c.idle,c.voice].join()===apt[c.apartment].join()),"Help and idle follow the visited apartment for all three active girls");

  await page.evaluate(async()=>{
    const g=myScene;g.activity("ScMmMusMix",{}).mode="mix";await g.go("ScMmMusMix");
    normalSpeed=true;window.cueSource=await g.voice("VocMmJezVO","Help01");
    window.drawnCueEffects={};window.effectBeforeCue=g.e.effect;
    g.e.effect=function(name,fx){if(/^AniMmLight/.test(name))drawnCueEffects[name]=fx;return effectBeforeCue.call(this,name,fx);};
  });
  await page.waitForFunction(()=>drawnCueEffects.AniMmLightRed01==="On");
  check(await page.evaluate(()=>[1,2,3,4].every(i=>drawnCueEffects[`AniMmLightRed0${i}`]==="On")),"All four red lights respond to the 2.4-second native cue");
  await page.waitForFunction(()=>drawnCueEffects.AniMmLightGreen01==="On");
  check(await page.evaluate(()=>[1,2,3,4].every(i=>drawnCueEffects[`AniMmLightGreen0${i}`]==="On")),"All four green lights respond to the 6.2-second native cue");
  await page.evaluate(()=>myScene.sound.stopVoice());
  await page.waitForFunction(()=>drawnCueEffects.AniMmLightGreen01==="Off" && myScene.e.cues.size===0);
  check(true,"Interrupted cue lights return to Off");
  check(await page.evaluate(async()=>{
    myScene.e.effect=effectBeforeCue;
    await myScene.voice("VocCdVO","PostIt");
    const cue=myScene.e.cues.get("BtnZzPostIt");
    myScene.sound.stopVoice();
    return cue?.fx==="Highlight" && cue.duration===1;
  }),"The shorter post-it cue resolves to its original highlight effect");
  check(errors.length===0,`No page errors: ${errors.join("; ")}`);
  return {checks};
}
