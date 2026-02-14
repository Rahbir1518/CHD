"""
MediaPipe Face Mesh for lip landmark extraction.
Key indices: 0 (Cupid's bow), 13, 14 (inner lip), 78, 308 (outer corners).
"""
import numpy as np

# Lip landmark indices (from HapticPhonix / MediaPipe Face Mesh)
LIP_INNER_TOP, LIP_INNER_BOTTOM = 13, 14
LIP_CORNERS = 78, 308
CUPIDS_BOW = 0
LIP_INDICES = [0, 13, 14, 78, 308]

_face_mesh = None


def _get_face_mesh():
    global _face_mesh
    if _face_mesh is None:
        try:
            import mediapipe as mp
            _face_mesh = mp.solutions.face_mesh.FaceMesh(
                static_image_mode=False,
                max_num_faces=1,
                refine_landmarks=True,
                min_detection_confidence=0.5,
                min_tracking_confidence=0.5,
            )
        except Exception:
            return None
    return _face_mesh


def get_landmarks_from_frame(frame_bgr: np.ndarray):
    """
    Run MediaPipe Face Mesh on a single BGR frame.
    frame_bgr: (H, W, 3) numpy array, BGR.
    Returns list of landmark objects with .x, .y, .z (normalized 0-1), or None.
    """
    mesh = _get_face_mesh()
    if mesh is None:
        return None
    # MediaPipe expects RGB
    import cv2
    rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
    h, w = rgb.shape[:2]
    results = mesh.process(rgb)
    if not results.multi_face_landmarks:
        return None
    return results.multi_face_landmarks[0].landmark
