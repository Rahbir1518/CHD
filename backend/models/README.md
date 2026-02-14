# LipNet model weights

Place the LipNet checkpoint here so the lip reading pipeline can run.

1. Download the checkpoint (from the LipNet reference):
   - Google Drive: https://drive.google.com/uc?id=1vWscXs4Vt0a_1IH1-ct2TCgXAZT-N3_Y
   - Or with gdown: `gdown 1vWscXs4Vt0a_1IH1-ct2TCgXAZT-N3_Y -O checkpoints.zip && unzip -o checkpoints.zip -d .`

2. Ensure this directory contains the `checkpoint` weight files (e.g. `checkpoint`, `checkpoint.index`, `checkpoint.data-*`).

If the checkpoint is missing, the backend still runs; lip predictions are simply skipped until weights are added.

## Test that it works

From the **backend** directory:

```bash
# Install deps once (TensorFlow is large; use tensorflow-cpu for faster install)
pip install tensorflow-cpu mediapipe opencv-python-headless

# Run the lip pipeline test
python test_lip.py
```

You should see: model loaded, dummy inference OK, and "All checks passed. Lip pipeline is ready."
