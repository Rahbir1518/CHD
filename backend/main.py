import os
import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Import our managers
from websocket_server import ConnectionManager, ViewerManager

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

@app.websocket("/ws/video")
async def websocket_video(websocket: WebSocket):
    """
    Endpoint for the PHONE (camera source).
    Receives base64 frames, and relays them to dashboard viewers.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Receive base64 frame data from phone
            # We expect just the raw base64 string or a simple JSON
            # For simplicity matching the reference, let's assume raw base64 string first
            # but usually it's better to send JSON. 
            # Reference C:\cxc\cxc implementation receives text.
            data = await websocket.receive_text()
            
            # Construct the payload for viewers
            # We can add processed data here later (MediaPipe landmarks etc.)
            payload = {
                "frame_base64": data,
                # "landmarks": ... (future)
            }
            
            # Broadcast to all dashboards
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
