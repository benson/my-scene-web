import { waitForVoice } from "./story.mjs";

// A newer spoken request or a scene change cancels the rest of a lesson.
export async function speakSequence(g, clips, guard = () => true) {
  const profile = g.p, scene = g.scene, load = g.loadToken;
  for (const [name, fx, options] of clips.filter(Boolean)) {
    if (g.p !== profile || g.scene !== scene || g.loadToken !== load || !guard()) return false;
    const request = g.voice(name, fx, options);
    const token = g.sound.requests.get("voice");
    await waitForVoice(request);
    if (g.sound.requests.get("voice") !== token) return false;
  }
  return g.p === profile && g.scene === scene && g.loadToken === load && guard();
}

export function firstVisit(g, key) {
  const visits = (g.p.visits ||= {}), first = !visits[key];
  visits[key] = true;
  g.save();
  return first;
}

export const oneOf = values => values[Math.floor(Math.random() * values.length)];

export async function leaveAfterVoice(g, clips) {
  const profile = g.p, scene = g.scene, load = g.loadToken;
  await speakSequence(g, clips);
  if (g.p === profile && g.scene === scene && g.loadToken === load) await g.street(g.p.area);
}
