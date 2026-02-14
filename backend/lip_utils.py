"""
LipNet preprocessing: vocab, CTC decode, and lip ROI extraction.
Uses same vocab and decode logic as LipNet reference.
"""
import numpy as np

# LipNet vocabulary (same as reference)
VOCAB = [x for x in "abcdefghijklmnopqrstuvwxyz'?!123456789 "]
# Character to index mapping for CTC
CHAR_TO_NUM = {c: i for i, c in enumerate(VOCAB)}
NUM_TO_CHAR = {i: c for i, c in enumerate(VOCAB)}
VOCAB_SIZE = len(VOCAB)  # 41

# LipNet input: 75 frames, each frame 46 (height) x 140 (width) grayscale
LIP_HEIGHT = 46
LIP_WIDTH = 140
NUM_FRAMES = 75


def get_mouth_bbox_from_landmarks(landmarks, frame_width: int, frame_height: int, padding: float = 0.3):
    """
    Get mouth bounding box from MediaPipe face mesh landmarks.
    Key indices: 0 (Cupid's bow), 13, 14 (inner lip), 78, 308 (outer corners).
    """
    # MediaPipe Face Mesh lip indices (from HapticPhonix spec)
    lip_indices = [0, 13, 14, 78, 308]
    xs, ys = [], []
    for i in lip_indices:
        if i < len(landmarks):
            lm = landmarks[i]
            xs.append(lm.x * frame_width)
            ys.append(lm.y * frame_height)
    if not xs or not ys:
        return None
    x_min, x_max = min(xs), max(xs)
    y_min, y_max = min(ys), max(ys)
    w = x_max - x_min
    h = y_max - y_min
    pad_w = w * padding
    pad_h = h * padding
    x_min = max(0, int(x_min - pad_w))
    x_max = min(frame_width, int(x_max + pad_w))
    y_min = max(0, int(y_min - pad_h))
    y_max = min(frame_height, int(y_max + pad_h))
    return (x_min, y_min, x_max - x_min, y_max - y_min)


def extract_lip_roi(frame_bgr: np.ndarray, bbox) -> np.ndarray:
    """
    Crop mouth region and preprocess for LipNet: grayscale, resize to (LIP_HEIGHT, LIP_WIDTH), normalize.
    frame_bgr: (H, W, 3) BGR from OpenCV
    bbox: (x, y, w, h)
    Returns: (LIP_HEIGHT, LIP_WIDTH, 1) float32 normalized
    """
    import cv2
    x, y, w, h = bbox
    if w <= 0 or h <= 0:
        return None
    crop = frame_bgr[y : y + h, x : x + w]
    gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
    resized = cv2.resize(gray, (LIP_WIDTH, LIP_HEIGHT), interpolation=cv2.INTER_LINEAR)
    # (46, 140) -> (46, 140, 1)
    resized = np.expand_dims(resized, axis=-1).astype(np.float32)
    return resized


def normalize_frames(frames: np.ndarray) -> np.ndarray:
    """
    Normalize a batch of lip frames (same as LipNet load_video): (N, 46, 140, 1) -> subtract mean, divide by std.
    """
    mean = np.mean(frames)
    std = np.std(frames)
    if std < 1e-6:
        std = 1.0
    return ((frames - mean) / std).astype(np.float32)


def ctc_decode_to_string(indices: list) -> str:
    """Convert CTC output indices to string (collapse blanks and duplicates)."""
    # Blank is last index (40); vocab 0..39 are chars
    blank = VOCAB_SIZE - 1 if VOCAB_SIZE > 0 else 40
    prev = blank
    out = []
    for i in indices:
        if i != blank and i != prev:
            if i < len(NUM_TO_CHAR):
                out.append(NUM_TO_CHAR[i])
        prev = i
    return "".join(out).strip()
