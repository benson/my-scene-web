export function installCutscenes(g) {
  const overlay = document.querySelector("#overlay");
  g.movieControls = false;
  g.movie = (name, done, options = {}) => {
    g.cancelMovie?.();
    const file = ({ intro: "VidStGameIntro", "subway-bar": "SubwayTranBar", "subway-che": "SubwayTranChel", "subway-mad": "SubwayTranMad" })[name] || name.replace(/Smk$/, "");
    const previousFocus = document.activeElement;
    const background = [...document.querySelectorAll("#hotspots, #signin-name, #panel, #quick, #browser-options")].map(el => [el, el.inert]);
    background.forEach(([el]) => { el.inert = true; });
    const video = document.createElement("video");
    video.src = `assets/movies/${file}.mp4`;
    video.controls = g.movieControls;
    video.playsInline = true;
    video.autoplay = true;
    video.muted = g.sound.muted || g.sound.context?.state !== "running";
    video.setAttribute("aria-label", "Game cutscene");
    let ended = false, timer;
    const listeners = new AbortController();
    const cancel = () => {
      if (ended) return;
      ended = true;
      clearTimeout(timer); listeners.abort(); video.pause();
      overlay.replaceChildren(); overlay.hidden = true;
      overlay.classList.remove("cutscene-active", "cutscene-awake");
      document.body.classList.remove("playing-cutscene");
      background.forEach(([el, inert]) => { el.inert = inert; });
      g.cancelMovie = null;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
    const finish = (skipped = false) => {
      if (ended) return;
      cancel();
      if (skipped && options.onSkip) options.onSkip(); else done?.();
    };
    g.cancelMovie = cancel;
    overlay.replaceChildren(video); overlay.hidden = false;
    overlay.classList.add("cutscene-active");
    document.body.classList.add("playing-cutscene");
    overlay.tabIndex = -1;
    overlay.focus({ preventScroll: true });
    const reveal = () => {
      overlay.classList.add("cutscene-awake"); clearTimeout(timer);
      timer = setTimeout(() => overlay.classList.remove("cutscene-awake"), 1800);
    };
    const skip = g.btn("Skip", () => finish(true), overlay, "video-close");
    skip.setAttribute("aria-label", "Skip cutscene");
    const play = g.btn("Play", () => { g.sound.activate().then(() => { video.muted = g.sound.muted; return video.play(); }).catch(() => {}); }, overlay, "video-play");
    play.hidden = true;
    video.onplaying = () => { play.hidden = true; };
    overlay.addEventListener("pointermove", reveal, { signal: listeners.signal });
    overlay.addEventListener("pointerdown", reveal, { signal: listeners.signal });
    document.addEventListener("keydown", ev => {
      if (ev.key === "Escape") { ev.preventDefault(); ev.stopImmediatePropagation(); finish(true); return; }
      if (ev.key === "Tab") reveal();
      // Keep gameplay shortcuts from acting underneath the movie.
      ev.stopImmediatePropagation();
    }, { capture: true, signal: listeners.signal });
    video.onended = () => finish();
    video.onerror = () => { g.text("This movie could not load. You can carry on playing."); finish(); };
    video.play().catch(() => { if (!ended) play.hidden = false; });
  };
}
