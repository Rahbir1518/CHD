import os
import asyncio
import uvicorn
import time
import base64
import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
import json

# Import our components
from websocket_server import manager, viewer_manager, haptic_manager, speech_manager
from mediapipe_processor import MediaPipeProcessor
from phoneme_engine import phoneme_engine, load_lesson
from lip_reading import lip_reader

# Load .env from backend directory so GEMINI_API_KEY is found
_load_env = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local")
load_dotenv(_load_env)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

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
        haptic_manager.trigger_haptic(
            viewer_manager, phoneme.type, phoneme.confidence, connection_manager=manager
        )
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


@app.post("/haptic/test")
async def test_haptic():
    """Send a test haptic pattern to all connected phones and viewers (Phase 1: Haptic Remote)."""
    await haptic_manager.trigger_haptic(
        viewer_manager, "buzz", 1.0, connection_manager=manager
    )
    return {"message": "Test haptic sent", "pattern": haptic_manager.get_pattern("buzz")}

@app.get("/playback/status")
async def playback_status():
    """Get current playback status."""
    return phoneme_engine.get_playback_progress()

@app.websocket("/ws/video")
async def websocket_video(websocket: WebSocket):
    """
    Endpoint for the PHONE (camera source).
    Receives base64 frames, processes with MediaPipe, draws bounding boxes,
    feeds lip frames into the LipReadingEngine, and relays to dashboard viewers.
    Also sends the processed (annotated) frame back to the phone for display.
    """
    await manager.connect(websocket)
    try:
        frame_count = 0
        while True:
            # Receive frame data from phone
            data = await websocket.receive_text()
            frame_count += 1
            
            if frame_count <= 3 or frame_count % 120 == 0:
                print(f"Received frame {frame_count}")
            
            # Try to parse as JSON first
            try:
                json_data = json.loads(data)
                frame_data = json_data.get('frame_base64', data)
            except json.JSONDecodeError:
                frame_data = data
            
            # Process frame with MediaPipe (extracts landmarks + draws bounding box)
            processed_data = media_processor.process_frame(frame_data)
            if frame_count <= 3 or frame_count % 120 == 0:
                n_land = processed_data.get("landmark_count", 0)
                err = processed_data.get("error", "")
                print(f"Frame {frame_count}: landmarks={n_land} err={err or 'ok'}")
            
            if "error" in processed_data:
                # Still broadcast the original frame even if processing failed
                payload = {
                    'frame_base64': frame_data,
                    'landmarks': [],
                    'landmark_count': 0,
                    'timestamp': time.time(),
                    'processing_error': processed_data['error']
                }
                await viewer_manager.broadcast(payload)
                # Send back to phone too so it can display errors
                try:
                    await websocket.send_json({"type": "processed_frame", **payload})
                except Exception:
                    pass
                continue
            
            # ── Mouth movement tracking ──
            openness = 0.0
            landmarks = processed_data.get('landmarks', [])
            top = next((l for l in landmarks if l.get('index') == 13), None)
            bottom = next((l for l in landmarks if l.get('index') == 14), None)
            if top and bottom:
                openness = abs(bottom['y'] - top['y'])
            
            mouth_info = lip_reader.update_mouth_state(openness)
            processed_data['mouth_state'] = mouth_info['mouth_state']
            processed_data['mouth_openness'] = mouth_info['openness']
            processed_data['mouth_velocity'] = mouth_info['velocity']
            
            # ── Feed frames into lip reading buffer ──
            lip_bbox = processed_data.get('lip_bounding_box')
            if lip_bbox and processed_data.get('frame_base64'):
                cropped = lip_reader.crop_lip_region(
                    processed_data['frame_base64'], lip_bbox
                )
                lip_reader.add_frame(cropped)
            
            # ── Trigger Gemini lip reading if ready ──
            if lip_reader.should_analyze():
                # Fire and forget — don't block the video stream
                asyncio.create_task(_run_lip_analysis())
            
            # Add timestamp
            processed_data['timestamp'] = time.time()
            processed_data['frame_number'] = frame_count
            
            # Broadcast to all dashboards
            await viewer_manager.broadcast(processed_data)
            
            # ── Send processed frame back to phone for bounding box display ──
            try:
                await websocket.send_json({
                    "type": "processed_frame",
                    "frame_base64": processed_data.get('frame_base64', ''),
                    "landmarks": processed_data.get('landmarks', []),
                    "lip_bounding_box": lip_bbox,
                    "mouth_state": mouth_info['mouth_state'],
                })
            except Exception:
                pass
            
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"Error in video socket: {e}")
        manager.disconnect(websocket)


async def _run_lip_analysis():
    """Background task: run Gemini lip reading and broadcast result."""
    try:
        result = await lip_reader.analyze_frames()
        if result and result.detected_text:
            event = {
                "type": "lip_reading",
                "detected_text": result.detected_text,
                "confidence": result.confidence,
                "mouth_state": result.mouth_state,
                "phonemes_detected": result.phonemes_detected,
                "analysis_notes": result.analysis_notes,
                "timestamp": result.timestamp,
            }
            await viewer_manager.broadcast(event)
            print(f"👄 Lip reading: '{result.detected_text}' ({result.confidence:.0%})")
    except Exception as e:
        print(f"Lip analysis background error: {e}")

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
                        lesson_path = os.path.join(os.path.dirname(__file__), 'lessons', lesson_name)
                        load_lesson(lesson_path)
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


# ── Lip Reading Endpoint ────────────────────────────────────────────────────

@app.post("/api/lip-read")
async def lip_read_frame(request: Request):
    """
    On-demand lip reading analysis.
    Accepts JSON with { frame_base64: string }
    Returns detected text, confidence, mouth state, etc.
    """
    data = await request.json()
    frame_b64 = data.get("frame_base64", "")

    if not frame_b64:
        return JSONResponse(status_code=400, content={"error": "No frame data provided"})

    # Optionally crop to lip region first
    lip_bbox = data.get("lip_bounding_box")
    if lip_bbox:
        frame_b64 = lip_reader.crop_lip_region(frame_b64, lip_bbox)

    result = await lip_reader.analyze_single_frame(frame_b64)
    return {
        "detected_text": result.detected_text,
        "confidence": result.confidence,
        "mouth_state": result.mouth_state,
        "phonemes_detected": result.phonemes_detected,
        "analysis_notes": result.analysis_notes,
        "timestamp": result.timestamp,
    }


@app.get("/api/lip-read/history")
async def lip_read_history():
    """Get recent lip reading analysis history."""
    return {"history": lip_reader.get_history(20)}


# ── Gemini Transcription & Translation ──────────────────────────────────────

@app.post("/api/transcribe")
async def transcribe_audio(request: Request):
    """
    Transcribe audio using Gemini.
    Accepts JSON with { audio_base64: string, mime_type?: string }
    """
    if not GEMINI_API_KEY:
        return JSONResponse(status_code=500, content={"error": "GEMINI_API_KEY not configured"})

    data = await request.json()
    audio_b64 = data.get("audio_base64", "")
    mime_type = data.get("mime_type", "audio/webm")

    if not audio_b64:
        return JSONResponse(status_code=400, content={"error": "No audio data provided"})

    # Gemini 1.5 Flash supports audio input; 2.0 may have different endpoint
    model = "gemini-1.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"

    payload = {
        "contents": [
            {
                "parts": [
                    {"inline_data": {"mime_type": mime_type, "data": audio_b64}},
                    {"text": "Transcribe this audio exactly. Return ONLY the transcribed text, nothing else. If the audio is silent or unclear, return an empty string."},
                ]
            }
        ],
        "generationConfig": {"temperature": 0.1, "maxOutputTokens": 1024},
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            body = resp.json() if resp.content else {}
            if not resp.is_success:
                err_msg = body.get("error", {}).get("message", resp.text) or resp.text
                print(f"Gemini transcription API error: {err_msg}")
                return JSONResponse(status_code=resp.status_code, content={"error": err_msg})

        transcript = ""
        if "candidates" in body and body["candidates"]:
            parts = body["candidates"][0].get("content", {}).get("parts", [])
            if parts:
                transcript = (parts[0].get("text") or "").strip()
        return {"transcript": transcript}
    except Exception as e:
        print(f"Gemini transcription error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})


@app.post("/api/translate")
async def translate_text(request: Request):
    """
    Translate text using Gemini.
    Accepts JSON with { text: string, target_language: string }
    """
    if not GEMINI_API_KEY:
        return JSONResponse(status_code=500, content={"error": "GEMINI_API_KEY not configured"})

    data = await request.json()
    text = data.get("text", "")
    target_lang = data.get("target_language", "Spanish")

    if not text:
        return JSONResponse(status_code=400, content={"error": "No text provided"})

    model = "gemini-1.5-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}"

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"Translate the following text to {target_lang}. Return ONLY the translated text, nothing else.\n\nText: {text}"
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1024
        }
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            result = resp.json()

        translation = ""
        if "candidates" in result and result["candidates"]:
            parts = result["candidates"][0].get("content", {}).get("parts", [])
            if parts:
                translation = parts[0].get("text", "").strip()

        return {
            "original": text,
            "translation": translation,
            "target_language": target_lang
        }
    except Exception as e:
        print(f"Gemini translation error: {e}")
        return JSONResponse(status_code=500, content={"error": str(e)})

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    print(f"🚀 Starting HapticPhonix server on 0.0.0.0:{port}")
    print(f"📱 Video endpoint: ws://localhost:{port}/ws/video")
    print(f"👁️  Viewer endpoint: ws://localhost:{port}/ws/viewer")
    print(f"📚 Lessons endpoint: http://localhost:{port}/lessons")
    uvicorn.run(app, host="0.0.0.0", port=port)
