
import os
import mediapipe as mp

model_path = "face_landmarker.task"

print(f"Checking model file: {model_path}")
if not os.path.exists(model_path):
    print("❌ Model file not found!")
    exit(1)

size = os.path.getsize(model_path)
print(f"Model file size: {size} bytes")

if size < 1000:
    print("❌ Model file too small - likely download failed.")
    exit(1)

print("Attempting to initialize MediaPipe FaceLandmarker...")
try:
    BaseOptions = mp.tasks.BaseOptions
    FaceLandmarker = mp.tasks.vision.FaceLandmarker
    FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
    VisionRunningMode = mp.tasks.vision.RunningMode

    options = FaceLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=model_path),
        running_mode=VisionRunningMode.IMAGE
    )
    detector = FaceLandmarker.create_from_options(options)
    print("✅ Success! Detector created.")
    detector.close()
except Exception as e:
    print(f"❌ Failed to create detector: {e}")
    import traceback
    traceback.print_exc()
