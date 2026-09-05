// Read-only audit of the recovered data and current sound/help routing.
// Does not claim that a present asset is reachable or that an unreferenced asset
// was used by the original release. Run: node tools/audit_parity.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { Sound, rows } from "../web/engine.mjs";
import { helpContext } from "../web/fidelity.mjs";

const data = JSON.parse(fs.readFileSync(new URL("../web/assets/game-data.json", import.meta.url)));
const sound = new Sound(data), d = name => data.dictionaries[name] || {};
const records = [];
const check = (area, name, fx, context = {}) => {
  const key = sound.key(name, fx);
  records.push({area, name, ...(fx ? {fx} : {}), ...context, key: key || null, valid: !!data.audio[key]});
};
let modal = "";
globalThis.document = {querySelector: () => ({open:!!modal,getAttribute:()=>modal})};
const scenes = ["ScStStreet","ScBaBarApt","ScClClothesDt","ScClClothesUe","ScClClothesVil","ScAcAccess","ScMuMakeUp","ScGtGift","ScFdFood","ScCsCDShop","ScCdClothesDes","ScWdWinDress","ScMmMusMix"];
const weeks = [];
for (let week=1;week<=12;week++) {
  const w = d(`DctTaskWk${String(week).padStart(2,"0")}`), doll=d(w.DOLL_DICT);
  const pre=["Bar","Che","Mad"][doll.DOLL_IDX], character=["Barbie","Chelsea","Madison"][doll.DOLL_IDX];
  weeks.push({week,character,intro:w.WEEK_INTRO_SP,taskCount:rows(w).length,finalScene:w.FINAL_LOCATION,finalArea:w.FINAL_LOCATION_ID,
    calls:(w.PHONE_CALLS || []).map((name,i)=>({name,trigger:w.PHONE_CALLS_TRIGGER_TASK[i],title:w.PHONE_CALLS_TEXT[i]})),
    messages:(w.PHONE_MSG_TEXT || []).map((title,i)=>({title,trigger:w.PHONE_MSG_TRIGGER_TASK?.[i] || 0,voice:w.PHONE_MSG_VO?.[i] || null})),
    clothingBriefs:w.CLOTHING_DESIGN_DICT?.length || 0,windowBriefs:w.WINDOW_DRESS_DICT?.length || 0,musicBriefs:w.MUSIC_MIX?.length || 0});
  if (typeof w.WEEK_INTRO_SP === "string") check("week-intro",w.WEEK_INTRO_SP,"Anim",{week});
  for (const fx of w.PHONE_CALLS || []) check("phone-call","VocZzCellMessages",fx,{week});
  for (const fx of w.PHONE_MSG_VO || []) if (fx) check("phone-message","VocZzCellMessages",fx,{week});
  for (const scene of scenes) for (const done of [false,true]) for (const playing of [false,true]) {
    const g={d,r:n=>rows(d(n)),data,pre,character,doll,scene,world:d("DctStreetWorld3"),
      p:{week,area:3,activities:{[`${week}:${scene}`]:{mode:playing?"effects":"mix"}}},
      taskFor:()=>rows(w).filter(t=>t.SCENE===scene).map((t,index)=>({...t,index})),
      progress:{done:done?[0,1,2,3,4]:[]},sound:{sources:playing?[1,2,3,4]:[]}};
    for (const title of ["", ...(scene==="ScStStreet"?["Your phone","City map","My scrapbook"]:[])]) {
      modal=title;
      for (const idle of [false,true]) {
        const context=helpContext(g,idle);
        if (!context) continue;
        const [dict,voice]=context;
        for (const row of rows(d(dict))) if (row.FX) check("help",voice,row.FX,{week,scene,dict,done,playing,modal:title,idle});
      }
    }
    modal="";
  }
}
for (const pre of ["Bar","Chel","Mad"]) {
  for (const fx of ["AptIntroBar","AptIntroChel","AptIntroMad","Idle","ClickMp3"]) check("apartment",`VocBa${pre}VO`,fx);
}
for (const [scene,name,effects] of [
  ["ScCdClothesDes","VocCdVO",["FeedbackWrong","FeedbackGood"]],
  ["ScWdWinDress","VocWdVO",["NotSoGood","Good"]],
  ["ScMmMusMix","VocMmJezVO",["Pt01Intro","Wrong02","Correct01","Pt02MixIntro"]],
  ["ScStStreet","VocStBarbieVO",["Intro","HelpOpenPhoneIntro","HelpGettingAround","PhoneRing","HelpSubwayMap"]],
]) for (const fx of effects) check("explicit",name,fx,{scene});
const unique = list => [...new Map(list.map(r=>[JSON.stringify(r),r])).values()];
const unresolved=unique(records.filter(r=>!r.valid));
const voiceInventory = Object.entries(data.sprites).flatMap(([name,s])=>Object.entries(s.effects || {}).filter(([,f])=>f.sound).map(([fx,f])=>({name,fx,key:f.sound,hasFile:!!data.audio[f.sound]})));
const music = Object.keys(data.sprites).filter(n=>n.startsWith("SndCsCd"));
const cueFormats = {};
for (const [name,s] of Object.entries(data.sprites)) for (const [fx,f] of Object.entries(s.effects || {})) {
  const cues=f.properties?.CUELIST || [];
  for (let i=0;i<cues.length;i+=3) {
    const label=String(cues[i+2]);
    const kind=/^(.+)_(Highlight|Flash|Down)_(\d+)_(\w+)$/.test(label)?"implemented-pattern":"unhandled-pattern";
    (cueFormats[kind] ||= []).push({name,fx,at:cues[i+1],label});
  }
}
const output={
  sourceCommit:execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),
  workingTreeChanges:execFileSync("git",["diff","--name-only","--","web"],{encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean),
  scope:"Static resolution, not native reachability or complete runtime parity",
  counts:{images:Object.keys(data.images).length,audioFiles:Object.keys(data.audio).length,sprites:Object.keys(data.sprites).length,scenes:Object.keys(data.scenes).length,dictionaries:Object.keys(data.dictionaries).length,voicedEffects:voiceInventory.length,soundChecks:records.length,unresolvedChecks:unresolved.length},
  weeks,unresolved,
  originalSceneNames:Object.keys(data.scenes),
  voiceInventory,
  cdLoopsOutsideLibrary:music.filter(n=>!/^SndCsCd(?:HipHop|Dance|Rock)/.test(n)),
  cueFormats,
};
fs.writeFileSync(new URL("../research/parity-audit-data.json",import.meta.url),JSON.stringify(output,null,2)+"\n");
console.log(JSON.stringify({counts:output.counts,unresolvedSoundPairs:unique(unresolved.map(({name,fx})=>({name,fx}))),unhandledCueCount:cueFormats["unhandled-pattern"]?.length || 0},null,2));
