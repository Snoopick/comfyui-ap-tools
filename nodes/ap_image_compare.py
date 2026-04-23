import os
import time
import numpy as np
from PIL import Image
import folder_paths


class APImageCompare:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image_1": ("IMAGE",),
                "image_2": ("IMAGE",),
            },
            "optional": {
                "image_3": ("IMAGE",),
                "image_4": ("IMAGE",),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "compare"
    CATEGORY = "ap-tools"
    OUTPUT_NODE = True

    def _save_image(self, image_tensor, index, ts, output_dir):
        filename = f"compare_{ts}_{index}.png"
        filepath = os.path.join(output_dir, filename)

        img_np = 255.0 * image_tensor[0].cpu().numpy()
        img_np = np.clip(img_np, 0, 255).astype(np.uint8)
        Image.fromarray(img_np).save(filepath, compress_level=4)

        return {"filename": filename, "subfolder": "", "type": "temp"}

    def compare(self, image_1, image_2, image_3=None, image_4=None):
        temp_dir = folder_paths.get_temp_directory()

        ts = int(time.time() * 1000)
        images = [image_1, image_2]
        if image_3 is not None:
            images.append(image_3)
        if image_4 is not None:
            images.append(image_4)

        compare_images = [
            self._save_image(image_tensor, idx + 1, ts, temp_dir)
            for idx, image_tensor in enumerate(images)
        ]

        return {"ui": {"ap_compare": compare_images}, "result": ()}
