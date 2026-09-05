// Run in a disposable Playwright CLI browser. Each invocation audits the next
// three weekends; run four times. Controlled fixtures bypass travel/unlocks.
// Sound requests are recorded/resolved, not played. This is not gesture QA.
async page => {
  await page.waitForFunction(()=>window.myScene && document.querySelector("#loading").hidden);
  const result=await page.evaluate(async()=>{
    const g=myScene;
    if (!window.parityAudit) {
      g.cancelMovie?.();
      window.parityAudit={next:1,observations:[],sounds:[],exceptions:[]};
      g.sound.play=async (name,fx,options={})=>{
        const key=g.sound.key(name,fx);
        parityAudit.sounds.push({week:g.p?.week,scene:g.scene,name,fx:fx || null,channel:options.channel || "voice",key:key || null});
        return null;
      };
      await g.load({version:1,id:crypto.randomUUID(),name:"Parity audit",week:1,money:40,weeks:{},activities:{},designs:[],photos:[],boys:[],quizzes:{},jumbles:{},area:4,x:400,location:"ScStStreet",completedWeeks:[],created:Date.now()});
      g.e.render=()=>{}; // Prevent random pedestrian/idle speech contaminating entry logs.
    }
    const audit=parityAudit,start=audit.next,end=Math.min(12,start+2);
    const scenes=["ScClClothesDt","ScClClothesUe","ScClClothesVil","ScAcAccess","ScMuMakeUp","ScGtGift","ScFdFood","ScCsCDShop","ScCdClothesDes","ScWdWinDress","ScMmMusMix","ScBaBarApt"];
    for(let week=start;week<=end;week++) {
      g.p.week=week; g.p.activities={}; g.p.weeks[week]={done:[],bought:[],jobs:{},calls:[],guess:{}};
      for(const scene of scenes) {
        const before=audit.sounds.length;
        try {
          await g.go(scene);
          const entry=audit.sounds.slice(before);
          audit.observations.push({week,scene,character:g.character,open:g.canEnter(scene),
            entryVoice:entry.filter(s=>s.channel==="voice"),entryAmbient:entry.filter(s=>s.channel==="ambient"),
            title:document.querySelector("#panel h1")?.textContent,
            briefCount:(scene==="ScCdClothesDes"?g.week.CLOTHING_DESIGN_DICT:scene==="ScWdWinDress"?g.week.WINDOW_DRESS_DICT:scene==="ScMmMusMix"?g.week.MUSIC_MIX:[])?.length || 0});
        } catch(e) { audit.exceptions.push({week,scene,message:e.message}); }
      }
    }
    audit.next=end+1;
    return {weeks:[start,end],entries:audit.observations.length,exceptions:audit.exceptions,missingSoundRequests:audit.sounds.filter(s=>!s.key)};
  });
  return result;
}
