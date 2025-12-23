Update ONLY the existing loading bar (glow + underglow) to use the CodePen-style width fill, but modern + smooth. No new UI, no overlays, no jQuery.

Replace the current JS that sets/animates width with:
- A `targetProgress` (0..1) set by the Pixi loader
- A `visualProgress` eased toward target via requestAnimationFrame:
  visual += (target - visual) * 0.12
- Every frame set:
  glow.style.width = (visualProgress*100).toFixed(2)+"%"
  underglow.style.width = same

Expose a single global function Pixi can call:
- `window.setLoadingProgress(p)` clamps 0..1, updates targetProgress, ensures the rAF loop is running.

Pixi integration:
- Hook Pixi asset loading progress into `window.setLoadingProgress(progress)`.
- On completion call `window.setLoadingProgress(1)` and optionally keep full glow for ~200ms before hiding loader (whatever your current “hide loader” mechanism is).

Keep CSS flicker as-is. Do not modify HTML structure. Remove any jQuery dependency.

EXAMPLE code: 
@import url(https://fonts.googleapis.com/css?family=Lato:100,300,400,700);

html, body {
  height: 100%;
  margin: 0;
}
body {
  font-family: 'Lato', sans-serif;
  background: linear-gradient(to bottom, rgba(0,0,0,1) 0%,rgba(17,17,17,1) 100%);
}

.loader {
  height: 30px;
  width: 500px;
  border: 2px solid #666;
  border-radius: 20px;
  position: relative;
  font-weight: 300; 
  font-size: 18px;
  position: absolute; top: 0; bottom: 0; left: 0; right: 0;
  margin: auto;
}
.loader:after {
  content: "";
  display: block;
  width: 100%;
  height: 100%;
  background: linear-gradient(to bottom, rgba(255,255,255,0) 0%,rgba(255,255,255,0.2) 50%,rgba(255,255,255,0) 100%);
  position: absolute;
  top: 0;
  left: 0;

}
.track {
  width: 100%;
  height: 100%;
  border-radius: 20px;
  color: #fff;
  text-align: center;
  line-height: 30px;
  overflow: hidden;
  position: relative;
  opacity: 0.99;

}
.glow {
  width: 0%;
  height: 100%;
  background: linear-gradient(to bottom, rgba(210,255,82,1) 0%,rgba(145,232,66,1) 100%);
  box-shadow: 0px 0px 14px 1px rgba(145,232,66,1);
  position: absolute;
  top: 0;
  left: 0;
  animation: flicker 5s infinite;
  overflow: hidden;

}
.underglow {
  width: 0%;
  height: 0%;
  border-radius: 20px;
  box-shadow: 0px 0px 60px 10px rgba(145,232,66,1);
  position: absolute;
  bottom: -5px;
  animation: flicker 5s infinite;
}
.front {
  color: #000;
  font-weight: 400;
}
.back {
  color: #222;
}

@keyframes flicker {
  10% {
    opacity: 0.9;
  }
  30% {
    opacity: 0.86;
  }
  60% {
    opacity: 0.8;
  }
  80% {
    opacity: 0.75;
  }
}

var width = 100;
var time = 4000;

$(".glow").animate({
  width: width + "%"
}, time);

$(".underglow").animate({
  width: width + "%"
}, time);

function barWidth() {
    var barWidth = $(".track").width();
    $(".front").css("width", barWidth);
}
barWidth();

<div class="loader">
  <div class="track">
    <div class="glow">
      <div class="front">LOADING</div>
    </div>

    <span class="back">LOADING</span>
  </div>

  <div class="underglow"></div>
</div>