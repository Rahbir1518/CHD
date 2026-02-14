"""
Lip training pipeline: receive frames from phone stream, extract lip ROI via MediaPipe,
buffer 75 frames, run LipNet, return decoded text. Integrates with phoneme/haptic.
"""
import base64
import numpy as np
from collections import deque
from lip_utils import (
    get_mouth_bbox_from_landmarks,
    extract_lip_roi,
    normalize_frames,
    ctc_decode_to_string,
    NUM_FRAMES,
    LIP_HEIGHT,
    LIP_WIDTH,
)
from mediapipe_processor import get_landmarks_from_frame

# Optional TensorFlow/LipNet
_lipnet_model = None


def _get_model():
    global _lipnet_model
    if _lipnet_model is None:
        try:
            from lip_model import load_lipnet_model
            _lipnet_model = load_lipnet_model()
        except Exception:
            _lipnet_model = False  # disabled
    return _lipnet_model if _lipnet_model else None


def base64_to_bgr(data: str) -> np.ndarray:
    """Decode base64 image (data URL or raw) to BGR numpy array."""
    import cv2
    if data.startswith("data:"):
        data = data.split(",", 1)[1]
    raw = base64.b64decode(data)
    buf = np.frombuffer(raw, dtype=np.uint8)
    img = cv2.imdecode(buf, cv2.IMREAD_COLOR)
    return img


class LipPipeline:
    """Buffers lip ROI frames and runs LipNet every NUM_FRAMES."""

    def __init__(self, maxlen: int = NUM_FRAMES):
        self.buffer = deque(maxlen=maxlen)
        self._model = None

    def process_frame(self, frame_bgr: np.ndarray):
        """
        Process one BGR frame: run MediaPipe, extract lip ROI, push to buffer.
        Returns (prediction_text, should_broadcast) when we have a new prediction; else (None, False).
        """
        if frame_bgr is None or frame_bgr.size == 0:
            return None, False

        h, w = frame_bgr.shape[:2]
        landmarks = get_landmarks_from_frame(frame_bgr)
        if landmarks is None:
            return None, False

        bbox = get_mouth_bbox_from_landmarks(landmarks, w, h)
        if bbox is None:
            return None, False

        roi = extract_lip_roi(frame_bgr, bbox)
        if roi is None:
            return None, False

        self.buffer.append(roi)
        if len(self.buffer) < NUM_FRAMES:
            return None, False

        # Buffer full: run LipNet
        model = _get_model()
        if model is None:
            self.buffer.clear()
            return None, False

        try:
            import tensorflow as tf
            frames = np.stack(list(self.buffer), axis=0)  # (75, 46, 140, 1)
            frames = normalize_frames(frames)
            batch = np.expand_dims(frames, axis=0)
            yhat = model.predict(batch, verbose=0)
            # CTC decode: greedy
            decoded = tf.keras.backend.ctc_decode(yhat, [NUM_FRAMES], greedy=True)[0][0]
            indices = decoded.numpy().flatten().tolist()
            text = ctc_decode_to_string(indices)
            self.buffer.clear()
            return text, True
        except Exception:
            self.buffer.clear()
            return None, False

    def process_base64(self, base64_data: str):
        """Decode base64 frame, run process_frame. Returns (prediction_text, should_broadcast)."""
        frame = base64_to_bgr(base64_data)
        return self.process_frame(frame)


# Singleton pipeline for the video stream
_pipeline: LipPipeline | None = None


def get_pipeline() -> LipPipeline:
    global _pipeline
    if _pipeline is None:
        _pipeline = LipPipeline()
    return _pipeline
