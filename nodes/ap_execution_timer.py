import time

START_TIME = time.time()


class APExecutionTimer:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    FUNCTION = "run"
    CATEGORY = "ap-tools"
    OUTPUT_NODE = True

    def run(self):
        elapsed_seconds = max(0.0, time.time() - START_TIME)
        return {
            "ui": {
                "ap_execution_timer": [
                    {
                        "elapsed_seconds": elapsed_seconds,
                        "executed_at": int(time.time()),
                    }
                ]
            },
            "result": (),
        }
