/* Film Camera Studio — web app (PWA). Live camera + WebGL colour recipes. All processing on-device. */
(() => {
  "use strict";

  // ---------------- Recipes (original, see 06_RECIPE_SCHEMA in the research repo) ----------------
  const BUILTIN = [
    { id: "noel", name: "Noel Ánh Vàng", ev: 0, hl: -1, sh: 2, con: 0.15, sat: 1, skin: 0.6, cd: 0.8, wr: 2, wb: -3, gr: 0.35, gs: 1.6,
      hsl: [[30, -5, 0.1, 0.05], [220, 8, -0.3, -0.1]] },
    { id: "pho", name: "Phố Hoài Niệm", ev: 0, hl: 0, sh: 3, con: 0.2, sat: -2, skin: 0.4, cd: 1.0, wr: 0, wb: 1, gr: 0.25, gs: 0.8,
      hsl: [[220, -10, -0.2, 0], [120, 10, -0.3, 0]] },
    { id: "chandung", name: "Chân Dung Dịu", ev: 0.1, hl: -1, sh: -1, con: -0.3, sat: -1, skin: 1.0, cd: 0, wr: 1, wb: 0, gr: 0.1, gs: 0.8, hsl: [] },
    { id: "rung", name: "Rừng Xanh Trầm", ev: 0, hl: 0, sh: 1, con: 0.1, sat: 0, skin: 0.5, cd: 1.2, wr: 0, wb: 0, gr: 0.2, gs: 0.8,
      hsl: [[120, -8, 0.15, -0.25], [60, -10, 0, -0.1]] },
    { id: "bw", name: "Đen Trắng Nghệ Thuật", ev: 0, hl: 1, sh: 2, con: 0.25, sat: 0, skin: 0, cd: 0, wr: 0, wb: 0, gr: 0.45, gs: 1.6, hsl: [],
      mono: "yellow", warm: 0.1 },
    { id: "goc", name: "Không màu phim", ev: 0, hl: 0, sh: 0, con: 0, sat: 0, skin: 0, cd: 0, wr: 0, wb: 0, gr: 0, gs: 0.8, hsl: [] }
  ];
  const MONO_W = { yellow: [0.4, 0.5, 0.1], red: [0.6, 0.35, 0.05], green: [0.25, 0.65, 0.1], none: [0.299, 0.587, 0.114] };
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  let custom = store.get("fcs.custom", []);
  const allRecipes = () => BUILTIN.concat(custom);
  const clone = o => JSON.parse(JSON.stringify(o));

  // ---------------- WebGL renderer ----------------
  const VS = `attribute vec2 aPos; uniform float uMirror; varying vec2 vUv;
    void main(){ vec2 uv = aPos * 0.5 + 0.5; if (uMirror > 0.5) uv.x = 1.0 - uv.x; vUv = uv; gl_Position = vec4(aPos, 0.0, 1.0); }`;
  const FS = `precision highp float;
    varying vec2 vUv; uniform sampler2D uTex;
    uniform float uHl, uSh, uCon, uSat, uSkin, uCd, uWr, uWb, uGr, uGs, uEv, uMono, uWarm, uOrig;
    uniform vec3 uMonoW; uniform vec4 uBand[3]; uniform vec2 uRes;
    vec3 rgb2hsl(vec3 c){ float mx=max(c.r,max(c.g,c.b)), mn=min(c.r,min(c.g,c.b)); float l=(mx+mn)*0.5; float h=0.0, s=0.0;
      if (mx-mn > 1e-5) { float d=mx-mn; s = l>0.5 ? d/(2.0-mx-mn) : d/(mx+mn);
        if (mx==c.r) h=(c.g-c.b)/d + (c.g<c.b?6.0:0.0); else if (mx==c.g) h=(c.b-c.r)/d+2.0; else h=(c.r-c.g)/d+4.0; h*=60.0; }
      return vec3(h,s,l); }
    float hue2(float p,float q,float t){ if(t<0.0)t+=1.0; if(t>1.0)t-=1.0; if(t<1.0/6.0) return p+(q-p)*6.0*t; if(t<0.5) return q; if(t<2.0/3.0) return p+(q-p)*(2.0/3.0-t)*6.0; return p; }
    vec3 hsl2rgb(vec3 c){ if(c.y<=0.0) return vec3(c.z); float q = c.z<0.5 ? c.z*(1.0+c.y) : c.z+c.y-c.z*c.y; float p=2.0*c.z-q; float h=mod(c.x,360.0)/360.0;
      return vec3(hue2(p,q,h+1.0/3.0), hue2(p,q,h), hue2(p,q,h-1.0/3.0)); }
    float hd(float a,float b){ float d=mod(abs(a-b),360.0); return d>180.0 ? 360.0-d : d; }
    float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
    void main(){
      vec3 c = texture2D(uTex, vUv).rgb;
      if (uOrig > 0.5) { gl_FragColor = vec4(c, 1.0); return; }
      vec3 lin = pow(c, vec3(2.2)) * exp2(uEv); c = pow(clamp(lin, 0.0, 1.0), vec3(1.0/2.2));
      c.r *= 1.0 + uWr*0.018; c.b *= 1.0 + uWb*0.018;
      float L = clamp(dot(c, vec3(0.2126,0.7152,0.0722)), 0.0, 1.0);
      float L2 = L + uHl/4.0*smoothstep(0.5,1.0,L)*(L-0.5)*0.6 + uSh/4.0*(1.0-smoothstep(0.0,0.5,L))*(L-0.5)*0.6;
      L2 = clamp(0.5 + (L2-0.5)*(1.0+uCon), 0.0, 1.0);
      c = clamp(c * (L > 0.001 ? L2/L : 1.0), 0.0, 1.0);
      if (uMono > 0.5) {
        float m = clamp(dot(c, uMonoW), 0.0, 1.0); float wc = uWarm*0.05;
        c = vec3(clamp(m + wc*m, 0.0, 1.0), m, clamp(m - wc*m, 0.0, 1.0));
      } else {
        vec3 h = rgb2hsl(c);
        for (int i = 0; i < 3; i++) { vec4 b = uBand[i]; float w = max(0.0, 1.0 - hd(h.x, b.x)/45.0) * smoothstep(0.05, 0.25, h.y);
          h.x += b.y*w; h.y = clamp(h.y*(1.0+b.z*w), 0.0, 1.0); h.z = clamp(h.z + b.w*w*0.25, 0.0, 1.0); }
        float skinW = uSkin * max(0.0, 1.0 - hd(h.x, 25.0)/25.0);
        h.y = clamp(h.y * (1.0 + (uSat-1.0)*(1.0-skinW)), 0.0, 1.0);
        h.z = clamp(h.z * (1.0 - uCd*0.12*smoothstep(0.35, 0.9, h.y)), 0.0, 1.0);
        c = hsl2rgb(h);
      }
      if (uGr > 0.0) { vec2 cell = floor(vUv*uRes/uGs); float n = hash(cell) - 0.5;
        float Lg = dot(c, vec3(0.2126,0.7152,0.0722)); c += n * uGr*0.16*(0.35 + 2.6*Lg*(1.0-Lg)); }
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`;

  function Renderer(canvas) {
    const gl = canvas.getContext("webgl", { preserveDrawingBuffer: true, premultipliedAlpha: false, antialias: false });
    if (!gl) throw new Error("no-webgl");
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos"); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]
      .forEach(([k, v]) => gl.texParameteri(gl.TEXTURE_2D, k, v));
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    const U = {}; ["uHl","uSh","uCon","uSat","uSkin","uCd","uWr","uWb","uGr","uGs","uEv","uMono","uWarm","uOrig","uMonoW","uBand","uRes","uMirror"]
      .forEach(n => U[n] = gl.getUniformLocation(prog, n));
    this.maxTex = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), 4096);
    this.upload = src => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); };
    this.draw = (R, opts) => {
      const w = canvas.width, h = canvas.height; gl.viewport(0, 0, w, h);
      gl.uniform1f(U.uHl, R.hl); gl.uniform1f(U.uSh, R.sh); gl.uniform1f(U.uCon, R.con || 0); gl.uniform1f(U.uSat, 1 + R.sat * 0.12);
      gl.uniform1f(U.uSkin, R.skin || 0); gl.uniform1f(U.uCd, R.cd); gl.uniform1f(U.uWr, R.wr); gl.uniform1f(U.uWb, R.wb);
      gl.uniform1f(U.uGr, R.gr); gl.uniform1f(U.uGs, Math.max(1, R.gs * (opts.grainBase || w) / 1000)); gl.uniform1f(U.uEv, R.ev || 0);
      gl.uniform1f(U.uMono, R.mono ? 1 : 0); gl.uniform1f(U.uWarm, R.warm || 0); gl.uniform3fv(U.uMonoW, MONO_W[R.mono || "none"]);
      const bands = new Float32Array(12); (R.hsl || []).slice(0, 3).forEach((b, i) => bands.set(b, i * 4)); gl.uniform4fv(U.uBand, bands);
      gl.uniform2f(U.uRes, w, h); gl.uniform1f(U.uOrig, opts.original ? 1 : 0); gl.uniform1f(U.uMirror, opts.mirror ? 1 : 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }

  // ---------------- DOM ----------------
  const $ = id => document.getElementById(id);
  const view = $("view"), video = $("video"), finder = $("finder");
  const exporterCanvas = document.createElement("canvas");
  let renderer, exporter;
  try { renderer = new Renderer(view); exporter = new Renderer(exporterCanvas); }
  catch (e) { showOverlay("Máy này không hỗ trợ WebGL nên không xử lý được màu. Hãy cập nhật iOS hoặc dùng Safari.", false); return; }

  let recipe = null, baseId = null;
  let mode = "camera";          // camera | edit
  let facing = store.get("fcs.facing", "environment");
  let stream = null, srcW = 0, srcH = 0, editCanvas = null, showOriginal = false, lastBlob = null;
  let shots = store.get("fcs.shots", 0);

  function toast(t) { const el = $("toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2600); }
  function showOverlay(text, retry) { $("overlay").hidden = false; $("overlayText").textContent = text; $("retryBtn").hidden = !retry; }
  function hideOverlay() { $("overlay").hidden = true; }

  // Fit the display canvas to the finder with the source aspect ratio
  function fitView(w, h) {
    const r = finder.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    const s = Math.min(r.width / w, r.height / h);
    const cssW = Math.max(1, Math.floor(w * s)), cssH = Math.max(1, Math.floor(h * s));
    view.style.width = cssW + "px"; view.style.height = cssH + "px";
    const pw = Math.min(Math.round(cssW * dpr), 1600), ph = Math.round(pw * h / w);
    if (view.width !== pw || view.height !== ph) { view.width = pw; view.height = ph; }
  }

  // ---------------- Camera ----------------
  async function startCamera() {
    stopCamera();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { showOverlay("Trình duyệt này không mở được camera. Hãy mở bằng Safari qua link https.", false); return; }
    showOverlay("Đang mở camera…", false);
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 1920 }, height: { ideal: 1440 } } });
      video.srcObject = stream; await video.play();
      hideOverlay();
    } catch (e) {
      const denied = e && (e.name === "NotAllowedError" || e.name === "SecurityError");
      showOverlay(denied ? "Chưa có quyền dùng camera. Vào Cài đặt › Safari › Camera, chọn “Cho phép”, rồi nhấn Thử lại. Bạn vẫn có thể dùng “Sửa ảnh”."
                         : "Không mở được camera (có thể ứng dụng khác đang dùng). Nhấn Thử lại.", true);
    }
  }
  function stopCamera() { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } video.srcObject = null; }

  function loop() {
    if (mode === "camera" && video.readyState >= 2 && video.videoWidth) {
      if (video.videoWidth !== srcW || video.videoHeight !== srcH) { srcW = video.videoWidth; srcH = video.videoHeight; fitView(srcW, srcH); }
      renderer.upload(video);
      renderer.draw(recipe, { original: showOriginal, mirror: facing === "user", grainBase: view.width });
    }
    requestAnimationFrame(loop);
  }

  function renderEdit() {
    if (mode !== "edit" || !editCanvas) return;
    renderer.draw(recipe, { original: showOriginal, mirror: false, grainBase: view.width });
  }

  // ---------------- Capture / export ----------------
  function exportFrom(source, w, h, mirror) {
    const s = Math.min(1, exporter.maxTex / Math.max(w, h));
    const cw = Math.round(w * s), ch = Math.round(h * s);
    const snap = document.createElement("canvas"); snap.width = cw; snap.height = ch;
    snap.getContext("2d").drawImage(source, 0, 0, cw, ch);
    return new Promise(resolve => {
      exporterCanvas.width = cw; exporterCanvas.height = ch;
      exporter.upload(snap);
      exporter.draw(recipe, { original: false, mirror, grainBase: cw });
      exporterCanvas.toBlob(b => resolve(b), "image/jpeg", 0.92);
    });
  }

  async function capture() {
    let blob;
    if (mode === "camera") {
      if (!video.videoWidth) { toast("Camera chưa sẵn sàng"); return; }
      const f = $("flash"); f.classList.add("go"); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove("go")));
      blob = await exportFrom(video, video.videoWidth, video.videoHeight, facing === "user");
    } else {
      if (!editCanvas) { $("file").click(); return; }
      toast("Đang xử lý ảnh…");
      blob = await exportFrom(editCanvas, editCanvas.width, editCanvas.height, false);
    }
    if (!blob) { toast("Không tạo được ảnh"); return; }
    lastBlob = blob; shots++; store.set("fcs.shots", shots); updateHud();
    const url = URL.createObjectURL(blob);
    $("thumb").style.backgroundImage = `url(${url})`;
    openSheet(url);
  }

  function openSheet(url) { $("toast").classList.remove("show"); $("sheetImg").src = url; $("sheet").hidden = false; }
  $("closeSheet").addEventListener("click", () => { $("sheet").hidden = true; });
  $("thumb").addEventListener("click", () => { if (lastBlob) openSheet(URL.createObjectURL(lastBlob)); });
  $("shareBtn").addEventListener("click", async () => {
    if (!lastBlob) return;
    const name = `film-${recipe.id}-${new Date().toISOString().replace(/[:.]/g, "-")}.jpg`;
    const file = new File([lastBlob], name, { type: "image/jpeg" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file] }); return; } catch (e) { if (e && e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(lastBlob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    toast("Nếu ảnh mở ra trang mới, hãy nhấn giữ ảnh để lưu");
  });

  // ---------------- Edit mode (import photo) ----------------
  $("file").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
      const s = Math.min(1, renderer.maxTex / Math.max(img.naturalWidth, img.naturalHeight));
      editCanvas = document.createElement("canvas"); editCanvas.width = Math.round(img.naturalWidth * s); editCanvas.height = Math.round(img.naturalHeight * s);
      editCanvas.getContext("2d").drawImage(img, 0, 0, editCanvas.width, editCanvas.height); URL.revokeObjectURL(url);
      fitView(editCanvas.width, editCanvas.height);
      // display texture: downscale to view size for speed
      const d = document.createElement("canvas"); d.width = view.width; d.height = view.height; d.getContext("2d").drawImage(editCanvas, 0, 0, d.width, d.height);
      renderer.upload(d); hideOverlay(); renderEdit();
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast("Không đọc được ảnh này"); };
    img.src = url;
  });

  function setMode(m) {
    mode = m;
    $("modeBtn").textContent = m === "camera" ? "Sửa ảnh" : "Máy ảnh";
    $("shutter").classList.toggle("edit", m === "edit");
    $("shutter").setAttribute("aria-label", m === "camera" ? "Chụp ảnh" : "Xuất ảnh đã sửa");
    $("flipBtn").hidden = m === "edit";
    if (m === "camera") { editCanvas = null; srcW = srcH = 0; startCamera(); }
    else { stopCamera(); hideOverlay(); showOverlay("Chọn một ảnh để áp công thức màu", false); $("overlay").onclick = () => $("file").click(); $("file").click(); }
    if (m === "camera") $("overlay").onclick = null;
  }
  $("modeBtn").addEventListener("click", () => setMode(mode === "camera" ? "edit" : "camera"));
  $("flipBtn").addEventListener("click", () => { facing = facing === "user" ? "environment" : "user"; store.set("fcs.facing", facing); srcW = 0; startCamera(); });
  $("retryBtn").addEventListener("click", startCamera);
  $("shutter").addEventListener("click", capture);

  // ---------------- Recipes UI ----------------
  function buildStrip() {
    const strip = $("strip"); strip.innerHTML = "";
    allRecipes().forEach(r => {
      const b = document.createElement("button"); b.type = "button"; b.className = "chip"; b.dataset.id = r.id;
      b.textContent = (r.custom ? "★ " : "") + r.name; b.setAttribute("aria-pressed", String(r.id === baseId));
      b.addEventListener("click", () => selectRecipe(r.id)); strip.appendChild(b);
    });
  }
  function selectRecipe(id) {
    const r = allRecipes().find(x => x.id === id) || BUILTIN[0];
    baseId = r.id; recipe = clone(r); store.set("fcs.recipe", baseId);
    document.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", String(c.dataset.id === baseId)));
    $("resetRecipe").textContent = r.custom ? "Xóa công thức" : "Đặt lại";
    syncControls(); renderEdit(); updateHud();
  }
  const CTL = [["ev", 1], ["hl", 1], ["sh", 1], ["sat", 0], ["cd", 1], ["gr", 2], ["wr", 0], ["wb", 0]];
  function syncControls() {
    CTL.forEach(([k, dec]) => {
      $(k).value = recipe[k]; const v = Number(recipe[k]);
      $(k + "O").textContent = (v > 0 && k !== "gr" && k !== "cd" ? "+" : "") + v.toFixed(dec).replace("-", "−");
    });
    $("sat").disabled = $("cd").disabled = !!recipe.mono;
    document.querySelectorAll("#gsize button").forEach(b => b.setAttribute("aria-pressed", String(Number(b.dataset.v) === recipe.gs)));
  }
  CTL.forEach(([k]) => $(k).addEventListener("input", e => { recipe[k] = Number(e.target.value); syncControls(); renderEdit(); updateHud(); }));
  document.querySelectorAll("#gsize button").forEach(b => b.addEventListener("click", () => { recipe.gs = Number(b.dataset.v); syncControls(); renderEdit(); }));
  $("saveRecipe").addEventListener("click", () => {
    const name = (prompt("Đặt tên công thức của bạn:", recipe.name + " (của tôi)") || "").trim();
    if (!name) return;
    const r = clone(recipe); r.id = "c" + Date.now(); r.name = name.slice(0, 40); r.custom = true;
    custom.push(r); store.set("fcs.custom", custom); buildStrip(); selectRecipe(r.id); toast("Đã lưu công thức");
  });
  $("resetRecipe").addEventListener("click", () => {
    const r = allRecipes().find(x => x.id === baseId);
    if (r && r.custom) {
      if (!confirm(`Xóa công thức “${r.name}”?`)) return;
      custom = custom.filter(x => x.id !== r.id); store.set("fcs.custom", custom); buildStrip(); selectRecipe(BUILTIN[0].id); toast("Đã xóa");
    } else selectRecipe(baseId);
  });
  $("dialBtn").addEventListener("click", () => {
    const p = $("panel"), open = p.hidden; p.hidden = !open; $("dialBtn").setAttribute("aria-expanded", String(open));
    setTimeout(() => { if (mode === "camera" && srcW) fitView(srcW, srcH); else if (editCanvas) { fitView(editCanvas.width, editCanvas.height); reuploadEdit(); } }, 30);
  });
  function reuploadEdit() { const d = document.createElement("canvas"); d.width = view.width; d.height = view.height; d.getContext("2d").drawImage(editCanvas, 0, 0, d.width, d.height); renderer.upload(d); renderEdit(); }

  const hold = $("holdBtn");
  const on = e => { if (e) e.preventDefault(); showOriginal = true; hold.classList.add("on"); renderEdit(); updateHud(); };
  const off = () => { if (!showOriginal) return; showOriginal = false; hold.classList.remove("on"); renderEdit(); updateHud(); };
  hold.addEventListener("pointerdown", on); ["pointerup", "pointerleave", "pointercancel"].forEach(ev => hold.addEventListener(ev, off));

  function updateHud() {
    const f = v => (v > 0 ? "+" : v < 0 ? "−" : "±") + Math.abs(v);
    $("readout").textContent = showOriginal ? "ẢNH GỐC" : `TS ${f(recipe.hl)} · TT ${f(recipe.sh)} · M ${f(recipe.sat)} · H ${recipe.gr.toFixed(2)}`;
    $("counter").textContent = "KHUNG " + String(shots % 1000).padStart(3, "0");
  }

  window.addEventListener("resize", () => { if (mode === "camera" && srcW) fitView(srcW, srcH); else if (editCanvas) { fitView(editCanvas.width, editCanvas.height); reuploadEdit(); } });
  document.addEventListener("visibilitychange", () => { if (mode !== "camera") return; if (document.hidden) stopCamera(); else startCamera(); });

  // ---------------- Boot ----------------
  buildStrip();
  selectRecipe(store.get("fcs.recipe", BUILTIN[0].id));
  setMode("camera");
  requestAnimationFrame(loop);
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
})();
