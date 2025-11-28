(function () {
  let initialized = false;

  function initIfReady() {
    if (initialized) return;

    const scroller =
      document.getElementById("jmuse-scroller-component") ||
      document.querySelector("#jmuse-scroller, [id*='jmuse-scroller']");

    if (!scroller) return; // not ready yet

    initialized = true;
    setupScoreScribble(scroller);
  }

  function setupScoreScribble(scroller) {
    // Make sure we can absolutely-position inside scroller
    const prevPos = getComputedStyle(scroller).position;
    if (prevPos === "static" || !prevPos) {
      scroller.style.position = "relative";
    }

    // --- Canvas overlay ---
    const canvas = document.createElement("canvas");
    canvas.id = "scorescribble-overlay";
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.zIndex = "9999";
    canvas.style.pointerEvents = "auto"; // toggled by mode
    scroller.appendChild(canvas);

    const ctx = canvas.getContext("2d");

    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const width = scroller.clientWidth;
      const height = scroller.scrollHeight; // all pages

      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // --- Header bar at top of page ---
    let scribbleEnabled = true;
    let headerCollapsed = false;

    const header = document.createElement("div");
    header.id = "scorescribble-header";

    Object.assign(header.style, {
      position: "fixed",
      top: "0",
      left: "0",
      right: "0",
      height: "26px",
      zIndex: "10000",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "2px 8px",
      fontSize: "12px",
      fontFamily: "system-ui, sans-serif",
      background: "rgba(255,255,255,0.95)",
      borderBottom: "1px solid #ccc",
      boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
      color: "#333",
      pointerEvents: "auto",
    });

    const title = document.createElement("span");
    title.textContent = "ScoreScribble";
    title.style.fontWeight = "600";

    const minBtn = document.createElement("button");
    minBtn.textContent = "–";
    Object.assign(minBtn.style, {
      border: "1px solid #ccc",
      background: "#f5f5f5",
      borderRadius: "3px",
      padding: "0 6px",
      cursor: "pointer",
      fontSize: "12px",
    });

    const toggleBtn = document.createElement("button");
    Object.assign(toggleBtn.style, {
      border: "1px solid #ccc",
      background: "#fff",
      borderRadius: "3px",
      padding: "0 8px",
      cursor: "pointer",
      fontSize: "12px",
    });

    function updateModeUI() {
      toggleBtn.textContent = scribbleEnabled
        ? "Stop scribbling"
        : "Start scribbling";
      canvas.style.pointerEvents = scribbleEnabled ? "auto" : "none";
      canvas.style.cursor = scribbleEnabled ? "crosshair" : "default";
    }

    function updateHeaderUI() {
      if (headerCollapsed) {
        header.style.height = "16px";
        header.style.padding = "0 6px";
        title.style.display = "none";
        toggleBtn.style.display = "none";
        minBtn.textContent = "+";
      } else {
        header.style.height = "26px";
        header.style.padding = "2px 8px";
        title.style.display = "inline";
        toggleBtn.style.display = "inline-block";
        minBtn.textContent = "–";
      }
    }

    minBtn.addEventListener("click", () => {
      headerCollapsed = !headerCollapsed;
      updateHeaderUI();
    });

    toggleBtn.addEventListener("click", () => {
      scribbleEnabled = !scribbleEnabled;
      updateModeUI();
    });

    header.appendChild(title);
    header.appendChild(toggleBtn);
    header.appendChild(minBtn);
    document.body.appendChild(header);

    updateModeUI();
    updateHeaderUI();

    // --- Drawing logic ---
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
      if (!scribbleEnabled) return;
      e.preventDefault();
      drawing = true;
      const { x, y } = getPos(e);
      lastX = x;
      lastY = y;
    }

    function draw(e) {
      if (!drawing || !scribbleEnabled) return;
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
  }

  // Try immediately (in case the element is already there)
  initIfReady();

  // Watch DOM mutations for when MuseScore injects the scroller
  const observer = new MutationObserver(() => {
    if (initialized) {
      observer.disconnect();
      return;
    }
    initIfReady();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // Also try on window load as a fallback
  window.addEventListener("load", initIfReady);
})();
