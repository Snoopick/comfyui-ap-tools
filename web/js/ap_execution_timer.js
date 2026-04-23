import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const STORAGE_KEY = "ap-tools.execution-timer.history.v1";
const RUNTIME_STATE_KEY = "ap-tools.execution-timer.runtime.v1";
const MAX_HISTORY_ITEMS = 3;

function formatDuration(totalMs) {
    const safeMs = Math.max(0, Math.floor(totalMs));
    const safeSeconds = Math.floor(safeMs / 1000);
    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;
    const ms = safeMs % 1000;
    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    const mss = String(ms).padStart(3, "0");
    return `${hh}:${mm}:${ss}.${mss}`;
}

function readHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item) => Number.isFinite(item?.elapsed_ms) && Number.isFinite(item?.executed_at))
            .slice(0, MAX_HISTORY_ITEMS);
    } catch {
        return [];
    }
}

function writeHistory(items) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
    } catch {
        // Ignore storage errors (private mode/full storage).
    }
}

function readRuntimeState() {
    try {
        const raw = localStorage.getItem(RUNTIME_STATE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const startedAtMs = Number(parsed?.started_at_ms);
        const isRunning = parsed?.is_running === true;
        if (!Number.isFinite(startedAtMs)) return null;
        return { startedAtMs, isRunning };
    } catch {
        return null;
    }
}

function writeRuntimeState(isRunning, startedAtMs) {
    try {
        localStorage.setItem(
            RUNTIME_STATE_KEY,
            JSON.stringify({
                is_running: isRunning,
                started_at_ms: startedAtMs,
            })
        );
    } catch {
        // Ignore storage errors.
    }
}

app.registerExtension({
    name: "ap-tools.APExecutionTimer",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "APExecutionTimer") return;

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = onNodeCreated?.apply(this, arguments);

            this.size = [Math.max(this.size[0], 440), Math.max(this.size[1], 160)];

            const container = document.createElement("div");
            container.style.width = "100%";
            container.style.padding = "10px";
            container.style.background = "#1a1a1a";
            container.style.color = "#ddd";
            container.style.borderRadius = "4px";
            container.style.boxSizing = "border-box";
            container.style.fontFamily = "monospace";
            container.style.textAlign = "center";
            container.style.overflow = "hidden";

            const title = document.createElement("div");
            title.textContent = "Workflow runtime";
            title.style.fontSize = "12px";
            title.style.color = "#aaa";
            title.style.marginBottom = "4px";

            const mainCounter = document.createElement("div");
            mainCounter.textContent = "00:00:00";
            mainCounter.style.fontSize = "42px";
            mainCounter.style.fontWeight = "700";
            mainCounter.style.letterSpacing = "1.5px";
            mainCounter.style.lineHeight = "1.15";
            mainCounter.style.whiteSpace = "nowrap";
            mainCounter.style.marginBottom = "10px";

            const historyTitle = document.createElement("div");
            historyTitle.textContent = "Last 3 executions";
            historyTitle.style.fontSize = "12px";
            historyTitle.style.color = "#aaa";
            historyTitle.style.marginBottom = "6px";

            const historyList = document.createElement("div");
            historyList.style.display = "flex";
            historyList.style.flexDirection = "row";
            historyList.style.gap = "8px";
            historyList.style.alignItems = "center";
            historyList.style.justifyContent = "center";
            historyList.style.flexWrap = "wrap";

            const renderHistory = (items) => {
                historyList.innerHTML = "";
                if (!items.length) {
                    const empty = document.createElement("div");
                    empty.textContent = "No runs yet";
                    empty.style.fontSize = "12px";
                    empty.style.color = "#777";
                    historyList.appendChild(empty);
                    return;
                }

                items.forEach((entry, index) => {
                    const row = document.createElement("div");
                    row.style.display = "flex";
                    row.style.justifyContent = "space-between";
                    row.style.alignItems = "center";
                    row.style.gap = "8px";
                    row.style.fontSize = "12px";
                    row.style.padding = "4px 8px";
                    row.style.border = "1px solid #444";
                    row.style.borderRadius = "4px";
                    row.style.minWidth = "92px";

                    const left = document.createElement("span");
                    left.textContent = `#${index + 1}`;
                    left.style.color = "#9ab";

                    const middle = document.createElement("span");
                    middle.textContent = formatDuration(entry.elapsed_ms);
                    middle.style.color = "#ddd";

                    row.append(left, middle);
                    historyList.appendChild(row);
                });
            };

            let currentElapsedMs = 0;
            let timerId = null;
            let history = readHistory();
            let isRunning = false;
            let startedAtMs = 0;

            const repaintCounter = () => {
                currentElapsedMs = Math.max(0, Date.now() - startedAtMs);
                mainCounter.textContent = formatDuration(currentElapsedMs);
            };

            const startCounter = () => {
                if (timerId) clearInterval(timerId);
                repaintCounter();
                timerId = setInterval(repaintCounter, 33);
            };

            const stopCounter = () => {
                if (timerId) {
                    clearInterval(timerId);
                    timerId = null;
                }
            };

            const addHistoryEntry = (elapsedMs) => {
                history = [
                    {
                        elapsed_ms: elapsedMs,
                        executed_at: Math.floor(Date.now() / 1000),
                    },
                    ...history,
                ].slice(0, MAX_HISTORY_ITEMS);
                writeHistory(history);
                renderHistory(history);
            };

            renderHistory(history);
            mainCounter.textContent = "00:00:00.000";

            const restoreRuntimeState = () => {
                const state = readRuntimeState();
                if (!state || !state.isRunning) return;
                startedAtMs = state.startedAtMs;
                currentElapsedMs = Math.max(0, Date.now() - startedAtMs);
                isRunning = true;
                startCounter();
            };

            const handleExecutionStart = () => {
                startedAtMs = Date.now();
                currentElapsedMs = 0;
                isRunning = true;
                writeRuntimeState(true, startedAtMs);
                startCounter();
            };

            const handleExecutionEnd = () => {
                if (!isRunning) return;
                const elapsedMs = Math.max(0, Date.now() - startedAtMs);
                currentElapsedMs = elapsedMs;
                mainCounter.textContent = formatDuration(currentElapsedMs);
                stopCounter();
                isRunning = false;
                writeRuntimeState(false, startedAtMs);
                addHistoryEntry(elapsedMs);
            };

            const handleStatus = (event) => {
                const queueRemaining = event?.detail?.exec_info?.queue_remaining;
                if (isRunning && queueRemaining === 0) {
                    handleExecutionEnd();
                }
            };

            api.addEventListener("execution_start", handleExecutionStart);
            api.addEventListener("execution_end", handleExecutionEnd);
            api.addEventListener("status", handleStatus);
            restoreRuntimeState();

            const onExecuted = this.onExecuted;
            this.onExecuted = function (message) {
                onExecuted?.apply(this, arguments);

                const payload = message?.ap_execution_timer?.[0];
                if (!payload) return;
            };

            container.append(title, mainCounter, historyTitle, historyList);
            this.addDOMWidget("ap_execution_timer", "custom", container, {
                onRemove: () => {
                    stopCounter();
                    api.removeEventListener("execution_start", handleExecutionStart);
                    api.removeEventListener("execution_end", handleExecutionEnd);
                    api.removeEventListener("status", handleStatus);
                },
            });

            return result;
        };
    },
});
