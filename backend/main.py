import os
import asyncio
import uvicorn
import time
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import json

# Import our components
from websocket_server import manager, viewer_manager, haptic_manager, speech_manager
from mediapipe_processor import MediaPipeProcessor
from phoneme_engine import phoneme_engine, load_lesson

load_dotenv()

app = FastAPI(
    title="HapticPhonix Backend",
    description="Real-time camera streaming, phonetics engine, and haptic feedback system",
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

# Global components
media_processor = MediaPipeProcessor()

# Set up callbacks for phoneme engine
phoneme_engine.set_haptic_callback(
    lambda phoneme: asyncio.create_task(
        haptic_manager.trigger_haptic(viewer_manager, phoneme.type, phoneme.confidence)
    )
)

phoneme_engine.set_speech_analysis_callback(
    lambda analysis: asyncio.create_task(
        speech_manager.process_speech_analysis(viewer_manager, {
            'transcript': analysis.transcript,
            'confidence': analysis.confidence,
            'detected_phonemes': analysis.detected_phonemes,
            'pronunciation_quality': analysis.pronunciation_quality.value,
            'suggestions': analysis.suggestions
        })
    )
)

@app.get("/")
async def root():
    return {
        "status": "running",
        "service": "HapticPhonix Backend",
        "version": "1.0.0",
        "active_connections": len(manager.active_connections),
        "active_viewers": len(viewer_manager.viewers)
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "components": {
            "websocket_server": "ok",
            "mediapipe_processor": "ok",
            "phoneme_engine": "ok"
        }
    }

@app.get("/lessons")
async def list_lessons():
    """List available lessons."""
    import os
    lessons_dir = os.path.join(os.path.dirname(__file__), "lessons")
    lessons = []
    
    if os.path.exists(lessons_dir):
        for filename in os.listdir(lessons_dir):
            if filename.endswith('.json'):
                lessons.append(filename)
    
    return {"lessons": lessons}

@app.post("/lessons/load/{lesson_name}")
async def load_lesson_endpoint(lesson_name: str):
    """Load a specific lesson."""
    import os
    lesson_path = os.path.join(os.path.dirname(__file__), "lessons", lesson_name)
    
    if not os.path.exists(lesson_path):
        return JSONResponse(
            status_code=404,
            content={"error": f"Lesson '{lesson_name}' not found"}
        )
    
    success = load_lesson(lesson_path)
    if success:
        return {"message": f"Lesson '{lesson_name}' loaded successfully"}
    else:
        return JSONResponse(
            status_code=500,
            content={"error": "Failed to load lesson"}
        )

@app.post("/playback/start")
async def start_playback(request: Request):
    """Start phoneme playback."""
    data = await request.json()
    start_time = data.get("start_time", 0.0)
    phoneme_engine.start_playback(start_time)
    return {"message": "Playback started", "start_time": start_time}

@app.post("/playback/pause")
async def pause_playback():
    """Pause phoneme playback."""
    phoneme_engine.pause_playback()
    return {"message": "Playback paused"}

@app.post("/playback/resume")
async def resume_playback():
    """Resume phoneme playback."""
    phoneme_engine.resume_playback()
    return {"message": "Playback resumed"}

@app.post("/playback/stop")
async def stop_playback():
    """Stop phoneme playback."""
    phoneme_engine.stop_playback()
    return {"message": "Playback stopped"}

@app.get("/playback/status")
async def playback_status():
    """Get current playback status."""
    return phoneme_engine.get_playback_progress()

@app.websocket("/ws/video")
async def websocket_video(websocket: WebSocket):
    """
    Endpoint for the PHONE (camera source).
    Receives base64 frames, processes with MediaPipe, and relays to dashboard viewers.
    """
    await manager.connect(websocket)
    try:
        frame_count = 0
        while True:
            # Receive frame data from phone
            data = await websocket.receive_text()
            frame_count += 1
            
            print(f"Received frame {frame_count}")
            
            # Try to parse as JSON first
            try:
                json_data = json.loads(data)
                frame_data = json_data.get('frame_base64', data)
                print(f"Parsed JSON frame, length: {len(frame_data) if isinstance(frame_data, str) else 'N/A'}")
            except json.JSONDecodeError:
                frame_data = data
                print(f"Raw frame data, length: {len(frame_data)}")
            
            # Process frame with MediaPipe
            processed_data = media_processor.process_frame(frame_data)
            
            if 'error' in processed_data:
                print(f"Frame processing error: {processed_data['error']}")
                # Still broadcast the original frame even if processing failed
                payload = {
                    'frame_base64': frame_data,
                    'landmarks': [],
                    'landmark_count': 0,
                    'timestamp': time.time(),
                    'processing_error': processed_data['error']
                }
                await viewer_manager.broadcast(payload)
                continue
            
            # Add timestamp
            processed_data['timestamp'] = time.time()
            processed_data['frame_number'] = frame_count
            
            print(f"Broadcasting frame {frame_count} with {processed_data.get('landmark_count', 0)} landmarks")
            
            # Broadcast to all dashboards
            await viewer_manager.broadcast(processed_data)
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"Error in video socket: {e}")
        manager.disconnect(websocket)

@app.websocket("/ws/viewer")
async def websocket_viewer(websocket: WebSocket):
    """
    Endpoint for the DASHBOARD (viewer).
    Receives broadcasted frames and haptic events.
    """
    await viewer_manager.connect(websocket)
    try:
        while True:
            # Listen for control messages from viewer
            message = await websocket.receive_text()
            try:
                data = json.loads(message)
                # Handle viewer control messages
                if data.get('type') == 'control':
                    action = data.get('action')
                    if action == 'load_lesson':
                        lesson_name = data.get('lesson_name', 'sample_lesson.json')
                        load_lesson(os.path.join('lessons', lesson_name))
                    elif action == 'start_playback':
                        start_time = data.get('start_time', 0.0)
                        phoneme_engine.start_playback(start_time)
                    elif action == 'pause_playback':
                        phoneme_engine.pause_playback()
            except json.JSONDecodeError:
                # Not JSON, ignore
                pass
            except Exception as e:
                print(f"Error processing viewer message: {e}")
                
    except WebSocketDisconnect:
        viewer_manager.disconnect(websocket)
    except Exception as e:
        print(f"Error in viewer socket: {e}")
        viewer_manager.disconnect(websocket)

# Background task to update phoneme engine
def start_background_tasks():
    async def update_phoneme_engine():
        while True:
            phoneme_engine.update()
            await asyncio.sleep(0.05)  # Update ~20 times per second
    
    asyncio.create_task(update_phoneme_engine())

@app.on_event("startup")
async def startup_event():
    """Initialize background tasks on startup."""
    start_background_tasks()
    # Load default lesson
    default_lesson = os.path.join(os.path.dirname(__file__), "lessons", "sample_lesson.json")
    if os.path.exists(default_lesson):
        load_lesson(default_lesson)
        print("Default lesson loaded")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Starting HapticPhonix server on 0.0.0.0:{port}")
    print(f"📱 Video endpoint: ws://localhost:{port}/ws/video")
    print(f"👁️  Viewer endpoint: ws://localhost:{port}/ws/viewer")
    print(f"📚 Lessons endpoint: http://localhost:{port}/lessons")
    uvicorn.run(app, host="0.0.0.0", port=port)
