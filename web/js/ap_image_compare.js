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
            panel.style.display = "flex";
            panel.style.flexDirection = "column";
            panel.style.gap = "8px";
            panel.style.borderTop = "1px solid #444";

            const controlsPanel = document.createElement("div");
            controlsPanel.style.display = "grid";
            controlsPanel.style.gridTemplateColumns = "1fr 1fr";
            controlsPanel.style.gap = "8px";

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

            // Создаем блоки управления
            const modeBlock = document.createElement("div");
            modeBlock.style.display = "flex";
            modeBlock.style.alignItems = "center";
            modeBlock.style.gap = "8px";
            modeBlock.append(createLabel("Mode"), modeSelect);

            const zoomBlock = document.createElement("div");
            zoomBlock.style.display = "flex";
            zoomBlock.style.alignItems = "center";
            zoomBlock.style.gap = "8px";
            zoomBlock.append(createLabel("Zoom"), zoomSlider, zoomValue);
            zoomSlider.style.flex = "1";

            const viewBlock = document.createElement("div");
            viewBlock.style.display = "flex";
            viewBlock.style.alignItems = "center";
            viewBlock.style.gap = "8px";
            viewBlock.append(createLabel("View"), centerButton, resetButton);

            const blendBlock = document.createElement("div");
            blendBlock.style.display = "flex";
            blendBlock.style.alignItems = "center";
            blendBlock.style.gap = "8px";
            blendBlock.append(createLabel("Blend"), alphaSlider, alphaValue);
            alphaSlider.style.flex = "1";

            // Добавляем панель управления в контейнер
            controlsPanel.append(modeBlock, zoomBlock, viewBlock, blendBlock);
            panel.appendChild(controlsPanel);

            // Панель с кнопками групп Input_1, Input_2
            const inputButtonPanel = document.createElement("div");
            inputButtonPanel.style.display = "grid";
            inputButtonPanel.style.gridTemplateColumns = "1fr 1fr";
            inputButtonPanel.style.gap = "8px";

            const createInputButtonGroup = (inputLabel) => {
                const groupDiv = document.createElement("div");
                groupDiv.style.display = "flex";
                groupDiv.style.flexDirection = "column";
                groupDiv.style.gap = "4px";

                const groupLabel = document.createElement("div");
                groupLabel.textContent = `Image ${inputLabel}`;
                groupLabel.style.color = "#ccc";
                groupLabel.style.fontSize = "11px";
                groupLabel.style.textAlign = "center";
                groupLabel.style.padding = "2px";
                groupLabel.style.backgroundColor = "#333";
                groupLabel.style.borderRadius = "3px";

                const buttonContainer = document.createElement("div");
                buttonContainer.style.display = "flex";
                buttonContainer.style.flexDirection = "column";
                buttonContainer.style.gap = "4px";

                groupDiv.appendChild(groupLabel);
                groupDiv.appendChild(buttonContainer);

                return { groupDiv, buttonContainer };
            };

            const inputGroups = {};
            ["1", "2"].forEach((label) => {
                const group = createInputButtonGroup(label);
                inputGroups[label] = group;
                inputButtonPanel.appendChild(group.groupDiv);
            });

            panel.appendChild(inputButtonPanel);
            container.append(canvasContainer, panel);

            const ctx = canvas.getContext("2d");

            let imageEntries = [];
            let loadedImages = [];
            let idxA = 0;
            let idxB = 1;
            let currentIndexPair = 0;
            let imagePairs = [];
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

            const updateDropdowns = () => {
                if (!imageEntries.length) {
                    drawPlaceholder();
                    return;
                }

                drawComparedImages();

                // Очищаем старые кнопки
                Object.values(inputGroups).forEach(group => {
                    group.buttonContainer.innerHTML = "";
                });

                // Создаем кнопки для каждого входа
                imageEntries.forEach((entry, idx) => {
                    const label = entry.input_label;
                    if (label && inputGroups[label]) {
                        const btn = document.createElement("button");
                        const batchInfo = entry.batch_size > 1 ? ` [${entry.batch_idx + 1}/${entry.batch_size}]` : "";
                        btn.textContent = `Img ${entry.batch_idx + 1}${batchInfo}`;
                        btn.style.backgroundColor = "#1f1f1f";
                        btn.style.color = "#eee";
                        btn.style.border = "1px solid #555";
                        btn.style.borderRadius = "3px";
                        btn.style.padding = "4px 6px";
                        btn.style.cursor = "pointer";
                        btn.style.fontSize = "11px";
                        btn.style.width = "100%";

                        // Подсветка если это текущее выбранное изображение
                        if (idx === idxA || idx === idxB) {
                            btn.style.backgroundColor = "#4a4a4a";
                            btn.style.borderColor = "#888";
                        }

                        btn.addEventListener("click", () => {
                            if (label === "1") {
                                // Кнопка из Input_1 - устанавливаем как Image A
                                idxA = idx;

                                // Обновляем Image B если оно совпадает с новым Image A
                                if (idxB === idxA) {
                                    // Предпочитаем изображение из Input_2 для B
                                    const input2Image = imageEntries.findIndex(entry => entry.input_label === "2");
                                    if (input2Image !== -1) {
                                        idxB = input2Image;
                                    } else {
                                        // Если нет изображений из Input_2, берем любое другое
                                        for (let i = 0; i < imageEntries.length; i++) {
                                            if (i !== idxA) {
                                                idxB = i;
                                                break;
                                            }
                                        }
                                    }
                                }
                            } else if (label === "2") {
                                // Кнопка из Input_2 - устанавливаем как Image B
                                idxB = idx;

                                // Обновляем Image A если оно совпадает с новым Image B
                                if (idxA === idxB) {
                                    // Предпочитаем изображение из Input_1 для A
                                    const input1Image = imageEntries.findIndex(entry => entry.input_label === "1");
                                    if (input1Image !== -1) {
                                        idxA = input1Image;
                                    } else {
                                        // Если нет изображений из Input_1, берем любое другое
                                        for (let i = 0; i < imageEntries.length; i++) {
                                            if (i !== idxB) {
                                                idxA = i;
                                                break;
                                            }
                                        }
                                    }
                                }
                            }

                            updateDropdowns();
                            drawComparedImages();
                        });

                        inputGroups[label].buttonContainer.appendChild(btn);
                    }
                });
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
                    
                    if (imageEntries.length >= 2) {
                        // Предпочитаем изображение из Input_1 для A
                        const input1Image = imageEntries.findIndex(entry => entry.input_label === "1");
                        idxA = input1Image !== -1 ? input1Image : 0;

                        // Предпочитаем изображение из Input_2 для B
                        const input2Image = imageEntries.findIndex(entry => entry.input_label === "2");
                        idxB = input2Image !== -1 ? input2Image : (idxA === 0 ? 1 : 0);
                    } else if (imageEntries.length === 1) {
                        idxA = 0;
                        idxB = 0;
                    }

                    generateImagePairs();
                    if (imagePairs.length > 0) {
                        currentIndexPair = 0;
                    }
                    
                    updateDropdowns();
                });
            };

            const generateImagePairs = () => {
                imagePairs = [];
                for (let i = 0; i < imageEntries.length; i++) {
                    for (let j = 0; j < imageEntries.length; j++) {
                        if (i !== j) {
                            imagePairs.push({a: i, b: j});
                        }
                    }
                }
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
