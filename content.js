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
    // Guard against double-injection
    if (document.getElementById("scorescribble-overlay")) return;
    if (document.getElementById("scorescribble-header")) return;

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
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // --- Eraser cursor indicator ---
    let eraserSize = 20; // px
    let penSize = 2;     // px (now variable)
    const minSize = 1;
    const maxSize = 100;

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

      // Backup current drawing with CSS dimensions for proper scaling
      let backup = null;
      let backupCssWidth = 0;
      let backupCssHeight = 0;
      if (canvas.width && canvas.height) {
        backup = document.createElement("canvas");
        backup.width = canvas.width;
        backup.height = canvas.height;
        backupCssWidth = parseFloat(canvas.style.width) || scroller.clientWidth;
        backupCssHeight = parseFloat(canvas.style.height) || scroller.scrollHeight;
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
        ctx.drawImage(
          backup,
          0,
          0,
          backupCssWidth,
          backupCssHeight,
          0,
          0,
          width,
          height
        );
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
    let drawMode = "pen"; // "pen" | "eraser" | "text"
    let penColor = "#ff0000"; // Default red

    // Text tool state
    let activeTextBox = null;
    let isDraggingText = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    // Cache original body paddingTop
    const originalPaddingTop =
      getComputedStyle(document.body).paddingTop || "0px";

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
    title.innerHTML = "ScoreScribble ♪";
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

    const textBtn = document.createElement("button");
    textBtn.textContent = "Text";
    Object.assign(textBtn.style, {
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

    // Size label + buttons (shared pen/eraser)
    const sizeLabel = document.createElement("span");
    sizeLabel.style.opacity = "0.8";
    sizeLabel.style.color = "#b0b0b0";

    const sizeDownBtn = document.createElement("button");
    sizeDownBtn.textContent = "−";
    Object.assign(sizeDownBtn.style, {
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

    const sizeUpBtn = document.createElement("button");
    sizeUpBtn.textContent = "+";
    Object.assign(sizeUpBtn.style, {
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

    const colorPicker = document.createElement("input");
    colorPicker.type = "color";
    colorPicker.value = penColor;
    Object.assign(colorPicker.style, {
      border: "1px solid #555",
      background: "#333",
      borderRadius: "3px",
      padding: "0",
      cursor: "pointer",
      width: "30px",
      height: "20px",
    });

    const infoBtn = document.createElement("button");
    infoBtn.textContent = "?";
    Object.assign(infoBtn.style, {
      border: "1px solid #555",
      background: "#333",
      borderRadius: "50%",
      padding: "0 6px",
      cursor: "pointer",
      fontSize: "12px",
      width: "22px",
      height: "22px",
      color: "#e0e0e0",
      fontWeight: "bold",
    });

    // Apply / Cancel Text buttons (only visible when text box active)
    const applyTextBtn = document.createElement("button");
    applyTextBtn.textContent = "Apply text";
    Object.assign(applyTextBtn.style, {
      border: "1px solid #4caf50",
      background: "#2e7d32",
      borderRadius: "3px",
      padding: "0 8px",
      cursor: "pointer",
      fontSize: "12px",
      color: "#c8f7c5",
      display: "none",
    });

    const cancelTextBtn = document.createElement("button");
    cancelTextBtn.textContent = "Cancel text";
    Object.assign(cancelTextBtn.style, {
      border: "1px solid #777",
      background: "#444",
      borderRadius: "3px",
      padding: "0 8px",
      cursor: "pointer",
      fontSize: "12px",
      color: "#e0e0e0",
      display: "none",
    });

    // Info modal for keyboard shortcuts
    const infoModal = document.createElement("div");
    infoModal.id = "scorescribble-info-modal";
    Object.assign(infoModal.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "#2a2a2a",
      border: "2px solid #555",
      borderRadius: "8px",
      padding: "20px",
      zIndex: "10002",
      display: "none",
      color: "#e0e0e0",
      fontFamily: "system-ui, sans-serif",
      fontSize: "14px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      minWidth: "300px",
    });

    const infoTitle = document.createElement("h3");
    infoTitle.textContent = "Keyboard Shortcuts";
    infoTitle.style.margin = "0 0 15px 0";
    infoTitle.style.color = "#fff";

    const shortcutsList = document.createElement("div");
    shortcutsList.innerHTML = `
      <div style="margin-bottom: 10px;"><strong>E</strong> - Toggle eraser mode</div>
      <div style="margin-bottom: 10px;"><strong>S</strong> - Toggle scribbling on/off</div>
      <div style="margin-bottom: 10px;"><strong>T</strong> - Toggle text mode</div>
      <div style="margin-bottom: 0; opacity: 0.7; font-size: 12px; margin-top: 15px;">
        Tip: Hold <strong>Ctrl</strong> and drag a text box to move it before applying.
      </div>
    `;

    const closeInfoBtn = document.createElement("button");
    closeInfoBtn.textContent = "Close";
    Object.assign(closeInfoBtn.style, {
      marginTop: "15px",
      border: "1px solid #555",
      background: "#333",
      borderRadius: "3px",
      padding: "6px 12px",
      cursor: "pointer",
      fontSize: "12px",
      color: "#e0e0e0",
      width: "100%",
    });

    infoModal.appendChild(infoTitle);
    infoModal.appendChild(shortcutsList);
    infoModal.appendChild(closeInfoBtn);
    document.body.appendChild(infoModal);

    let infoModalOpen = false;
    infoBtn.addEventListener("click", () => {
      infoModalOpen = !infoModalOpen;
      infoModal.style.display = infoModalOpen ? "block" : "none";
    });

    closeInfoBtn.addEventListener("click", () => {
      infoModalOpen = false;
      infoModal.style.display = "none";
    });

    infoModal.addEventListener("click", (e) => {
      if (e.target === infoModal) {
        infoModalOpen = false;
        infoModal.style.display = "none";
      }
    });

    colorPicker.addEventListener("input", (e) => {
      penColor = e.target.value;
      if (activeTextBox) {
        activeTextBox.style.color = penColor;
        activeTextBox.style.borderColor = penColor;
      }
    });

    function updateSizeLabel() {
      if (drawMode === "eraser") {
        sizeLabel.textContent = `Eraser: ${eraserSize}px`;
      } else {
        sizeLabel.textContent = `Pen: ${penSize}px`;
      }
    }

    function changeCurrentSize(delta) {
      if (drawMode === "eraser") {
        eraserSize = Math.max(minSize, Math.min(maxSize, eraserSize + delta));
        eraserCursor.style.width = eraserSize + "px";
        eraserCursor.style.height = eraserSize + "px";
      } else {
        penSize = Math.max(minSize, Math.min(maxSize, penSize + delta));
      }
      updateSizeLabel();
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
        } else if (drawMode === "text") {
          canvas.style.cursor = "text";
          hideEraserCursor();
        } else {
          canvas.style.cursor = "crosshair";
          hideEraserCursor();
        }
      }

      // button visual states
      if (drawMode === "eraser") {
        eraserBtn.style.background = "#5a2a2a";
        eraserBtn.style.borderColor = "#cc4444";
      } else {
        eraserBtn.style.background = "#333";
        eraserBtn.style.borderColor = "#555";
      }

      if (drawMode === "text") {
        textBtn.style.background = "#2e5a8a";
        textBtn.style.borderColor = "#4aa3ff";
      } else {
        textBtn.style.background = "#333";
        textBtn.style.borderColor = "#555";
      }

      updateSizeLabel();
    }

    // Floating restore button (shown when header is minimized)
    const dockBtn = document.createElement("button");
    dockBtn.textContent = "♪";
    Object.assign(dockBtn.style, {
      position: "fixed",
      top: "4px",
      left: "4px",
      zIndex: "10000",
      border: "1px solid #555",
      background: "#333",
      borderRadius: "50%",
      width: "22px",
      height: "22px",
      fontSize: "12px",
      cursor: "pointer",
      color: "#e0e0e0",
      display: "none", // only show when header is collapsed
    });
    document.body.appendChild(dockBtn);

    function updateHeaderUI() {
      if (headerCollapsed) {
        header.style.display = "none";
        document.body.style.paddingTop = originalPaddingTop;
        dockBtn.style.display = "block";
      } else {
        header.style.display = "flex";
        header.style.height = "26px";
        header.style.padding = "2px 8px";

        title.style.display = "inline";
        toggleBtn.style.display = "inline-block";
        eraserBtn.style.display = "inline-block";
        textBtn.style.display = "inline-block";
        clearBtn.style.display = "inline-block";
        sizeLabel.style.display = "inline";
        sizeDownBtn.style.display = "inline-block";
        sizeUpBtn.style.display = "inline-block";
        colorPicker.style.display = "inline-block";
        infoBtn.style.display = "inline-block";
        minBtn.textContent = "↓";

        document.body.style.paddingTop = "26px";
        dockBtn.style.display = "none";
      }
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName))
        return;

      const key = e.key.toLowerCase();
      if (key === "e") {
        drawMode = drawMode === "eraser" ? "pen" : "eraser";
        updateModeUI();
      } else if (key === "s") {
        scribbleEnabled = !scribbleEnabled;
        if (!scribbleEnabled && drawMode === "eraser") {
          drawMode = "pen";
        }
        updateModeUI();
      } else if (key === "t") {
        drawMode = drawMode === "text" ? "pen" : "text";
        updateModeUI();
      }
    });

    minBtn.addEventListener("click", () => {
      headerCollapsed = true;
      updateHeaderUI();
    });

    dockBtn.addEventListener("click", () => {
      headerCollapsed = false;
      updateHeaderUI();
    });

    toggleBtn.addEventListener("click", () => {
      scribbleEnabled = !scribbleEnabled;
      if (!scribbleEnabled && drawMode === "eraser") {
        drawMode = "pen";
      }
      updateModeUI();
    });

    eraserBtn.addEventListener("click", () => {
      drawMode = drawMode === "eraser" ? "pen" : "eraser";
      updateModeUI();
    });

    textBtn.addEventListener("click", () => {
      drawMode = drawMode === "text" ? "pen" : "text";
      updateModeUI();
    });

    clearBtn.addEventListener("click", () => {
      if (confirm("Are you sure you want to clear all scribble?")) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    sizeDownBtn.addEventListener("click", () => {
      changeCurrentSize(-2);
    });

    sizeUpBtn.addEventListener("click", () => {
      changeCurrentSize(2);
    });

    // --- Text tool helpers ---
    function showTextControls(show) {
      applyTextBtn.style.display = show ? "inline-block" : "none";
      cancelTextBtn.style.display = show ? "inline-block" : "none";
    }

    function createTextBoxAt(x, y) {
      if (activeTextBox) return; // only one at a time

      const textarea = document.createElement("textarea");
      activeTextBox = textarea;

      Object.assign(textarea.style, {
        position: "absolute",
        left: x + "px",
        top: y + "px",
        minWidth: "120px",
        minHeight: "24px",
        padding: "4px",
        border: "1px dashed " + penColor,
        color: penColor,
        background: "transparent",
        resize: "both",
        outline: "none",
        fontFamily: "system-ui, sans-serif",
        fontSize: "14px",
        lineHeight: "1.4",
        zIndex: "10000",
        whiteSpace: "pre-wrap",
        overflow: "hidden",
      });

      textarea.placeholder = "Type text...";
      scroller.appendChild(textarea);
      textarea.focus();
      textarea.select();

      // Drag with Ctrl+drag
      textarea.addEventListener("mousedown", (e) => {
        if (!e.ctrlKey) return;
        isDraggingText = true;
        dragOffsetX = e.offsetX;
        dragOffsetY = e.offsetY;
        e.preventDefault();
      });

      document.addEventListener("mousemove", handleTextDragMove);
      document.addEventListener("mouseup", handleTextDragEnd);

      showTextControls(true);
    }

    function handleTextDragMove(e) {
      if (!isDraggingText || !activeTextBox) return;
      const rect = scroller.getBoundingClientRect();
      const x = e.clientX - rect.left - dragOffsetX;
      const y = e.clientY - rect.top - dragOffsetY;
      activeTextBox.style.left = x + "px";
      activeTextBox.style.top = y + "px";
    }

    function handleTextDragEnd() {
      isDraggingText = false;
    }

    function applyActiveTextBox() {
      if (!activeTextBox) return;
      const text = activeTextBox.value;
      if (!text.trim()) {
        scroller.removeChild(activeTextBox);
        activeTextBox = null;
        showTextControls(false);
        return;
      }

      const x = parseFloat(activeTextBox.style.left) || 0;
      const y = parseFloat(activeTextBox.style.top) || 0;

      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = penColor;
      const fontSize = 12 + penSize * 1.5;
      ctx.font = `${fontSize}px system-ui, sans-serif`;

      const lines = text.split("\n");
      const lineHeight = fontSize * 1.2;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x + 2, y + fontSize + i * lineHeight);
      }
      ctx.restore();

      scroller.removeChild(activeTextBox);
      activeTextBox = null;
      showTextControls(false);
    }

    function cancelActiveTextBox() {
      if (!activeTextBox) return;
      scroller.removeChild(activeTextBox);
      activeTextBox = null;
      showTextControls(false);
    }

    applyTextBtn.addEventListener("click", applyActiveTextBox);
    cancelTextBtn.addEventListener("click", cancelActiveTextBox);

    // --- Header assembly ---
    header.appendChild(title);
    header.appendChild(toggleBtn);
    header.appendChild(eraserBtn);
    header.appendChild(textBtn);
    header.appendChild(clearBtn);
    header.appendChild(sizeDownBtn);
    header.appendChild(sizeLabel);
    header.appendChild(sizeUpBtn);
    header.appendChild(colorPicker);
    header.appendChild(applyTextBtn);
    header.appendChild(cancelTextBtn);
    header.appendChild(infoBtn);
    header.appendChild(minBtn);
    document.body.appendChild(header);

    updateModeUI();
    updateHeaderUI();

    // --- Drawing logic ---
    let drawing = false;
    let lastX = 0;
    let lastY = 0;
    let currentStroke = null; // for smooth pen

    function drawRoundedEnd(x, y) {
      ctx.save();
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = penColor;
      ctx.beginPath();
      ctx.arc(x, y, penSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function drawStrokeTips(points) {
      if (!points || points.length < 2) return;

      // Only draw the end circle (start circle is drawn immediately in startDraw)
      const pn = points[points.length - 1];
      drawRoundedEnd(pn.x, pn.y);
    }

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

      if (drawMode === "text") {
        e.preventDefault();
        const { x, y } = getPos(e);
        if (!activeTextBox) {
          createTextBoxAt(x, y);
        }
        return;
      }

      e.preventDefault();
      const { x, y, clientX, clientY } = getPos(e);
      drawing = true;
      lastX = x;
      lastY = y;

      if (drawMode === "pen") {
        // start a new smooth stroke
        currentStroke = [{ x, y }];
        // Draw the start circle immediately
        drawRoundedEnd(x, y);
      } else {
        currentStroke = null; // eraser doesn't use smoothing
      }

      if (scribbleEnabled && drawMode === "eraser" && clientX && clientY) {
        updateEraserCursorFromEvent({ clientX, clientY });
      }
    }

    function draw(e) {
      if (!drawing || !scribbleEnabled) return;
      if (drawMode === "text") return; // text mode doesn't draw strokes

      e.preventDefault();
      const { x, y, clientX, clientY } = getPos(e);

      if (drawMode === "eraser") {
        // normal chunky eraser
        ctx.globalCompositeOperation = "destination-out";
        ctx.lineWidth = eraserSize;

        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(x, y);
        ctx.stroke();

        if (scribbleEnabled && drawMode === "eraser" && clientX && clientY) {
          updateEraserCursorFromEvent({ clientX, clientY });
        }
      } else {
        // smooth pen with quadratic curves
        ctx.globalCompositeOperation = "source-over";
        ctx.lineWidth = penSize;
        ctx.strokeStyle = penColor;

        if (!currentStroke) currentStroke = [];
        currentStroke.push({ x, y });

        ctx.beginPath();
        if (currentStroke.length < 3) {
          // first tiny segment, just a line
          const p0 = currentStroke[0];
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(x, y);
        } else {
          ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
          for (let i = 1; i < currentStroke.length; i++) {
            const p1 = currentStroke[i - 1];
            const p2 = currentStroke[i];
            const mx = (p1.x + p2.x) / 2;
            const my = (p1.y + p2.y) / 2;
            ctx.quadraticCurveTo(p1.x, p1.y, mx, my);
          }
        }
        ctx.stroke();
      }

      lastX = x;
      lastY = y;
    }

    function endDraw() {
      if (drawMode === "pen" && currentStroke && currentStroke.length > 1) {
        drawStrokeTips(currentStroke);
      }

      drawing = false;
      currentStroke = null;
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
