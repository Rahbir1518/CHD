"""
Lip Reading Engine — uses Gemini Vision API to analyze lip movements
and infer spoken content from video frames.
"""

import os
import time
import base64
import asyncio
import httpx
import cv2
import numpy as np
from typing import List, Dict, Optional
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local"))


@dataclass
class LipReadingResult:
    """Result from a Gemini lip reading analysis."""
    detected_text: str = ""
    confidence: float = 0.0
    mouth_state: str = "unknown"  # closed | open | talking
    phonemes_detected: List[str] = field(default_factory=list)
    analysis_notes: str = ""
    timestamp: float = 0.0


class LipReadingEngine:
    """
    Buffers lip-region frames and periodically sends them to Gemini Vision
    for lip-reading analysis.
    """

    GEMINI_MODEL = "gemini-2.0-flash"
    ANALYSIS_COOLDOWN = 3.0     # seconds between Gemini calls
    MAX_BUFFER_FRAMES = 6       # frames to accumulate before analysis
    MIN_BUFFER_FRAMES = 3       # minimum frames needed to trigger

    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY", "")
        self.frame_buffer: List[str] = []       # base64 JPEG strings
        self.last_analysis_time: float = 0.0
        self.latest_result: Optional[LipReadingResult] = None
        self.is_analyzing: bool = False
        self._analysis_history: List[LipReadingResult] = []
        self._lock = asyncio.Lock()

        # Movement tracking state
        self._prev_openness: float = 0.0
        self._openness_history: List[float] = []
        self._mouth_state: str = "closed"
        self._talking_frames: int = 0

        if not self.api_key:
            print("⚠️  GEMINI_API_KEY not set — lip reading will be disabled")

    # ── Movement tracking ────────────────────────────────────────────────

    def update_mouth_state(self, openness: float) -> Dict:
        """
        Track mouth movement to determine state.
        Returns dict with mouth_state, openness, velocity.
        """
        self._openness_history.append(openness)
        if len(self._openness_history) > 10:
            self._openness_history.pop(0)

        velocity = openness - self._prev_openness
        self._prev_openness = openness

        # Determine state based on openness and velocity
        if openness < 0.01:
            state = "closed"
            self._talking_frames = 0
        elif abs(velocity) > 0.003:
            # Significant movement → talking
            self._talking_frames += 1
            state = "talking" if self._talking_frames > 2 else "open"
        elif openness > 0.02:
            state = "open"
            self._talking_frames = max(0, self._talking_frames - 1)
        else:
            state = "closed"
            self._talking_frames = 0

        self._mouth_state = state

        return {
            "mouth_state": state,
            "openness": round(openness, 4),
            "velocity": round(velocity, 5),
        }

    # ── Frame buffering ──────────────────────────────────────────────────

    def add_frame(self, frame_base64: str):
        """Add a lip-region frame to the buffer."""
        self.frame_buffer.append(frame_base64)
        if len(self.frame_buffer) > self.MAX_BUFFER_FRAMES:
            self.frame_buffer.pop(0)

    def should_analyze(self) -> bool:
        """Check if we have enough frames and cooldown has passed."""
        now = time.time()
        return (
            bool(self.api_key)
            and not self.is_analyzing
            and len(self.frame_buffer) >= self.MIN_BUFFER_FRAMES
            and (now - self.last_analysis_time) >= self.ANALYSIS_COOLDOWN
            and self._mouth_state in ("talking", "open")
        )

    def crop_lip_region(self, frame_base64: str, lip_bbox: Dict) -> str:
        """Crop the lip region from a full frame using the bounding box."""
        try:
            # Decode
            s = frame_base64.strip()
            if s.startswith("data:image"):
                if "," in s:
                    s = s.split(",", 1)[1]
            raw = base64.b64decode(s)
            arr = np.frombuffer(raw, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)

            if frame is None:
                return frame_base64

            h, w = frame.shape[:2]
            x1 = max(0, int(lip_bbox["x"] * w) - 20)
            y1 = max(0, int(lip_bbox["y"] * h) - 20)
            x2 = min(w, int((lip_bbox["x"] + lip_bbox["width"]) * w) + 20)
            y2 = min(h, int((lip_bbox["y"] + lip_bbox["height"]) * h) + 20)

            cropped = frame[y1:y2, x1:x2]
            if cropped.size == 0:
                return frame_base64

            _, buf = cv2.imencode(".jpg", cropped, [cv2.IMWRITE_JPEG_QUALITY, 90])
            return base64.b64encode(buf).decode("utf-8")
        except Exception as e:
            print(f"Lip crop error: {e}")
            return frame_base64

    # ── Gemini analysis ──────────────────────────────────────────────────

    async def analyze_frames(self, frames: Optional[List[str]] = None) -> LipReadingResult:
        """
        Send buffered frames to Gemini Vision for lip reading analysis.
        """
        if not self.api_key:
            return LipReadingResult(analysis_notes="No API key configured")

        async with self._lock:
            self.is_analyzing = True
            analysis_frames = frames or list(self.frame_buffer)
            self.frame_buffer.clear()

        try:
            url = (
                f"https://generativelanguage.googleapis.com/v1beta/models/"
                f"{self.GEMINI_MODEL}:generateContent?key={self.api_key}"
            )

            # Build multipart content: multiple lip-region images + prompt
            parts = []
            for i, frame_b64 in enumerate(analysis_frames[:self.MAX_BUFFER_FRAMES]):
                parts.append({
                    "inline_data": {
                        "mime_type": "image/jpeg",
                        "data": frame_b64,
                    }
                })

            parts.append({
                "text": (
                    "You are a lip reading AI. Analyze these sequential frames of a person's lip/mouth region. "
                    "The frames are taken ~100ms apart during speech.\n\n"
                    "Based on the lip movements visible across these frames, determine:\n"
                    "1. What word or phrase the person appears to be saying\n"
                    "2. Your confidence level (0.0 to 1.0)\n"
                    "3. The current mouth state (closed, open, or talking)\n"
                    "4. Any phonemes you can detect from the lip shapes\n"
                    "5. Brief analysis notes about the lip movement pattern\n\n"
                    "Respond in this exact JSON format only:\n"
                    '{"detected_text": "...", "confidence": 0.X, "mouth_state": "talking", '
                    '"phonemes_detected": ["..."], "analysis_notes": "..."}\n\n'
                    "If the lips are not clearly visible or not moving, return:\n"
                    '{"detected_text": "", "confidence": 0.0, "mouth_state": "closed", '
                    '"phonemes_detected": [], "analysis_notes": "No clear lip movement detected"}'
                )
            })

            payload = {
                "contents": [{"parts": parts}],
                "generationConfig": {
                    "temperature": 0.2,
                    "maxOutputTokens": 512,
                },
            }

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=payload)
                body = resp.json() if resp.content else {}

                if not resp.is_success:
                    err = body.get("error", {}).get("message", resp.text)
                    print(f"Gemini lip reading error: {err}")
                    return LipReadingResult(
                        analysis_notes=f"API error: {err}",
                        timestamp=time.time(),
                    )

            # Parse response
            result = LipReadingResult(timestamp=time.time())
            if "candidates" in body and body["candidates"]:
                raw_text = (
                    body["candidates"][0]
                    .get("content", {})
                    .get("parts", [{}])[0]
                    .get("text", "")
                    .strip()
                )

                # Parse JSON from response
                import json
                try:
                    # Strip markdown code fences if present
                    clean = raw_text
                    if clean.startswith("```"):
                        clean = clean.split("\n", 1)[-1]
                    if clean.endswith("```"):
                        clean = clean.rsplit("```", 1)[0]
                    clean = clean.strip()

                    data = json.loads(clean)
                    result.detected_text = data.get("detected_text", "")
                    result.confidence = float(data.get("confidence", 0.0))
                    result.mouth_state = data.get("mouth_state", "unknown")
                    result.phonemes_detected = data.get("phonemes_detected", [])
                    result.analysis_notes = data.get("analysis_notes", "")
                except json.JSONDecodeError:
                    result.detected_text = raw_text[:200]
                    result.analysis_notes = "Raw response (JSON parse failed)"

            self.latest_result = result
            self._analysis_history.append(result)
            if len(self._analysis_history) > 50:
                self._analysis_history.pop(0)

            return result

        except Exception as e:
            print(f"Lip reading analysis error: {e}")
            return LipReadingResult(
                analysis_notes=f"Error: {str(e)}",
                timestamp=time.time(),
            )
        finally:
            self.is_analyzing = False
            self.last_analysis_time = time.time()

    async def analyze_single_frame(self, frame_base64: str) -> LipReadingResult:
        """Analyze a single frame for on-demand lip reading."""
        return await self.analyze_frames([frame_base64])

    def get_history(self, count: int = 10) -> List[Dict]:
        """Get recent analysis history."""
        return [
            {
                "detected_text": r.detected_text,
                "confidence": r.confidence,
                "mouth_state": r.mouth_state,
                "phonemes_detected": r.phonemes_detected,
                "analysis_notes": r.analysis_notes,
                "timestamp": r.timestamp,
            }
            for r in self._analysis_history[-count:]
        ]


# Global instance
lip_reader = LipReadingEngine()
