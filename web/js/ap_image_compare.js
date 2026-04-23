import { app } from "../../../scripts/app.js";

const style = document.createElement("style");
style.textContent = `
    .ap-compare-node .comfy-output {
        display: none !important;
    }
`;
document.head.appendChild(style);

app.registerExtension({
    name: "ap-tools.APImageCompare",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "APImageCompare") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = onNodeCreated?.apply(this, arguments);

            if (this.element) {
                this.element.classList.add("ap-compare-node");
            }
            this.size = [Math.max(this.size[0], 520), Math.max(this.size[1], 500)];

            const container = document.createElement("div");
            container.style.width = "100%";
            container.style.height = "100%";
            container.style.display = "flex";
            container.style.flexDirection = "column";
            container.style.backgroundColor = "#1a1a1a";
            container.style.borderRadius = "4px";
            container.style.overflow = "hidden";

            const canvasContainer = document.createElement("div");
            canvasContainer.style.flex = "1";
            canvasContainer.style.position = "relative";
            canvasContainer.style.overflow = "hidden";
            canvasContainer.style.minHeight = "280px";

            const canvas = document.createElement("canvas");
            canvas.style.width = "100%";
            canvas.style.height = "100%";
            canvas.style.display = "block";
            canvasContainer.appendChild(canvas);

            const panel = document.createElement("div");
            panel.style.padding = "8px";
            panel.style.backgroundColor = "#2a2a2a";
            panel.style.display = "grid";
            panel.style.gridTemplateColumns = "auto auto auto auto 1fr auto";
            panel.style.gap = "8px";
            panel.style.alignItems = "center";
            panel.style.borderTop = "1px solid #444";

            const createLabel = (text) => {
                const el = document.createElement("span");
                el.textContent = text;
                el.style.color = "#ccc";
                el.style.fontSize = "12px";
                return el;
            };

            const createSelect = () => {
                const el = document.createElement("select");
                el.style.backgroundColor = "#1f1f1f";
                el.style.color = "#eee";
                el.style.border = "1px solid #555";
                el.style.borderRadius = "3px";
                el.style.padding = "3px 6px";
                return el;
            };

            const imageASelect = createSelect();
            const imageBSelect = createSelect();
            const modeSelect = createSelect();
            const zoomSlider = document.createElement("input");
            zoomSlider.type = "range";
            zoomSlider.min = "1";
            zoomSlider.max = "8";
            zoomSlider.step = "0.1";
            zoomSlider.value = "1";

            const alphaSlider = document.createElement("input");
            alphaSlider.type = "range";
            alphaSlider.min = "0";
            alphaSlider.max = "1";
            alphaSlider.step = "0.01";
            alphaSlider.value = "0.5";
            const centerButton = document.createElement("button");
            centerButton.textContent = "Center";
            centerButton.style.backgroundColor = "#1f1f1f";
            centerButton.style.color = "#eee";
            centerButton.style.border = "1px solid #555";
            centerButton.style.borderRadius = "3px";
            centerButton.style.padding = "3px 8px";
            centerButton.style.cursor = "pointer";
            centerButton.style.width = "fit-content";
            centerButton.style.justifySelf = "start";
            const resetButton = document.createElement("button");
            resetButton.textContent = "Reset";
            resetButton.style.backgroundColor = "#1f1f1f";
            resetButton.style.color = "#eee";
            resetButton.style.border = "1px solid #555";
            resetButton.style.borderRadius = "3px";
            resetButton.style.padding = "3px 8px";
            resetButton.style.cursor = "pointer";
            resetButton.style.width = "fit-content";
            resetButton.style.justifySelf = "start";

            const zoomValue = createLabel("1.0x");
            const alphaValue = createLabel("50%");
            zoomValue.style.minWidth = "44px";
            zoomValue.style.textAlign = "right";
            zoomValue.style.fontVariantNumeric = "tabular-nums";
            alphaValue.style.minWidth = "44px";
            alphaValue.style.textAlign = "right";
            alphaValue.style.fontVariantNumeric = "tabular-nums";

            modeSelect.innerHTML = `
                <option value="overlay">Overlay</option>
                <option value="split">Split</option>
            `;

            panel.append(
                createLabel("Image A"), imageASelect, createLabel(""), createLabel("Mode"), modeSelect, createLabel(""),
                createLabel("Image B"), imageBSelect, createLabel(""), createLabel("Zoom"), zoomSlider, zoomValue,
                createLabel("View"), centerButton, resetButton, createLabel("Blend"), alphaSlider, alphaValue
            );
            container.append(canvasContainer, panel);

            const ctx = canvas.getContext("2d");

            let imageEntries = [];
            let loadedImages = [];
            let idxA = 0;
            let idxB = 1;
            let zoom = 1;
            let panX = 0;
            let panY = 0;
            let isDragging = false;
            let lastDragX = 0;
            let lastDragY = 0;
            let splitRatio = 0.5;
            let drawState = null;

            const drawPlaceholder = (text = "Run queue to compare images") => {
                const rect = canvasContainer.getBoundingClientRect();
                canvas.width = Math.max(1, Math.floor(rect.width));
                canvas.height = Math.max(1, Math.floor(rect.height));
                ctx.fillStyle = "#1a1a1a";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = "#888";
                ctx.font = "14px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(text, canvas.width / 2, canvas.height / 2);
            };

            const drawComparedImages = () => {
                if (loadedImages.length === 0) {
                    drawPlaceholder();
                    return;
                }

                if (loadedImages.length === 1) {
                    const imgA = loadedImages[0];
                    const rect = canvasContainer.getBoundingClientRect();
                    const cw = Math.max(1, Math.floor(rect.width));
                    const ch = Math.max(1, Math.floor(rect.height));
                    canvas.width = cw;
                    canvas.height = ch;

                    ctx.fillStyle = "#1a1a1a";
                    ctx.fillRect(0, 0, cw, ch);

                    const baseScale = Math.min(cw / imgA.width, ch / imgA.height);
                    const drawW = imgA.width * baseScale * zoom;
                    const drawH = imgA.height * baseScale * zoom;
                    const ox = (cw - drawW) / 2 + panX;
                    const oy = (ch - drawH) / 2 + panY;
                    drawState = { ox, oy, drawW, drawH };

                    ctx.drawImage(imgA, ox, oy, drawW, drawH);
                    return;
                }

                if (!loadedImages[idxA] || !loadedImages[idxB]) {
                    drawPlaceholder("Need at least two valid images");
                    return;
                }

                const imgA = loadedImages[idxA];
                const imgB = loadedImages[idxB];
                const rect = canvasContainer.getBoundingClientRect();
                const cw = Math.max(1, Math.floor(rect.width));
                const ch = Math.max(1, Math.floor(rect.height));
                canvas.width = cw;
                canvas.height = ch;

                ctx.fillStyle = "#1a1a1a";
                ctx.fillRect(0, 0, cw, ch);

                const baseScale = Math.min(cw / imgA.width, ch / imgA.height);
                const drawW = imgA.width * baseScale * zoom;
                const drawH = imgA.height * baseScale * zoom;
                const ox = (cw - drawW) / 2 + panX;
                const oy = (ch - drawH) / 2 + panY;
                drawState = { ox, oy, drawW, drawH };

                ctx.drawImage(imgA, ox, oy, drawW, drawH);

                const mode = modeSelect.value;
                if (mode === "overlay") {
                    ctx.globalAlpha = parseFloat(alphaSlider.value);
                    ctx.drawImage(imgB, ox, oy, drawW, drawH);
                    ctx.globalAlpha = 1;
                } else {
                    const splitAt = drawW * splitRatio;
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(ox, oy, splitAt, drawH);
                    ctx.clip();
                    ctx.drawImage(imgB, ox, oy, drawW, drawH);
                    ctx.restore();

                    ctx.strokeStyle = "#ffffff88";
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(ox + splitAt, oy);
                    ctx.lineTo(ox + splitAt, oy + drawH);
                    ctx.stroke();
                }
            };

            const refillSelectors = () => {
                imageASelect.innerHTML = "";
                imageBSelect.innerHTML = "";
                imageEntries.forEach((_, idx) => {
                    const label = `Image ${idx + 1}`;
                    imageASelect.add(new Option(label, String(idx)));
                    imageBSelect.add(new Option(label, String(idx)));
                });

                if (!imageEntries.length) {
                    drawPlaceholder();
                    return;
                }

                idxA = Math.min(idxA, imageEntries.length - 1);
                idxB = Math.min(idxB, imageEntries.length - 1);
                if (idxA === idxB && imageEntries.length > 1) {
                    idxB = (idxA + 1) % imageEntries.length;
                }

                imageASelect.value = String(idxA);
                imageBSelect.value = String(idxB);
                drawComparedImages();
            };

            const loadImage = (info) =>
                new Promise((resolve) => {
                    const src = `/view?filename=${encodeURIComponent(info.filename)}&subfolder=${encodeURIComponent(info.subfolder || "")}&type=${info.type || "temp"}`;
                    const img = new Image();
                    img.onload = () => resolve(img);
                    img.onerror = () => resolve(null);
                    img.src = src;
                });

            const hideStandardOutput = () => {
                if (!this.element) return;
                const outputs = this.element.querySelectorAll(".comfy-output");
                outputs.forEach((el) => (el.style.display = "none"));
            };

            imageASelect.addEventListener("change", () => {
                idxA = Number(imageASelect.value);
                if (idxA === idxB && loadedImages.length > 1) {
                    idxB = (idxA + 1) % loadedImages.length;
                    imageBSelect.value = String(idxB);
                }
                drawComparedImages();
            });

            imageBSelect.addEventListener("change", () => {
                idxB = Number(imageBSelect.value);
                if (idxA === idxB && loadedImages.length > 1) {
                    idxA = (idxB + 1) % loadedImages.length;
                    imageASelect.value = String(idxA);
                }
                drawComparedImages();
            });

            modeSelect.addEventListener("change", drawComparedImages);

            zoomSlider.addEventListener("input", () => {
                zoom = parseFloat(zoomSlider.value);
                zoomValue.textContent = `${zoom.toFixed(1)}x`;
                drawComparedImages();
            });

            alphaSlider.addEventListener("input", () => {
                splitRatio = parseFloat(alphaSlider.value);
                alphaValue.textContent = `${Math.round(splitRatio * 100)}%`;
                drawComparedImages();
            });

            canvasContainer.addEventListener("mousedown", (e) => {
                isDragging = true;
                lastDragX = e.clientX;
                lastDragY = e.clientY;
            });
            window.addEventListener("mouseup", () => {
                isDragging = false;
            });
            window.addEventListener("mousemove", (e) => {
                if (!isDragging) return;
                panX += e.clientX - lastDragX;
                panY += e.clientY - lastDragY;
                lastDragX = e.clientX;
                lastDragY = e.clientY;
                drawComparedImages();
            });
            canvasContainer.addEventListener("mousemove", (e) => {
                if (modeSelect.value !== "split" || !drawState) return;
                const rect = canvasContainer.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const rel = (x - drawState.ox) / drawState.drawW;
                if (rel < 0 || rel > 1) return;
                splitRatio = Math.max(0, Math.min(1, rel));
                alphaSlider.value = splitRatio.toFixed(2);
                alphaValue.textContent = `${Math.round(splitRatio * 100)}%`;
                drawComparedImages();
            });
            canvasContainer.addEventListener("wheel", (e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                zoom = Math.min(8, Math.max(1, zoom + delta));
                zoomSlider.value = zoom.toFixed(1);
                zoomValue.textContent = `${zoom.toFixed(1)}x`;
                drawComparedImages();
            });
            centerButton.addEventListener("click", () => {
                panX = 0;
                panY = 0;
                drawComparedImages();
            });
            resetButton.addEventListener("click", () => {
                panX = 0;
                panY = 0;
                zoom = 1;
                splitRatio = 0.5;
                zoomSlider.value = "1";
                zoomValue.textContent = "1.0x";
                alphaSlider.value = "0.5";
                alphaValue.textContent = "50%";
                drawComparedImages();
            });

            const resizeObserver = new ResizeObserver(drawComparedImages);
            resizeObserver.observe(canvasContainer);

            const onExecuted = this.onExecuted;
            this.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);
                hideStandardOutput();

                const comparePayload = message?.ap_compare || [];
                if (!comparePayload.length) {
                    return;
                }

                imageEntries = comparePayload;
                Promise.all(imageEntries.map(loadImage)).then((imgs) => {
                    loadedImages = imgs;
                    panX = 0;
                    panY = 0;
                    splitRatio = parseFloat(alphaSlider.value);
                    refillSelectors();
                });
            };

            const outputObserver = new MutationObserver(hideStandardOutput);
            if (this.element) {
                outputObserver.observe(this.element, { childList: true, subtree: true });
            }

            this.addDOMWidget("compare", "custom", container, {
                onRemove: () => {
                    resizeObserver.disconnect();
                    outputObserver.disconnect();
                },
            });

            setTimeout(() => {
                hideStandardOutput();
                drawPlaceholder();
            }, 20);

            return result;
        };
    },
});
