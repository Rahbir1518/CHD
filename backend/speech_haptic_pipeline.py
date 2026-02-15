"""
speech_haptic_pipeline.py
Real-time speech-to-haptic notification pipeline.

Captures laptop microphone audio → transcribes via ElevenLabs → chunks into
meaningful segments → broadcasts haptic vibration events to phones via
WebSocket callback.
"""

import os
import io
import wave
import math
import time
import struct
import asyncio
import base64
import threading
import re
from dataclasses import dataclass, field
from typing import Callable, List, Optional, Awaitable

import httpx

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SAMPLE_RATE = 16000
CHANNELS = 1
SAMPLE_WIDTH = 2           # 16-bit
CHUNK_FRAMES = 1600        # 100 ms per PyAudio read
RECORD_SECONDS = 1.2       # How much audio to buffer before sending to ElevenLabs
SILENCE_RMS_THRESHOLD = 0.01  # Below this → considered silence

# Phrase-splitting heuristics
SPLIT_WORDS = {
    "and", "but", "or", "so", "because", "then", "when", "while", "if",
    "although", "that", "which", "where", "after", "before", "since",
    "for", "with", "from", "into", "about", "like", "just",
}
MAX_PHRASE_WORDS = 8
MIN_PHRASE_WORDS = 2

# Haptic intensity tiers
HAPTIC_PATTERNS = {
    "silence": [],
    "low":    [30, 50, 30],
    "medium": [60, 40, 60],
    "high":   [80, 20, 80, 20, 80],
    "burst":  [100, 15, 100, 15, 100, 15, 100],
}


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------
@dataclass
class AudioChunk:
    """A captured audio segment."""
    pcm_data: bytes
    rms: float                 # 0.0 – 1.0 normalized
    timestamp: float = 0.0
    wav_base64: str = ""       # Populated after encoding

@dataclass
class HapticEvent:
    """A single haptic pulse to be sent to the phone."""
    transcript_chunk: str
    pattern: List[int]
    intensity: str             # "silence" | "low" | "medium" | "high" | "burst"
    rms: float
    timestamp: float
    chunk_index: int = 0

@dataclass
class PipelineStatus:
    running: bool = False
    total_chunks_sent: int = 0
    latest_transcript: str = ""
    latest_rms: float = 0.0
    started_at: Optional[float] = None


# ---------------------------------------------------------------------------
# AudioCapture — threaded mic reader
# ---------------------------------------------------------------------------
class AudioCapture:
    """Continuously captures audio from the default microphone in a thread."""

    def __init__(self):
        self._stream = None
        self._pa = None
        self._thread: Optional[threading.Thread] = None
        self._running = False
        self._buffer: bytes = b""
        self._lock = threading.Lock()
        self._chunks: List[AudioChunk] = []

    # -- public API ----------------------------------------------------------

    def start(self):
        if self._running:
            return
        import pyaudio
        self._pa = pyaudio.PyAudio()
        self._stream = self._pa.open(
            format=pyaudio.paInt16,
            channels=CHANNELS,
            rate=SAMPLE_RATE,
            input=True,
            frames_per_buffer=CHUNK_FRAMES,
        )
        self._running = True
        self._thread = threading.Thread(target=self._capture_loop, daemon=True)
        self._thread.start()
        print("[MIC] Microphone capture started")

    def stop(self):
        self._running = False
        if self._thread:
            self._thread.join(timeout=2)
        if self._stream:
            self._stream.stop_stream()
            self._stream.close()
        if self._pa:
            self._pa.terminate()
        self._stream = None
        self._pa = None
        self._thread = None
        print("[MIC] Microphone capture stopped")

    def pop_chunk(self) -> Optional[AudioChunk]:
        """Non-blocking: return the oldest buffered chunk, or None."""
        with self._lock:
            if self._chunks:
                return self._chunks.pop(0)
        return None

    # -- internals -----------------------------------------------------------

    def _capture_loop(self):
        frames_per_chunk = int(SAMPLE_RATE * RECORD_SECONDS)
        buf = b""
        while self._running:
            try:
                data = self._stream.read(CHUNK_FRAMES, exception_on_overflow=False)
                buf += data
                if len(buf) >= frames_per_chunk * SAMPLE_WIDTH:
                    raw = buf[:frames_per_chunk * SAMPLE_WIDTH]
                    buf = buf[frames_per_chunk * SAMPLE_WIDTH:]
                    rms = self._calc_rms(raw)
                    chunk = AudioChunk(
                        pcm_data=raw,
                        rms=rms,
                        timestamp=time.time(),
                    )
                    chunk.wav_base64 = self._encode_wav(raw)
                    with self._lock:
                        # Keep at most 5 queued chunks (drop old if consumer is slow)
                        if len(self._chunks) >= 5:
                            self._chunks.pop(0)
                        self._chunks.append(chunk)
            except Exception as e:
                if self._running:
                    print(f"Mic read error: {e}")
                    time.sleep(0.1)

    @staticmethod
    def _calc_rms(pcm: bytes) -> float:
        n = len(pcm) // 2
        if n == 0:
            return 0.0
        samples = struct.unpack(f"<{n}h", pcm)
        sum_sq = sum(s * s for s in samples)
        rms_raw = math.sqrt(sum_sq / n)
        # Normalize to 0–1 (16-bit max = 32767)
        return min(rms_raw / 32767.0, 1.0)

    @staticmethod
    def _encode_wav(pcm: bytes) -> str:
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(CHANNELS)
            wf.setsampwidth(SAMPLE_WIDTH)
            wf.setframerate(SAMPLE_RATE)
            wf.writeframes(pcm)
        return base64.b64encode(buf.getvalue()).decode()


# ---------------------------------------------------------------------------
# ElevenLabsTranscriber — async speech-to-text
# ---------------------------------------------------------------------------
class ElevenLabsTranscriber:
    """Sends audio chunks to ElevenLabs Speech-to-Text for transcription."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.url = "https://api.elevenlabs.io/v1/speech-to-text"
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=15.0)
        return self._client

    async def transcribe(self, wav_base64: str) -> str:
        """Transcribe a WAV audio chunk. Returns transcript text or ''."""
        if not self.api_key:
            print("ElevenLabs STT: No API key")
            return ""
        audio_bytes = base64.b64decode(wav_base64)
        headers = {"xi-api-key": self.api_key}
        files = {"file": ("audio.wav", audio_bytes)}
        data_form = {"model_id": "scribe_v2"}

        try:
            client = await self._get_client()
            resp = await client.post(self.url, headers=headers, files=files, data=data_form)
            body = resp.json() if resp.content else {}
            if not resp.is_success:
                err = body.get("detail", {}).get("message", body.get("message", resp.text))
                print(f"ElevenLabs STT error: {err}")
                return ""
            return (body.get("text") or "").strip()
        except Exception as e:
            print(f"ElevenLabs STT exception: {e}")
        return ""

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()


# ---------------------------------------------------------------------------
# SpeechHapticPipeline — orchestrator
# ---------------------------------------------------------------------------
class SpeechHapticPipeline:
    """
    Captures mic → ElevenLabs STT → phrase chunks → haptic events.
    Call `set_broadcast_callback` to wire up the WebSocket broadcast.
    """

    def __init__(self, api_key: str):
        self.audio = AudioCapture()
        self.transcriber = ElevenLabsTranscriber(api_key)
        self.status = PipelineStatus()
        self._task: Optional[asyncio.Task] = None
        self._broadcast_cb: Optional[Callable[[dict], Awaitable[None]]] = None
        self._last_push_time: float = 0
        self._chunk_index: int = 0
        self._full_transcript: str = ""

    def set_broadcast_callback(self, cb: Callable[[dict], Awaitable[None]]):
        """Set the async callback invoked for each haptic event."""
        self._broadcast_cb = cb

    # -- control -------------------------------------------------------------

    def start(self):
        if self.status.running:
            return
        self.audio.start()
        self.status = PipelineStatus(running=True, started_at=time.time())
        self._chunk_index = 0
        self._full_transcript = ""
        self._last_push_time = time.time()
        self._task = asyncio.create_task(self._run_loop())
        print("[PIPELINE] Speech-haptic pipeline started")

    async def stop(self):
        self.status.running = False
        self.audio.stop()
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        await self.transcriber.close()
        print("[PIPELINE] Speech-haptic pipeline stopped")

    def get_status(self) -> dict:
        return {
            "running": self.status.running,
            "total_chunks_sent": self.status.total_chunks_sent,
            "latest_transcript": self.status.latest_transcript,
            "latest_rms": round(self.status.latest_rms, 4),
            "uptime_seconds": round(time.time() - self.status.started_at, 1)
                if self.status.started_at else 0,
        }

    # -- main loop -----------------------------------------------------------

    async def _run_loop(self):
        while self.status.running:
            chunk = self.audio.pop_chunk()
            if chunk is None:
                await asyncio.sleep(0.05)
                continue

            self.status.latest_rms = chunk.rms

            # Always broadcast RMS energy for real-time intensity viz
            if self._broadcast_cb:
                await self._broadcast_cb({
                    "type": "speech_haptic_energy",
                    "rms": round(chunk.rms, 4),
                    "timestamp": chunk.timestamp,
                })

            # Skip ElevenLabs if silence
            if chunk.rms < SILENCE_RMS_THRESHOLD:
                continue

            # [TESTING] Instant "Volumetric" Feedback
            # Triggers vibration immediately on speech detection (bypassing STT latency)
            if chunk.rms > 0.04:  # Threshold for "speaking" volume
                intensity = self._rms_to_intensity(chunk.rms)
                pattern = HAPTIC_PATTERNS.get(intensity, [30])
                
                print(f"[HAPTIC-FAST] [{intensity}] Volumetric trigger -> {pattern}")
                
                if self._broadcast_cb:
                    await self._broadcast_cb({
                        "type": "speech_haptic",
                        "transcript_chunk": "",  # No text yet
                        "pattern": pattern,
                        "intensity": intensity,
                        "rms": round(chunk.rms, 4),
                        "timestamp": time.time(),
                        "chunk_index": -1,  # Special index for fast pulses
                    })

            # Transcribe
            transcript = await self.transcriber.transcribe(chunk.wav_base64)
            if not transcript:
                continue

            self._full_transcript += " " + transcript
            self.status.latest_transcript = transcript.strip()

            # Chunk into phrases and dispatch
            phrases = self._split_phrases(transcript)
            for phrase in phrases:
                # Enforce cadence: wait at least 0.5s between pushes
                elapsed = time.time() - self._last_push_time
                if elapsed < 0.5:
                    await asyncio.sleep(0.5 - elapsed)

                intensity = self._rms_to_intensity(chunk.rms)
                pattern = HAPTIC_PATTERNS.get(intensity, HAPTIC_PATTERNS["medium"])

                event = HapticEvent(
                    transcript_chunk=phrase,
                    pattern=pattern,
                    intensity=intensity,
                    rms=chunk.rms,
                    timestamp=time.time(),
                    chunk_index=self._chunk_index,
                )
                self._chunk_index += 1
                self.status.total_chunks_sent += 1
                self._last_push_time = time.time()

                print(f"[HAPTIC] [{intensity}] \"{phrase}\" -> {pattern}")

                if self._broadcast_cb:
                    await self._broadcast_cb({
                        "type": "speech_haptic",
                        "transcript_chunk": event.transcript_chunk,
                        "pattern": event.pattern,
                        "intensity": event.intensity,
                        "rms": round(event.rms, 4),
                        "timestamp": event.timestamp,
                        "chunk_index": event.chunk_index,
                        "full_transcript": self._full_transcript.strip(),
                    })

    # -- intelligent chunking -----------------------------------------------

    @staticmethod
    def _split_phrases(text: str) -> List[str]:
        """Split transcript into natural phrase segments of 2–8 words."""
        # First split on punctuation
        raw_segments = re.split(r'[.!?,;:\-–—]+', text)
        phrases: List[str] = []

        for segment in raw_segments:
            words = segment.split()
            if not words:
                continue
            if len(words) <= MAX_PHRASE_WORDS:
                phrases.append(" ".join(words))
                continue

            # Split on conjunctions / prepositions
            current: List[str] = []
            for word in words:
                current.append(word)
                if (
                    word.lower() in SPLIT_WORDS
                    and len(current) >= MIN_PHRASE_WORDS
                ):
                    phrases.append(" ".join(current))
                    current = []
                elif len(current) >= MAX_PHRASE_WORDS:
                    phrases.append(" ".join(current))
                    current = []
            if current:
                phrases.append(" ".join(current))

        # Filter out empty / whitespace-only
        return [p.strip() for p in phrases if p.strip()]

    # -- intensity mapping ---------------------------------------------------

    @staticmethod
    def _rms_to_intensity(rms: float) -> str:
        """Map RMS energy (0–1) to a haptic intensity tier."""
        if rms < SILENCE_RMS_THRESHOLD:
            return "silence"
        if rms < 0.04:
            return "low"
        if rms < 0.10:
            return "medium"
        if rms < 0.20:
            return "high"
        return "burst"
