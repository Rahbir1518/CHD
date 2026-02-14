import os
import asyncio
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Import our managers and lip pipeline
from websocket_server import ConnectionManager, ViewerManager
from lip_processor import get_pipeline

load_dotenv()

app = FastAPI(
    title="HapticPhonix Backend",
    description="Real-time camera streaming and phonetics engine",
    version="1.0.0"
)

# CORS - allow all origins so phone and laptop can connect locally
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global managers
manager = ConnectionManager()
viewer_manager = ViewerManager()

@app.get("/")
async def root():
    return {
        "status": "running",
        "service": "HapticPhonix Backend"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

def _run_lip_pipeline(base64_data: str):
    """Run lip pipeline in thread (MediaPipe + LipNet buffer); returns (prediction_text or None, should_broadcast)."""
    try:
        return get_pipeline().process_base64(base64_data)
    except Exception as e:
        print(f"Lip pipeline error: {e}")
        return None, False


@app.websocket("/ws/video")
async def websocket_video(websocket: WebSocket):
    """
    Endpoint for the PHONE (camera source).
    Receives base64 frames, runs MediaPipe + LipNet lip pipeline, relays to viewers and optional vibrate to phone.
    """
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            payload = {"frame_base64": data}

            # Run lip pipeline in thread (extract lip ROI, buffer 75 frames, LipNet inference)
            prediction, should_broadcast = await asyncio.to_thread(_run_lip_pipeline, data)
            if should_broadcast and prediction:
                payload["lip_prediction"] = prediction
                # Optionally trigger haptic on phone for the predicted segment
                try:
                    await websocket.send_json({"type": "vibrate", "pattern": [80, 40, 80]})
                except Exception:
                    pass

            await viewer_manager.broadcast(payload)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"Error in video socket: {e}")
        manager.disconnect(websocket)

@app.websocket("/ws/viewer")
async def websocket_viewer(websocket: WebSocket):
    """
    Endpoint for the DASHBOARD (viewer).
    Receives the broadcasted frames.
    """
    await viewer_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, listen for any client messages (ping/control)
            # The dashboard mostly just LISTENS, doesn't speak much.
            await websocket.receive_text()
    except WebSocketDisconnect:
        viewer_manager.disconnect(websocket)
    except Exception as e:
        print(f"Error in viewer socket: {e}")
        viewer_manager.disconnect(websocket)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Starting server on 0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
