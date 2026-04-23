import { app } from "../../../scripts/app.js";

// Скрыть стандартный вывод
const style = document.createElement('style');
style.textContent = `.ap-preview-node .comfy-output { display: none !important; }`;
document.head.appendChild(style);

app.registerExtension({
    name: "ap-tools.APImagePreview",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "APImagePreview") return;

        const onNodeCreatedBase = nodeType.prototype.onNodeCreated;
        const onExecutedBase = nodeType.prototype.onExecuted;

        nodeType.prototype.onNodeCreated = function () {
            const result = onNodeCreatedBase?.apply(this, arguments);

            if (this.element) this.element.classList.add("ap-preview-node");
            this.size = [Math.max(this.size[0], 420), Math.max(this.size[1], 460)];

            this.apCurrentImage = null;
            this.apAllImages = [];
            this.apCurrentImageIndex = 0;
            this.apDisplayMode = "single";
            this.apScale = 1;
            this.apOffsetX = 0;
            this.apOffsetY = 0;
            this.apDrawW = 0;
            this.apDrawH = 0;
            this.apCurrentZoom = 3;
            this.apLastMouse = null;
            this.apGridCols = 0;
            this.apGridRows = 0;
            this.apGridCellW = 0;
            this.apGridCellH = 0;

            const container = document.createElement("div");
            container.style.cssText = "width:100%;height:100%;display:flex;flex-direction:column;background:#1a1a1a;border-radius:4px;overflow:hidden";

            const canvasContainer = document.createElement("div");
            canvasContainer.style.cssText = "flex:1;position:relative;overflow:hidden;min-height:220px";
            const canvas = document.createElement("canvas");
            canvas.style.cssText = "width:100%;height:100%;display:block";
            canvasContainer.appendChild(canvas);

            const controlPanel = document.createElement("div");
            controlPanel.style.cssText = "padding:8px;background:#2a2a2a;display:flex;align-items:center;gap:10px;border-top:1px solid #444;flex-shrink:0;flex-wrap:wrap";

            const modeLabel = document.createElement("span");
            modeLabel.textContent = "Mode:";
            modeLabel.style.cssText = "color:#ccc;font-size:12px";
            const modeSelect = document.createElement("select");
            modeSelect.style.cssText = "background:#3a3a3a;color:#ccc;border:1px solid #555;border-radius:3px;padding:2px 4px";
            ["single", "grid"].forEach(v => {
                const opt = document.createElement("option");
                opt.value = v;
                opt.textContent = v === "single" ? "Single" : "Grid";
                modeSelect.append(opt);
            });

            const prevButton = document.createElement("button");
            prevButton.textContent = "←";
            prevButton.style.cssText = "background:#3a3a3a;color:#ccc;border:1px solid #555;border-radius:3px;padding:2px 6px;cursor:pointer;display:none";
            const nextButton = document.createElement("button");
            nextButton.textContent = "→";
            nextButton.style.cssText = "background:#3a3a3a;color:#ccc;border:1px solid #555;border-radius:3px;padding:2px 6px;cursor:pointer;display:none";

            const imageCounter = document.createElement("span");
            imageCounter.textContent = "0/0";
            imageCounter.style.cssText = "color:#ccc;font-size:12px;min-width:40px;text-align:center;display:none";

            const zoomLabel = document.createElement("span");
            zoomLabel.textContent = "Zoom:";
            zoomLabel.style.cssText = "color:#ccc;font-size:12px";
            const zoomSlider = document.createElement("input");
            zoomSlider.type = "range";
            zoomSlider.min = "1.5";
            zoomSlider.max = "8.0";
            zoomSlider.step = "0.1";
            zoomSlider.value = "3.0";
            zoomSlider.style.flex = "1";
            const zoomValue = document.createElement("span");
            zoomValue.textContent = "3.0x";
            zoomValue.style.cssText = "color:#ccc;font-size:12px;min-width:46px;text-align:right";

            controlPanel.append(modeLabel, modeSelect, prevButton, imageCounter, nextButton, zoomLabel, zoomSlider, zoomValue);
            container.appendChild(canvasContainer);
            container.appendChild(controlPanel);

            const loupe = document.createElement("div");
            loupe.style.cssText = "position:fixed;width:260px;height:260px;border:2px solid #888;box-shadow:0 4px 15px rgba(0,0,0,0.7);overflow:hidden;display:none;pointer-events:none;z-index:9999;background:#1a1a1a";
            const loupeCanvas = document.createElement("canvas");
            loupeCanvas.style.cssText = "width:100%;height:100%";
            loupe.appendChild(loupeCanvas);
            document.body.appendChild(loupe);

            const ctx = canvas.getContext("2d");
            const lCtx = loupeCanvas.getContext("2d");

             const drawPlaceholder = (error = false) => {
                 const dpr = window.devicePixelRatio || 1;
                 const rect = canvasContainer.getBoundingClientRect();
                 const w = Math.max(1, Math.floor(rect.width * dpr));
                 const h = Math.max(1, Math.floor(rect.height * dpr));
                 canvas.width = w;
                 canvas.height = h;
                 ctx.scale(dpr, dpr);
                 ctx.fillStyle = "#1a1a1a";
                 ctx.fillRect(0, 0, rect.width, rect.height);
                 ctx.font = "14px sans-serif";
                 ctx.textAlign = "center";
                 if (error) {
                     ctx.fillStyle = "#ff6b6b";
                     ctx.fillText("Failed to load image", rect.width/2, rect.height/2 - 10);
                     ctx.fillStyle = "#888";
                     ctx.font = "12px sans-serif";
                     ctx.fillText("Check console for details", rect.width/2, rect.height/2 + 15);
                 } else {
                     ctx.fillStyle = "#888";
                     ctx.fillText("Run queue to see preview", rect.width/2, rect.height/2);
                 }
             };

            const renderImage = () => {
                if (!this.apCurrentImage) { drawPlaceholder(); return; }
                const dpr = window.devicePixelRatio || 1;
                const rect = canvasContainer.getBoundingClientRect();
                const w = Math.max(1, Math.floor(rect.width * dpr));
                const h = Math.max(1, Math.floor(rect.height * dpr));
                canvas.width = w;
                canvas.height = h;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
                this.apScale = Math.min(rect.width / this.apCurrentImage.width, rect.height / this.apCurrentImage.height);
                this.apDrawW = this.apCurrentImage.width * this.apScale;
                this.apDrawH = this.apCurrentImage.height * this.apScale;
                this.apOffsetX = (rect.width - this.apDrawW) / 2;
                this.apOffsetY = (rect.height - this.apDrawH) / 2;
                ctx.fillStyle = "#1a1a1a";
                ctx.fillRect(0, 0, rect.width, rect.height);
                ctx.drawImage(this.apCurrentImage, this.apOffsetX, this.apOffsetY, this.apDrawW, this.apDrawH);
            };

             const updateNavigationControls = () => {
                 const successful = this.apAllImages.filter(i => i);
                 const showNav = successful.length > 1 && this.apDisplayMode === "single";
                prevButton.style.display = showNav ? "block" : "none";
                nextButton.style.display = showNav ? "block" : "none";
                imageCounter.style.display = showNav ? "block" : "none";
                if (showNav) {
                    imageCounter.textContent = `${this.apCurrentImageIndex + 1}/${successful.length}`;
                    prevButton.disabled = this.apCurrentImageIndex === 0;
                    nextButton.disabled = this.apCurrentImageIndex === successful.length - 1;
                }
            };

             const showImage = (idx) => {
                 const successful = this.apAllImages.filter(i => i);
                 if (idx >= 0 && idx < successful.length) {
                    this.apCurrentImageIndex = idx;
                    this.apCurrentImage = successful[idx];
                    renderImage();
                    updateNavigationControls();
                }
            };

             const renderGrid = () => {
                 const successful = this.apAllImages.filter(i => i);
                 if (!successful.length) { drawPlaceholder(true); return; }
                const dpr = window.devicePixelRatio || 1;
                const rect = canvasContainer.getBoundingClientRect();
                const w = Math.max(1, Math.floor(rect.width * dpr));
                const h = Math.max(1, Math.floor(rect.height * dpr));
                canvas.width = w;
                canvas.height = h;
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
                ctx.fillStyle = "#1a1a1a";
                ctx.fillRect(0, 0, rect.width, rect.height);
                const cols = Math.ceil(Math.sqrt(successful.length));
                const rows = Math.ceil(successful.length / cols);
                const cw = rect.width / cols;
                const ch = rect.height / rows;
                this.apGridCols = cols;
                this.apGridRows = rows;
                this.apGridCellW = cw;
                this.apGridCellH = ch;
                successful.forEach((img, i) => {
                    const col = i % cols;
                    const row = Math.floor(i / cols);
                    const x = col * cw;
                    const y = row * ch;
                    const s = Math.min(cw / img.width, ch / img.height);
                    const iw = img.width * s;
                    const ih = img.height * s;
                    ctx.drawImage(img, x + (cw-iw)/2, y + (ch-ih)/2, iw, ih);
                });
            };

            const render = () => {
                this.apDisplayMode === "grid" ? renderGrid() : renderImage();
            };

            // Re-render on window resize to handle DPR changes (e.g., browser zoom)
            const dprChangeHandler = () => { render(); };
            window.addEventListener('resize', dprChangeHandler);

            const hideLoupe = () => { loupe.style.display = "none"; };

             const getImageAtPosition = (mx, my) => {
                 if (this.apDisplayMode !== "grid") return this.apCurrentImage;
                 const successful = this.apAllImages.filter(i => i);
                 if (!successful.length) return null;
                const col = Math.floor(mx / this.apGridCellW);
                const row = Math.floor(my / this.apGridCellH);
                if (col >= this.apGridCols || row >= this.apGridRows) return null;
                const index = row * this.apGridCols + col;
                if (index >= successful.length) return null;
                return successful[index];
            };

            const updateLoupe = (cx, cy) => {
                if (!this.apCurrentImage) return hideLoupe();
                const rect = canvasContainer.getBoundingClientRect();
                const mx = cx - rect.left;
                const my = cy - rect.top;

                let imgX, imgY, scale;
                 if (this.apDisplayMode === "grid") {
                     // In grid mode, calculate position relative to the specific image cell
                     const successful = this.apAllImages.filter(i => i);
                     const index = successful.indexOf(this.apCurrentImage);
                    if (index === -1) return hideLoupe();
                    const col = index % this.apGridCols;
                    const row = Math.floor(index / this.apGridCols);
                    const cellX = col * this.apGridCellW;
                    const cellY = row * this.apGridCellH;
                    scale = Math.min(this.apGridCellW / this.apCurrentImage.width, this.apGridCellH / this.apCurrentImage.height);
                    const drawW = this.apCurrentImage.width * scale;
                    const drawH = this.apCurrentImage.height * scale;
                    const offsetX = cellX + (this.apGridCellW - drawW) / 2;
                    const offsetY = cellY + (this.apGridCellH - drawH) / 2;
                    if (mx < offsetX || mx > offsetX + drawW || my < offsetY || my > offsetY + drawH) return hideLoupe();
                    imgX = (mx - offsetX) / scale;
                    imgY = (my - offsetY) / scale;
                } else {
                    // Single mode
                    if (mx < this.apOffsetX || mx > this.apOffsetX + this.apDrawW || my < this.apOffsetY || my > this.apOffsetY + this.apDrawH) return hideLoupe();
                    imgX = (mx - this.apOffsetX) / this.apScale;
                    imgY = (my - this.apOffsetY) / this.apScale;
                }

                const lens = 260, sample = lens / this.apCurrentZoom;
                const sx = Math.max(0, Math.min(this.apCurrentImage.width - sample, imgX - sample/2));
                const sy = Math.max(0, Math.min(this.apCurrentImage.height - sample, imgY - sample/2));
                loupeCanvas.width = lens; loupeCanvas.height = lens;
                lCtx.imageSmoothingEnabled = false;
                lCtx.clearRect(0, 0, lens, lens);
                lCtx.drawImage(this.apCurrentImage, sx, sy, sample, sample, 0, 0, lens, lens);
                loupe.style.left = cx + 20 + "px";
                loupe.style.top = cy + 20 + "px";
                loupe.style.display = "block";
            };

            canvasContainer.addEventListener("mousemove", e => {
                this.apLastMouse = {x: e.clientX, y: e.clientY};
                if (this.apDisplayMode === "grid") {
                    const rect = canvasContainer.getBoundingClientRect();
                    const mx = e.clientX - rect.left;
                    const my = e.clientY - rect.top;
                    this.apCurrentImage = getImageAtPosition(mx, my);
                }
                updateLoupe(e.clientX, e.clientY);
            });
            canvasContainer.addEventListener("mouseleave", hideLoupe);

             modeSelect.addEventListener("change", e => {
                 this.apDisplayMode = e.target.value;
                 if (this.apDisplayMode === "single") {
                     const ok = this.apAllImages.filter(i => i);
                     if (ok.length) {
                         if (this.apCurrentImageIndex >= ok.length) this.apCurrentImageIndex = ok.length - 1;
                         showImage(this.apCurrentImageIndex);
                     }
                 } else render();
                 updateNavigationControls();
             });

            prevButton.addEventListener("click", () => { if (this.apCurrentImageIndex > 0) showImage(this.apCurrentImageIndex - 1); });
            nextButton.addEventListener("click", () => { if (this.apCurrentImageIndex < this.apAllImages.length - 1) showImage(this.apCurrentImageIndex + 1); });

            zoomSlider.addEventListener("input", e => {
                this.apCurrentZoom = +e.target.value;
                zoomValue.textContent = this.apCurrentZoom.toFixed(1) + "x";
                if (this.apLastMouse) updateLoupe(this.apLastMouse.x, this.apLastMouse.y);
            });

            const resizeObs = new ResizeObserver(() => { render(); if (this.apLastMouse) updateLoupe(this.apLastMouse.x, this.apLastMouse.y); });
            resizeObs.observe(canvasContainer);

            const hideStdOut = () => { if (!this.element) return; this.element.querySelectorAll(".comfy-output").forEach(el => el.style.display = "none"); };
            const outObs = new MutationObserver(hideStdOut);
            if (this.element) outObs.observe(this.element, { childList: true, subtree: true });

            // Сохраняем то, что понадобится в onExecuted
            this.apModeSelect = modeSelect;
            this.apDrawPlaceholder = drawPlaceholder;
            this.apRender = render;
            this.apShowImage = showImage;
            this.apUpdateNavigationControls = updateNavigationControls;

            this.addDOMWidget("preview", "custom", container, {
                onRemove: () => {
                    hideLoupe();
                    resizeObs.disconnect();
                    outObs.disconnect();
                    if (loupe.parentNode) loupe.parentNode.removeChild(loupe);
                    window.removeEventListener('resize', dprChangeHandler);
                },
            });

            setTimeout(() => { hideStdOut(); drawPlaceholder(); }, 20);
            return result;
        };

        nodeType.prototype.onExecuted = function (msg) {
            onExecutedBase?.apply(this, arguments);
            if (this.element) this.element.querySelectorAll(".comfy-output").forEach(el => el.style.display = "none");

            const imgs = msg?.ap_preview || msg?.images || [];
            const mode = msg?.ap_preview_mode || "single";
            if (!imgs.length) return;

            this.apAllImages = new Array(imgs.length);
            let loaded = 0;

            imgs.forEach((info, i) => {
                const src = `/view?filename=${encodeURIComponent(info.filename)}&subfolder=${encodeURIComponent(info.subfolder || "")}&type=${info.type || "temp"}`;
                const img = new Image();
                 img.onload = () => {
                     this.apAllImages[i] = img;
                     loaded++;
                     if (loaded === imgs.length) {
                         // Force mode to single when new data arrives
                         this.apDisplayMode = "single";
                         this.apModeSelect.value = "single";
                         const ok = this.apAllImages.filter(i => i);
                         if (!ok.length) {
                             this.apCurrentImage = null;
                             this.apDrawPlaceholder(true);
                         } else {
                             // In single mode, show the first image
                             this.apShowImage(0);
                         }
                         this.apUpdateNavigationControls();
                     }
                 };
                 img.onerror = () => {
                     console.error("Failed to load image:", src);
                     this.apAllImages[i] = null;
                     loaded++;
                     if (loaded === imgs.length) {
                         // Force mode to single when new data arrives
                         this.apDisplayMode = "single";
                         this.apModeSelect.value = "single";
                         const ok = this.apAllImages.filter(i => i);
                         if (!ok.length) {
                             this.apCurrentImage = null;
                             this.apDrawPlaceholder(true);
                         } else {
                             // In single mode, show the first image
                             this.apShowImage(0);
                         }
                         this.apUpdateNavigationControls();
                     }
                 };
                img.src = src;
            });
        };
    },
});
