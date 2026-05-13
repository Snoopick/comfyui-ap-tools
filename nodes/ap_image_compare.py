import os
import time
import numpy as np
from PIL import Image
import folder_paths


class APImageCompare:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"image_1": ("IMAGE",)},
            "optional": {
                "image_2": ("IMAGE",),
            }
        }

    RETURN_TYPES = ()
    FUNCTION = "compare"
    CATEGORY = "ap-tools"
    OUTPUT_NODE = True

    def _save_image(self, image_tensor, filename, output_dir):
        """Сохраняет изображение в файл"""
        filepath = os.path.join(output_dir, filename)
        img_np = 255.0 * image_tensor.cpu().numpy()
        img_np = np.clip(img_np, 0, 255).astype(np.uint8)
        Image.fromarray(img_np).save(filepath, compress_level=4)
        return {"filename": filename, "subfolder": "", "type": "temp"}

    def compare(self, image_1, image_2=None):
        """Сравнивает изображения из входных данных и формирует выбор одного изображения"""
        temp_dir = folder_paths.get_temp_directory()
        ts = int(time.time() * 1000)

        # Список всех входных изображений
        images = [image_1, image_2]
        labels = ["1", "2"]

        # Сохраняем все изображения из входных данных с метками
        all_images_info = []  # каждый элемент: dict с filename, subfolder, input_label, batch_idx
        for label, image_tensor in zip(labels, images):
            if image_tensor is None:
                continue
            # Handle both tensor and list of tensors
            if isinstance(image_tensor, list):
                batch_size = len(image_tensor)
                images_to_process = image_tensor
            else:
                batch_size = image_tensor.shape[0]
                images_to_process = [image_tensor[i] for i in range(batch_size)]

            for batch_idx, img_tensor in enumerate(images_to_process):
                filename = f"compare_{ts}_in{label}_{batch_idx}.png"
                info = self._save_image(img_tensor, filename, temp_dir)
                info["input_label"] = label
                info["batch_idx"] = batch_idx
                info["batch_size"] = batch_size
                all_images_info.append(info)

        # Формируем UI для вывода: изображения для выбора
        compare_images = []
        # Добавляем информацию об изображениях (чтобы они отобразились в UI)
        for info in all_images_info:
            compare_images.append(info)

        return {"ui": {"ap_compare": compare_images}, "result": []}