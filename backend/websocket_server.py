import os
import json
import time
from typing import List, Dict, Any, Optional
from fastapi import WebSocket, WebSocketDisconnect


class ConnectionManager:
    """Manages WebSocket connections from phones (camera sources)."""
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.connection_metadata: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, metadata: Optional[Dict] = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        if metadata:
            self.connection_metadata[websocket] = metadata
        print(f"📱 Phone connected. Total source connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            self.connection_metadata.pop(websocket, None)
        print(f"📱 Phone disconnected. Total source connections: {len(self.active_connections)}")
    
    def get_metadata(self, websocket: WebSocket) -> Optional[Dict]:
        return self.connection_metadata.get(websocket)


class ViewerManager:
    """Manages WebSocket connections from dashboards (viewers)."""
    def __init__(self):
        self.viewers: List[WebSocket] = []
        self.viewer_metadata: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(self, websocket: WebSocket, metadata: Optional[Dict] = None):
        await websocket.accept()
        self.viewers.append(websocket)
        if metadata:
            self.viewer_metadata[websocket] = metadata
        print(f"👁️  Dashboard viewer connected. Total viewers: {len(self.viewers)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.viewers:
            self.viewers.remove(websocket)
            self.viewer_metadata.pop(websocket, None)
        print(f"👁️  Dashboard viewer disconnected. Total viewers: {len(self.viewers)}")
    
    def get_metadata(self, websocket: WebSocket) -> Optional[Dict]:
        return self.viewer_metadata.get(websocket)

    async def broadcast(self, data: dict):
        """Send data to all connected viewers."""
        if not self.viewers:
            return
            
        disconnected = []
        for viewer in self.viewers:
            try:
                await viewer.send_json(data)
            except Exception as e:
                print(f"Error broadcasting to viewer: {e}")
                disconnected.append(viewer)
        
        for v in disconnected:
            self.disconnect(v)
    
    async def send_to_viewer(self, websocket: WebSocket, data: dict):
        """Send data to a specific viewer."""
        try:
            await websocket.send_json(data)
        except Exception as e:
            print(f"Error sending to viewer: {e}")
            self.disconnect(websocket)


class HapticEventManager:
    """Manages haptic feedback events and patterns."""
    def __init__(self):
        self.haptic_patterns = {
            'vowel': [100, 50, 100],      # Short buzz pattern
            'consonant': [200, 100, 200], # Longer buzz pattern
            'buzz': [50, 25, 50, 25, 50], # Rapid buzz pattern
            'silence': []                 # No vibration
        }
    
    def get_pattern(self, phoneme_type: str) -> List[int]:
        """Get haptic pattern for a phoneme type."""
        return self.haptic_patterns.get(phoneme_type, [100])
    
    async def trigger_haptic(
        self,
        viewer_manager: ViewerManager,
        phoneme_type: str,
        confidence: float = 1.0,
        connection_manager: Optional["ConnectionManager"] = None,
    ):
        """Trigger haptic feedback to dashboard viewers and to phones (camera sources)."""
        pattern = self.get_pattern(phoneme_type)
        
        # Scale pattern based on confidence
        if confidence < 0.7:
            pattern = [int(p * 0.5) for p in pattern]
        
        haptic_event = {
            "type": "haptic_feedback",
            "pattern": pattern,
            "phoneme_type": phoneme_type,
            "confidence": confidence,
            "timestamp": time.time(),
        }
        
        await viewer_manager.broadcast(haptic_event)
        # Also send to phones so they can vibrate (Phase 1: "Haptic Remote")
        if connection_manager and connection_manager.active_connections:
            disconnected = []
            for ws in connection_manager.active_connections:
                try:
                    await ws.send_json(haptic_event)
                except Exception as e:
                    print(f"Error sending haptic to phone: {e}")
                    disconnected.append(ws)
            for ws in disconnected:
                connection_manager.disconnect(ws)


class SpeechAnalysisManager:
    """Manages speech analysis and transcription results."""
    def __init__(self):
        self.current_transcript = ""
        self.phoneme_sequence = []
        self.analysis_history = []
    
    async def process_speech_analysis(self, viewer_manager: ViewerManager, analysis_result: Dict):
        """Process and broadcast speech analysis results."""
        # Store analysis
        self.analysis_history.append(analysis_result)
        if len(self.analysis_history) > 100:  # Keep last 100 analyses
            self.analysis_history.pop(0)
        
        # Broadcast to viewers
        analysis_event = {
            'type': 'speech_analysis',
            'transcript': analysis_result.get('transcript', ''),
            'confidence': analysis_result.get('confidence', 0.0),
            'detected_phonemes': analysis_result.get('detected_phonemes', []),
            'pronunciation_quality': analysis_result.get('pronunciation_quality', 'unknown'),
            'suggestions': analysis_result.get('suggestions', [])
        }
        
        await viewer_manager.broadcast(analysis_event)
    
    def get_current_transcript(self) -> str:
        return self.current_transcript
    
    def update_transcript(self, new_text: str):
        self.current_transcript = new_text


# Global instances
manager = ConnectionManager()
viewer_manager = ViewerManager()
haptic_manager = HapticEventManager()
speech_manager = SpeechAnalysisManager()
