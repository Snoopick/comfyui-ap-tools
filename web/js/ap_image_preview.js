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
            this.apCurrentZoom = 1;
            this.apPanX = 0;
            this.apPanY = 0;
            this.apIsDragging = false;
            this.apLastDragX = 0;
            this.apLastDragY = 0;
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
            zoomSlider.min = "1.0";
            zoomSlider.max = "8.0";
            zoomSlider.step = "0.1";
            zoomSlider.value = "1.0";
            zoomSlider.style.flex = "1";
            const zoomValue = document.createElement("span");
            zoomValue.textContent = "1.0x";
            zoomValue.style.cssText = "color:#ccc;font-size:12px;min-width:46px;text-align:right";
            const centerButton = document.createElement("button");
            centerButton.textContent = "Center";
            centerButton.style.cssText = "background:#3a3a3a;color:#ccc;border:1px solid #555;border-radius:3px;padding:2px 8px;cursor:pointer";
            const resetButton = document.createElement("button");
            resetButton.textContent = "Reset";
            resetButton.style.cssText = "background:#3a3a3a;color:#ccc;border:1px solid #555;border-radius:3px;padding:2px 8px;cursor:pointer";

            controlPanel.append(modeLabel, modeSelect, prevButton, imageCounter, nextButton, zoomLabel, zoomSlider, zoomValue, centerButton, resetButton);
            container.appendChild(canvasContainer);
            container.appendChild(controlPanel);

            const ctx = canvas.getContext("2d");

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
                this.apDrawW = this.apCurrentImage.width * this.apScale * this.apCurrentZoom;
                this.apDrawH = this.apCurrentImage.height * this.apScale * this.apCurrentZoom;
                this.apOffsetX = (rect.width - this.apDrawW) / 2 + this.apPanX;
                this.apOffsetY = (rect.height - this.apDrawH) / 2 + this.apPanY;
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
                    this.apPanX = 0;
                    this.apPanY = 0;
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
            canvasContainer.addEventListener("mousedown", e => {
                if (this.apDisplayMode !== "single" || this.apCurrentZoom <= 1 || !this.apCurrentImage) return;
                this.apIsDragging = true;
                this.apLastDragX = e.clientX;
                this.apLastDragY = e.clientY;
            });
            window.addEventListener("mouseup", () => {
                this.apIsDragging = false;
            });
            window.addEventListener("mousemove", e => {
                if (!this.apIsDragging) return;
                this.apPanX += e.clientX - this.apLastDragX;
                this.apPanY += e.clientY - this.apLastDragY;
                this.apLastDragX = e.clientX;
                this.apLastDragY = e.clientY;
                renderImage();
            });
            canvasContainer.addEventListener("mousemove", e => {
                if (this.apDisplayMode !== "grid") return;
                const rect = canvasContainer.getBoundingClientRect();
                const mx = e.clientX - rect.left;
                const my = e.clientY - rect.top;
                this.apCurrentImage = getImageAtPosition(mx, my);
            });
            canvasContainer.addEventListener("wheel", e => {
                if (this.apDisplayMode !== "single") return;
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.apCurrentZoom = Math.min(8, Math.max(1, this.apCurrentZoom + delta));
                zoomSlider.value = this.apCurrentZoom.toFixed(1);
                zoomValue.textContent = this.apCurrentZoom.toFixed(1) + "x";
                if (this.apCurrentZoom === 1) {
                    this.apPanX = 0;
                    this.apPanY = 0;
                }
                renderImage();
            }, { passive: false });

             modeSelect.addEventListener("change", e => {
                 this.apDisplayMode = e.target.value;
                 if (this.apDisplayMode === "single") {
                     const ok = this.apAllImages.filter(i => i);
                     if (ok.length) {
                         if (this.apCurrentImageIndex >= ok.length) this.apCurrentImageIndex = ok.length - 1;
                         showImage(this.apCurrentImageIndex);
                     }
                 } else {
                     this.apPanX = 0;
                     this.apPanY = 0;
                     render();
                 }
                 updateNavigationControls();
             });

            prevButton.addEventListener("click", () => { if (this.apCurrentImageIndex > 0) showImage(this.apCurrentImageIndex - 1); });
            nextButton.addEventListener("click", () => { if (this.apCurrentImageIndex < this.apAllImages.length - 1) showImage(this.apCurrentImageIndex + 1); });

            zoomSlider.addEventListener("input", e => {
                this.apCurrentZoom = +e.target.value;
                zoomValue.textContent = this.apCurrentZoom.toFixed(1) + "x";
                if (this.apCurrentZoom === 1) {
                    this.apPanX = 0;
                    this.apPanY = 0;
                }
                if (this.apDisplayMode === "single") renderImage();
            });
            centerButton.addEventListener("click", () => {
                this.apPanX = 0;
                this.apPanY = 0;
                if (this.apDisplayMode === "single") renderImage();
            });
            resetButton.addEventListener("click", () => {
                this.apPanX = 0;
                this.apPanY = 0;
                this.apCurrentZoom = 1;
                zoomSlider.value = "1.0";
                zoomValue.textContent = "1.0x";
                if (this.apDisplayMode === "single") renderImage();
            });

            const resizeObs = new ResizeObserver(() => { render(); });
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
                    resizeObs.disconnect();
                    outObs.disconnect();
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
