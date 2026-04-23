import { app } from "../../../scripts/app.js";

function createCustomTemplateManager(node) {
    const filePathWidget = node.widgets?.find(w => w.name === "file_path");
    if (!filePathWidget) return;
    let activeTemplatePath = "";
    let userRelativePath = "";
    const SELECTED_TEMPLATE_PROP = "ap_selected_template";
    const USER_RELATIVE_PATH_PROP = "ap_user_relative_path";
    node.properties = node.properties || {};

    const container = document.createElement("div");
    container.style.margin = "15px 0 5px 0";
    container.style.width = "100%";
    container.style.display = "flex";
    container.style.flexDirection = "column";

    const topRow = document.createElement("div");
    topRow.style.display = "flex";
    topRow.style.gap = "5px";
    topRow.style.alignItems = "center";

    const templateSelect = document.createElement("select");
    templateSelect.style.flex = "2";
    templateSelect.style.padding = "4px";
    templateSelect.style.backgroundColor = "#2a2a2a";
    templateSelect.style.color = "#ccc";
    templateSelect.style.border = "1px solid #555";
    templateSelect.style.borderRadius = "4px";
    templateSelect.style.fontSize = "12px";

    const newTemplateName = document.createElement("input");
    newTemplateName.type = "text";
    newTemplateName.placeholder = "New template name";
    newTemplateName.style.flex = "2";
    newTemplateName.style.padding = "4px";
    newTemplateName.style.backgroundColor = "#2a2a2a";
    newTemplateName.style.color = "#ccc";
    newTemplateName.style.border = "1px solid #555";
    newTemplateName.style.borderRadius = "4px";
    newTemplateName.style.fontSize = "12px";

    topRow.appendChild(templateSelect);
    topRow.appendChild(newTemplateName);

    const filePathRow = document.createElement("div");
    filePathRow.style.display = "flex";
    filePathRow.style.gap = "5px";

    const relativePathInput = document.createElement("input");
    relativePathInput.type = "text";
    relativePathInput.placeholder = "file_path";
    relativePathInput.style.flex = "1";
    relativePathInput.style.padding = "4px";
    relativePathInput.style.backgroundColor = "#2a2a2a";
    relativePathInput.style.color = "#ccc";
    relativePathInput.style.border = "1px solid #555";
    relativePathInput.style.borderRadius = "4px";
    relativePathInput.style.fontSize = "12px";
    relativePathInput.style.marginTop = "5px";
    filePathRow.appendChild(relativePathInput);

    const buttonRow = document.createElement("div");
    buttonRow.style.display = "flex";
    buttonRow.style.gap = "5px";
    buttonRow.style.marginTop = "5px";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.style.padding = "4px 12px";
    saveBtn.style.backgroundColor = "#5a6e3a";
    saveBtn.style.color = "#fff";
    saveBtn.style.border = "none";
    saveBtn.style.borderRadius = "4px";
    saveBtn.style.cursor = "pointer";
    saveBtn.style.fontSize = "12px";

    const openBtn = document.createElement("button");
    openBtn.textContent = "Open Folder";
    openBtn.style.padding = "4px 12px";
    openBtn.style.backgroundColor = "#3a5a8e";
    openBtn.style.color = "#fff";
    openBtn.style.border = "none";
    openBtn.style.borderRadius = "4px";
    openBtn.style.cursor = "pointer";
    openBtn.style.fontSize = "12px";

    const deleteBtn = document.createElement("button");
    deleteBtn.textContent = "Delete";
    deleteBtn.style.padding = "4px 12px";
    deleteBtn.style.backgroundColor = "#a53a3a";
    deleteBtn.style.color = "#fff";
    deleteBtn.style.border = "none";
    deleteBtn.style.borderRadius = "4px";
    deleteBtn.style.cursor = "pointer";
    deleteBtn.style.fontSize = "12px";

    buttonRow.appendChild(saveBtn);
    buttonRow.appendChild(openBtn);
    buttonRow.appendChild(deleteBtn);

    container.appendChild(topRow);
    container.appendChild(filePathRow);
    container.appendChild(buttonRow);

    async function loadTemplatesList() {
        try {
            const resp = await fetch("/ap-tools/templates");
            if (!resp.ok) throw new Error();
            const names = await resp.json();
            templateSelect.innerHTML = '<option value="">-- Select template --</option>';
            names.forEach(name => {
                const opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                templateSelect.appendChild(opt);
            });
            const savedTemplate = node.properties[SELECTED_TEMPLATE_PROP] || "";
            if (savedTemplate && names.includes(savedTemplate)) {
                templateSelect.value = savedTemplate;
                await applyTemplate();
            } else if (savedTemplate) {
                node.properties[SELECTED_TEMPLATE_PROP] = "";
            }
        } catch (e) {
            console.error("Failed to load templates", e);
        }
    }

    async function saveTemplate() {
        const name = newTemplateName.value.trim();
        if (!name) {
            alert("Enter template name");
            return;
        }
        const path = relativePathInput.value.trim();
        try {
            await fetch("/ap-tools/templates", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, path })
            });
            newTemplateName.value = "";
            await loadTemplatesList();
            templateSelect.value = name;
            node.properties[SELECTED_TEMPLATE_PROP] = name;
            node.setDirtyCanvas(true);
        } catch (e) {
            alert("Save failed");
        }
    }

    function getRelativeUserPath(currentPath, templatePathOverride = null) {
        const normalizedCurrent = (currentPath || "").replace(/\//g, "\\").trim();
        const normalizedTemplate = (
            templatePathOverride === null ? activeTemplatePath : templatePathOverride
        || "").replace(/\//g, "\\").trim();
        if (!normalizedTemplate) return normalizedCurrent;
        if (normalizedCurrent === normalizedTemplate) return "";
        if (normalizedCurrent.startsWith(`${normalizedTemplate}\\`)) {
            return normalizedCurrent.slice(normalizedTemplate.length + 1);
        }
        return normalizedCurrent;
    }

    function buildFullPath(relativePath) {
        const rel = (relativePath || "").replace(/\//g, "\\").trim();
        const tpl = (activeTemplatePath || "").replace(/\//g, "\\").trim();
        if (tpl && rel) return `${tpl}\\${rel}`;
        if (tpl) return tpl;
        return rel;
    }

    function setFilePathValue(fullPath, visiblePath) {
        const normalizedFull = (fullPath || "").replace(/\//g, "\\");
        const normalizedVisible = (visiblePath ?? fullPath ?? "").replace(/\//g, "\\");
        filePathWidget.value = normalizedFull;
        if (filePathWidget.callback) {
            filePathWidget.callback(normalizedFull);
        }
        relativePathInput.value = normalizedVisible;
        node.setDirtyCanvas(true);
        if (app.graph) app.graph.change();
    }

    function syncFromVisibleInput() {
        userRelativePath = (relativePathInput.value || "").trim();
        node.properties[USER_RELATIVE_PATH_PROP] = userRelativePath;
        const fullPath = buildFullPath(userRelativePath);
        setFilePathValue(fullPath, userRelativePath);
    }

    async function applyTemplate() {
        const name = templateSelect.value;
        node.properties[SELECTED_TEMPLATE_PROP] = name || "";
        if (!name) {
            userRelativePath = (node.properties[USER_RELATIVE_PATH_PROP] || "").trim();
            activeTemplatePath = "";
            setFilePathValue(userRelativePath, userRelativePath);
            return;
        }
        try {
            const resp = await fetch("/ap-tools/templates/all");
            const all = await resp.json();
            if (all[name] !== undefined) {
                const selectedTemplatePath = (all[name] || "").replace(/\//g, "\\").trim();
                userRelativePath = (node.properties[USER_RELATIVE_PATH_PROP] || "").trim();
                activeTemplatePath = selectedTemplatePath;
                const fullPath = buildFullPath(userRelativePath);
                setFilePathValue(fullPath, userRelativePath);
            } else {
                alert(`Template "${name}" not found`);
            }
        } catch (e) {
            console.error("Template apply failed", e);
            alert("Template apply failed");
        }
    }

    async function deleteTemplate() {
        const name = templateSelect.value;
        if (!name) {
            alert("Select a template to delete");
            return;
        }
        if (!confirm(`Delete template "${name}"?`)) return;
        try {
            const resp = await fetch(`/ap-tools/templates/${encodeURIComponent(name)}`, {
                method: "DELETE"
            });
            const data = await resp.json();
            if (data.success) {
                await loadTemplatesList();
                templateSelect.value = "";
                node.properties[SELECTED_TEMPLATE_PROP] = "";
                activeTemplatePath = "";
                setFilePathValue(userRelativePath, userRelativePath);
            } else {
                alert("Delete failed");
            }
        } catch (e) {
            alert("Delete failed");
        }
    }

    async function openFolder() {
        const currentPath = filePathWidget.value;
        if (!currentPath) {
            alert("No path specified");
            return;
        }
        
        // Добавляем префикс output/ к пути, так как ComfyUI сохраняет изображения в этой директории
        const outputPath = "ComfyUI/output/" + currentPath;
        
        try {
            const resp = await fetch("/ap-tools/open-folder", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: outputPath })
            });
            
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || "Failed to open folder");
            }
        } catch (e) {
            alert(`Failed to open folder: ${e.message}`);
        }
    }

    saveBtn.onclick = saveTemplate;
    openBtn.onclick = openFolder;
    deleteBtn.onclick = deleteTemplate;
    templateSelect.onchange = applyTemplate;
    relativePathInput.addEventListener("input", syncFromVisibleInput);
    relativePathInput.addEventListener("change", syncFromVisibleInput);

    // Hide native file_path widget; keep it as internal value only.
    filePathWidget.computeSize = () => [0, -4];
    filePathWidget.type = "hidden";

    node.addDOMWidget("ap_template_manager", "custom", container, {
        onRemove: () => {}
    });

    userRelativePath = (node.properties[USER_RELATIVE_PATH_PROP] || "").trim();
    relativePathInput.value = userRelativePath;
    if (!node.properties[SELECTED_TEMPLATE_PROP]) {
        setFilePathValue(userRelativePath, userRelativePath);
    }
    loadTemplatesList();
}

app.registerExtension({
    name: "ap-tools.APImageFilePath",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "APImageFilePath") {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const result = onNodeCreated?.apply(this, arguments);
                
                // Установка минимальных размеров ноды
                const minWidth = 350;
                const minHeight = 170;
                if (this.size[0] < minWidth) this.size[0] = minWidth;
                if (this.size[1] < minHeight) this.size[1] = minHeight;
                
                // Создаем кастомный интерфейс
                setTimeout(() => createCustomTemplateManager(this), 100);
                return result;
            };
        }
    }
});