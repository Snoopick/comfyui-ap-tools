import os
import json
from pathlib import Path

class APImageFilePath:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "file_name": ("STRING", {
                    "multiline": False,
                    "default": "image",
                    "tooltip": "Имя файла без расширения"
                }),
                "file_path": ("STRING", {
                    "multiline": False,
                    "default": "",
                    "tooltip": "Путь (например, Test\\Lora)"
                }),
            }
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("full_path",)
    FUNCTION = "process"
    CATEGORY = "ap-tools"
    OUTPUT_NODE = True

    def process(self, file_name, file_path):
        if file_path:
            full = os.path.join(file_path, file_name)
        else:
            full = file_name
        # Windows style backslashes
        full = full.replace("/", "\\")
        return (full,)

NODE_CLASS_MAPPINGS = {
    "APImageFilePath": APImageFilePath,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "APImageFilePath": "AP Image File Path",
}