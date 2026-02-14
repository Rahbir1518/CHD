"""
Quick test: load LipNet and run one inference with dummy input.
Run from backend dir: python test_lip.py
"""
import sys
import os
import numpy as np

# Ensure backend is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

def main():
    print("1. Checking TensorFlow...")
    try:
        import tensorflow as tf
        print(f"   OK: TensorFlow {tf.__version__}")
    except ImportError:
        print("   FAIL: TensorFlow not installed. Run: pip install tensorflow mediapipe opencv-python-headless")
        return 1

    print("2. Loading LipNet model...")
    from lip_model import load_lipnet_model
    model = load_lipnet_model()
    if model is None:
        print("   FAIL: Model failed to load (check backend/models/ for checkpoint.index and checkpoint.data-*)")
        return 1
    print("   OK: Model loaded")

    print("3. Running dummy inference (shape 1,75,46,140,1)...")
    dummy = np.random.randn(1, 75, 46, 140, 1).astype(np.float32) * 0.1
    try:
        import tensorflow as tf
        yhat = model.predict(dummy, verbose=0)
        decoded = tf.keras.backend.ctc_decode(yhat, [75], greedy=True)[0][0]
        indices = decoded.numpy().flatten().tolist()
        from lip_utils import ctc_decode_to_string
        text = ctc_decode_to_string(indices)
        print(f"   OK: Output shape {yhat.shape}, decoded length {len(indices)}, text: {repr(text)}")
    except Exception as e:
        print(f"   FAIL: {e}")
        return 1

    print("4. Testing full pipeline (single frame -> no prediction until 75 frames)...")
    from lip_processor import get_pipeline
    from lip_processor import base64_to_bgr
    # Create a minimal valid image (e.g. 320x240 BGR) and fake base64
    import cv2
    import base64
    img = np.zeros((240, 320, 3), dtype=np.uint8)
    img[:] = (128, 128, 128)
    _, buf = cv2.imencode(".jpg", img)
    b64 = base64.b64encode(buf.tobytes()).decode("utf-8")
    data_url = "data:image/jpeg;base64," + b64
    pipeline = get_pipeline()
    pred, broadcast = pipeline.process_base64(data_url)
    # Without a real face we don't get landmarks, so pred may be None - that's OK
    print(f"   Pipeline run: prediction={repr(pred)}, broadcast={broadcast} (expected without face)")
    print("\nAll checks passed. Lip pipeline is ready.")
    return 0

if __name__ == "__main__":
    sys.exit(main())
