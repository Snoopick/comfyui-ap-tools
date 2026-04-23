import torch
import numpy as np
from PIL import Image
import os
import folder_paths
import time


class APImagePreview:
    @classmethod
    def INPUT_TYPES(s):
        return {"required": {"image": ("IMAGE",)}}

    RETURN_TYPES = ()
    FUNCTION = "preview"
    CATEGORY = "ap-tools"
    OUTPUT_NODE = True

    def preview(self, image):
        temp_dir = folder_paths.get_temp_directory()

        preview_images = []

        for i, img_tensor in enumerate(image):
            filename = f"preview_{int(time.time() * 1000)}_{i}.png"
            filepath = os.path.join(temp_dir, filename)

            img_np = 255.0 * img_tensor.cpu().numpy()
            img_np = np.clip(img_np, 0, 255).astype(np.uint8)
            img = Image.fromarray(img_np)
            img.save(filepath, compress_level=4)

            preview_images.append(
                {"filename": filename, "subfolder": "", "type": "temp"}
            )

        # Передаем в кастомное поле, чтобы не рисовался стандартный preview ComfyUI.
        return {"ui": {"ap_preview": preview_images}, "result": ()}
