import os
import sys
import json
import time
from pathlib import Path
from aiohttp import web
import server
from .nodes.ap_image_file_path import APImageFilePath
from .nodes.ap_image_preview import APImagePreview
from .nodes.ap_image_compare import APImageCompare
from .nodes.ap_execution_timer import APExecutionTimer, START_TIME

WEB_DIRECTORY = "./web/js"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]

NODE_CLASS_MAPPINGS = {
    "APImageFilePath": APImageFilePath,
    "APImagePreview": APImagePreview,
    "APImageCompare": APImageCompare,
    "APExecutionTimer": APExecutionTimer,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "APImageFilePath": "AP Image File Path",
    "APImagePreview": "AP Image Preview",
    "APImageCompare": "AP Image Compare",
    "APExecutionTimer": "AP Execution Timer",
}

# API для шаблонов путей
TEMPLATES_FILE = Path(__file__).parent / "templates.json"

def load_templates():
    if not TEMPLATES_FILE.exists():
        return {}
    try:
        with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except:
        return {}

def save_templates(templates):
    with open(TEMPLATES_FILE, "w", encoding="utf-8") as f:
        json.dump(templates, f, indent=2, ensure_ascii=False)

@server.PromptServer.instance.routes.get("/ap-tools/templates")
async def get_templates(request):
    templates = load_templates()
    return web.json_response(list(templates.keys()))

@server.PromptServer.instance.routes.get("/ap-tools/templates/all")
async def get_all_templates(request):
    templates = load_templates()
    return web.json_response(templates)

@server.PromptServer.instance.routes.post("/ap-tools/templates")
async def save_template(request):
    data = await request.json()
    name = data.get("name")
    path = data.get("path")
    if not name or path is None:
        return web.Response(status=400, text="Missing name or path")
    templates = load_templates()
    templates[name] = path
    save_templates(templates)
    return web.json_response({"success": True})

@server.PromptServer.instance.routes.delete("/ap-tools/templates/{name}")
async def delete_template(request):
    name = request.match_info["name"]
    templates = load_templates()
    if name in templates:
        del templates[name]
        save_templates(templates)
        return web.json_response({"success": True})
    else:
        return web.Response(status=404, text="Template not found")


@server.PromptServer.instance.routes.get("/ap-tools/execution-timer/uptime")
async def get_execution_timer_uptime(request):
    elapsed_seconds = max(0.0, time.time() - START_TIME)
    return web.json_response({"elapsed_seconds": elapsed_seconds})