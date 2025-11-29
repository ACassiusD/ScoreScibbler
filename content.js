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

    // --- Eraser cursor indicator ---
    let eraserSize = 20; // px (visual + lineWidth)
    const penSize = 2;
    const minEraserSize = 5;
    const maxEraserSize = 100;

    const eraserCursor = document.createElement("div");
    Object.assign(eraserCursor.style, {
      position: "fixed",
      width: eraserSize + "px",
      height: eraserSize + "px",
      borderRadius: "50%",
      border: "2px solid red",
      boxSizing: "border-box",
      pointerEvents: "none",
      zIndex: "10001",
      display: "none",
    });
    document.body.appendChild(eraserCursor);

    function updateEraserCursorFromEvent(e) {
      if (!e || !e.clientX) return;
      const x = e.clientX - eraserSize / 2;
      const y = e.clientY - eraserSize / 2;
      eraserCursor.style.left = x + "px";
      eraserCursor.style.top = y + "px";
      eraserCursor.style.display = "block";
    }

    function hideEraserCursor() {
      eraserCursor.style.display = "none";
    }

    function resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const width = scroller.clientWidth;
      const height = scroller.scrollHeight; // all pages

      // Backup current drawing
      let backup = null;
      if (canvas.width && canvas.height) {
        backup = document.createElement("canvas");
        backup.width = canvas.width;
        backup.height = canvas.height;
        const bctx = backup.getContext("2d");
        bctx.drawImage(canvas, 0, 0);
      }

      canvas.style.width = width + "px";
      canvas.style.height = height + "px";

      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Restore drawing (scaled to new CSS size)
      if (backup) {
        ctx.drawImage(backup, 0, 0, width, height);
      }
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // React when MuseScore resizes the score area (e.g. sidebar toggle)
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        resizeCanvas();
      });
      ro.observe(scroller);
    } else {
      // Fallback: poll size
      let lastWidth = scroller.clientWidth;
      let lastHeight = scroller.scrollHeight;
      setInterval(() => {
        const w = scroller.clientWidth;
        const h = scroller.scrollHeight;
        if (w !== lastWidth || h !== lastHeight) {
          lastWidth = w;
          lastHeight = h;
          resizeCanvas();
        }
      }, 500);
    }

    // --- Header bar at top of page ---
    let scribbleEnabled = true;
    let headerCollapsed = false;
    let drawMode = "pen"; // "pen" | "eraser"

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
      background: "rgba(26, 26, 26, 0.95)",
      borderBottom: "1px solid #444",
      boxShadow: "0 1px 2px rgba(0,0,0,0.3)",
      color: "#e0e0e0",
      pointerEvents: "auto",
    });

    const title = document.createElement("span");
    title.textContent = "ScoreScribble";
    title.style.fontWeight = "600";

    const minBtn = document.createElement("button");
    minBtn.textContent = "↓";
    Object.assign(minBtn.style, {
      border: "1px solid #555",
      background: "#333",
      borderRadius: "3px",
      padding: "0 6px",
      cursor: "pointer",
      fontSize: "12px",
      marginLeft: "auto",
      color: "#e0e0e0",
    });

    const toggleBtn = document.createElement("button"); // Start/Stop scribbling
    Object.assign(toggleBtn.style, {
      border: "1px solid #555",
      background: "#333",
      borderRadius: "3px",
      padding: "0 8px",
      cursor: "pointer",
      fontSize: "12px",
      color: "#e0e0e0",
    });

    const eraserBtn = document.createElement("button");
    eraserBtn.textContent = "Eraser";
    Object.assign(eraserBtn.style, {
      border: "1px solid #555",
      background: "#333",
      borderRadius: "3px",
      padding: "0 8px",
      cursor: "pointer",
      fontSize: "12px",
      color: "#e0e0e0",
    });

    const clearBtn = document.createElement("button");
    clearBtn.textContent = "Clear scribble";
    Object.assign(clearBtn.style, {
      border: "1px solid #cc4444",
      background: "#5a2a2a",
      borderRadius: "3px",
      padding: "0 8px",
      cursor: "pointer",
      fontSize: "12px",
      color: "#ff9999",
    });

    const eraserLabel = document.createElement("span");
    eraserLabel.textContent = `Eraser: ${eraserSize}px`;
    eraserLabel.style.opacity = "0.8";
    eraserLabel.style.color = "#b0b0b0";

    const eraserSizeDownBtn = document.createElement("button");
    eraserSizeDownBtn.textContent = "−";
    Object.assign(eraserSizeDownBtn.style, {
      border: "1px solid #555",
      background: "#333",
      borderRadius: "3px",
      padding: "0 6px",
      cursor: "pointer",
      fontSize: "14px",
      lineHeight: "1",
      width: "20px",
      color: "#e0e0e0",
    });

    const eraserSizeUpBtn = document.createElement("button");
    eraserSizeUpBtn.textContent = "+";
    Object.assign(eraserSizeUpBtn.style, {
      border: "1px solid #555",
      background: "#333",
      borderRadius: "3px",
      padding: "0 6px",
      cursor: "pointer",
      fontSize: "14px",
      lineHeight: "1",
      width: "20px",
      color: "#e0e0e0",
    });

    function updateEraserSize(newSize) {
      eraserSize = Math.max(minEraserSize, Math.min(maxEraserSize, newSize));
      eraserLabel.textContent = `Eraser: ${eraserSize}px`;
      eraserCursor.style.width = eraserSize + "px";
      eraserCursor.style.height = eraserSize + "px";
    }

    function updateModeUI() {
      // scribble on/off
      toggleBtn.textContent = scribbleEnabled
        ? "Stop scribbling"
        : "Start scribbling";

      if (!scribbleEnabled) {
        canvas.style.pointerEvents = "none";
        canvas.style.cursor = "default";
        hideEraserCursor();
      } else {
        canvas.style.pointerEvents = "auto";
        if (drawMode === "eraser") {
          canvas.style.cursor = "none";
        } else {
          canvas.style.cursor = "crosshair";
          hideEraserCursor();
        }
      }

      // eraser button visual state
      if (drawMode === "eraser") {
        eraserBtn.style.background = "#5a2a2a";
        eraserBtn.style.borderColor = "#cc4444";
      } else {
        eraserBtn.style.background = "#333";
        eraserBtn.style.borderColor = "#555";
      }
    }

    function updateHeaderUI() {
      if (headerCollapsed) {
        header.style.height = "16px";
        header.style.padding = "0 6px";
        title.style.display = "none";
        toggleBtn.style.display = "none";
        eraserBtn.style.display = "none";
        clearBtn.style.display = "none";
        eraserLabel.style.display = "none";
        eraserSizeDownBtn.style.display = "none";
        eraserSizeUpBtn.style.display = "none";
        minBtn.textContent = "↑";
        document.body.style.paddingTop = "16px";
      } else {
        header.style.height = "26px";
        header.style.padding = "2px 8px";
        title.style.display = "inline";
        toggleBtn.style.display = "inline-block";
        eraserBtn.style.display = "inline-block";
        clearBtn.style.display = "inline-block";
        eraserLabel.style.display = "inline";
        eraserSizeDownBtn.style.display = "inline-block";
        eraserSizeUpBtn.style.display = "inline-block";
        minBtn.textContent = "↓";
        document.body.style.paddingTop = "26px";
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

    eraserBtn.addEventListener("click", () => {
      drawMode = drawMode === "eraser" ? "pen" : "eraser";
      updateModeUI();
    });

    clearBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear all scribble?")) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    eraserSizeDownBtn.addEventListener("click", () => {
      updateEraserSize(eraserSize - 5);
    });

    eraserSizeUpBtn.addEventListener("click", () => {
      updateEraserSize(eraserSize + 5);
    });

    header.appendChild(title);
    header.appendChild(toggleBtn);
    header.appendChild(eraserBtn);
    header.appendChild(clearBtn);
    header.appendChild(eraserSizeDownBtn);
    header.appendChild(eraserLabel);
    header.appendChild(eraserSizeUpBtn);
    header.appendChild(minBtn);
    document.body.appendChild(header);

    updateModeUI();
    updateHeaderUI(); // This will set the initial body padding

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
        clientX,
        clientY,
      };
    }

    function startDraw(e) {
      if (!scribbleEnabled) return;
      e.preventDefault();
      const { x, y, clientX, clientY } = getPos(e);
      drawing = true;
      lastX = x;
      lastY = y;

      if (scribbleEnabled && drawMode === "eraser" && clientX && clientY) {
        updateEraserCursorFromEvent({ clientX, clientY });
      }
    }

    function draw(e) {
      if (!drawing || !scribbleEnabled) return;
      e.preventDefault();
      const { x, y, clientX, clientY } = getPos(e);

      if (drawMode === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = eraserSize;
      } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = penSize;
        ctx.strokeStyle = "red";
      }

      ctx.lineJoin = "round";
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(lastX, lastY);
      ctx.lineTo(x, y);
      ctx.stroke();

      lastX = x;
      lastY = y;

      if (scribbleEnabled && drawMode === "eraser" && clientX && clientY) {
        updateEraserCursorFromEvent({ clientX, clientY });
      }
    }

    function endDraw() {
      drawing = false;
      if (drawMode === "eraser") {
        hideEraserCursor();
      }
    }

    function handleMouseMove(e) {
      if (!scribbleEnabled) {
        hideEraserCursor();
        return;
      }
      if (!drawing && drawMode === "eraser") {
        // show indicator while hovering
        updateEraserCursorFromEvent(e);
      }
      draw(e);
    }

    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", endDraw);
    canvas.addEventListener("mouseleave", endDraw);

    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", endDraw, { passive: false });
  }

  // Try immediately
  initIfReady();

  // Watch DOM for scroller creation
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

  // Fallback
  window.addEventListener("load", initIfReady);
})();
