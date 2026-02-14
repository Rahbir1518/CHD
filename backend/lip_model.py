"""
LipNet model loader (from LipNet reference).
Input: (75, 46, 140, 1) normalized lip video. Output: CTC logits (75, 41).
"""
import os

def load_lipnet_model():
    """Load LipNet Keras model and weights. Returns None if TensorFlow or checkpoint not available."""
    try:
        from tensorflow.keras.models import Sequential
        from tensorflow.keras.layers import (
            Conv3D, LSTM, Dense, Dropout, Bidirectional,
            MaxPool3D, Activation, TimeDistributed, Flatten,
        )
    except ImportError:
        return None

    model = Sequential()
    model.add(Conv3D(128, 3, input_shape=(75, 46, 140, 1), padding="same"))
    model.add(Activation("relu"))
    model.add(MaxPool3D((1, 2, 2)))

    model.add(Conv3D(256, 3, padding="same"))
    model.add(Activation("relu"))
    model.add(MaxPool3D((1, 2, 2)))

    model.add(Conv3D(75, 3, padding="same"))
    model.add(Activation("relu"))
    model.add(MaxPool3D((1, 2, 2)))

    model.add(TimeDistributed(Flatten()))
    model.add(Bidirectional(LSTM(128, kernel_initializer="Orthogonal", return_sequences=True)))
    model.add(Dropout(0.5))
    model.add(Bidirectional(LSTM(128, kernel_initializer="Orthogonal", return_sequences=True)))
    model.add(Dropout(0.5))
    model.add(Dense(41, kernel_initializer="he_normal", activation="softmax"))

    # Load weights from backend/models/checkpoint (same format as LipNet)
    base = os.path.dirname(os.path.abspath(__file__))
    checkpoint_path = os.path.join(base, "models", "checkpoint")
    if os.path.exists(checkpoint_path):
        model.load_weights(checkpoint_path)
    return model
