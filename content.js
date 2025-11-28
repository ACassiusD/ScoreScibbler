(function () {
  const scroller =
    document.getElementById("jmuse-scroller-component") ||
    document.querySelector("#jmuse-scroller, [id*='jmuse-scroller']");

  if (!scroller) {
    console.warn("ScoreScribble: scroller not found");
    return;
  }

  // Make sure we can absolutely-position inside
  const prevPos = getComputedStyle(scroller).position;
  if (prevPos === "static" || !prevPos) {
    scroller.style.position = "relative";
  }

  const canvas = document.createElement("canvas");
  canvas.id = "scorescribble-overlay";
  canvas.style.position = "absolute";
  canvas.style.top = "0";
  canvas.style.left = "0";
  canvas.style.zIndex = "9999";
  canvas.style.pointerEvents = "auto"; // or "none" if you later add a separate drawing mode toggle

  scroller.appendChild(canvas);
  const ctx = canvas.getContext("2d");

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = scroller.clientWidth;
    const height = scroller.scrollHeight; // full scrollable area

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  resizeCanvas();

  // If MuseScore adds pages dynamically / resizes, you can call resizeCanvas again
  window.addEventListener("resize", resizeCanvas);

  let drawing = false;
  let lastX = 0;
  let lastY = 0;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing = true;
    const { x, y } = getPos(e);
    lastX = x;
    lastY = y;
  }

  function draw(e) {
    if (!drawing) return;
    e.preventDefault();
    const { x, y } = getPos(e);

    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "red";

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();

    lastX = x;
    lastY = y;
  }

  function endDraw() {
    drawing = false;
  }

  canvas.addEventListener("mousedown", startDraw);
  canvas.addEventListener("mousemove", draw);
  canvas.addEventListener("mouseup", endDraw);
  canvas.addEventListener("mouseleave", endDraw);

  canvas.addEventListener("touchstart", startDraw, { passive: false });
  canvas.addEventListener("touchmove", draw, { passive: false });
  canvas.addEventListener("touchend", endDraw, { passive: false });
})();


