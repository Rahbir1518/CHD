import json
import time
from typing import List, Dict, Optional, Callable
from dataclasses import dataclass
from enum import Enum


class PronunciationQuality(Enum):
    EXCELLENT = "excellent"
    GOOD = "good"
    NEEDS_WORK = "needs_work"
    UNKNOWN = "unknown"


@dataclass
class Phoneme:
    """Represents a phoneme with timing and haptic information."""
    id: str
    type: str  # 'vowel', 'consonant', 'buzz', 'silence'
    start: float  # timestamp in seconds
    duration: float
    haptic_pattern: List[int]
    confidence: float = 1.0
    
    def is_active_at_time(self, current_time: float) -> bool:
        """Check if this phoneme should be active at the given time."""
        return self.start <= current_time < (self.start + self.duration)


@dataclass
class SpeechAnalysisResult:
    """Results from speech analysis."""
    transcript: str
    confidence: float
    detected_phonemes: List[str]
    pronunciation_quality: PronunciationQuality
    suggestions: List[str]
    timestamp: float


class PhonemeEngine:
    """Manages timed phoneme sequences and haptic feedback triggering."""
    
    def __init__(self):
        self.lesson_phonemes: List[Phoneme] = []
        self.current_time_offset: float = 0.0
        self.is_playing: bool = False
        self.last_processed_time: float = 0.0
        self.on_haptic_trigger: Optional[Callable[[Phoneme], None]] = None
        self.on_speech_analysis: Optional[Callable[[SpeechAnalysisResult], None]] = None
    
    def load_lesson(self, lesson_file_path: str) -> bool:
        """Load phoneme sequence from JSON lesson file."""
        try:
            with open(lesson_file_path, 'r') as f:
                lesson_data = json.load(f)
            
            self.lesson_phonemes = []
            phoneme_list = lesson_data.get('phonemes', [])
            
            for phoneme_data in phoneme_list:
                phoneme = Phoneme(
                    id=phoneme_data['id'],
                    type=phoneme_data['type'],
                    start=phoneme_data['start'],
                    duration=phoneme_data['duration'],
                    haptic_pattern=phoneme_data.get('haptic_pattern', [100]),
                    confidence=phoneme_data.get('confidence', 1.0)
                )
                self.lesson_phonemes.append(phoneme)
            
            print(f"Loaded {len(self.lesson_phonemes)} phonemes from {lesson_file_path}")
            return True
        
        except Exception as e:
            print(f"Error loading lesson: {e}")
            return False
    
    def start_playback(self, start_time_offset: float = 0.0):
        """Start phoneme playback from the given time offset."""
        self.current_time_offset = start_time_offset
        self.is_playing = True
        self.last_processed_time = time.time()
        print(f"Phoneme engine started at offset {start_time_offset}s")
    
    def pause_playback(self):
        """Pause phoneme playback."""
        self.is_playing = False
        print("Phoneme engine paused")
    
    def resume_playback(self):
        """Resume phoneme playback."""
        self.is_playing = True
        self.last_processed_time = time.time()
        print("Phoneme engine resumed")
    
    def stop_playback(self):
        """Stop phoneme playback."""
        self.is_playing = False
        self.current_time_offset = 0.0
        print("Phoneme engine stopped")
    
    def update(self, delta_time: float = None):
        """Update engine state and trigger events. Call this regularly."""
        if not self.is_playing:
            return
        
        if delta_time is None:
            current_time = time.time()
            delta_time = current_time - self.last_processed_time
            self.last_processed_time = current_time
        
        # Update current playback time
        self.current_time_offset += delta_time
        
        # Check for phoneme triggers
        current_phonemes = self.get_active_phonemes(self.current_time_offset)
        
        for phoneme in current_phonemes:
            if self.on_haptic_trigger:
                self.on_haptic_trigger(phoneme)
    
    def get_active_phonemes(self, current_time: float) -> List[Phoneme]:
        """Get all phonemes that should be active at the current time."""
        active_phonemes = []
        for phoneme in self.lesson_phonemes:
            if phoneme.is_active_at_time(current_time):
                active_phonemes.append(phoneme)
        return active_phonemes
    
    def get_current_phoneme(self) -> Optional[Phoneme]:
        """Get the primary phoneme at current time (usually the one with highest priority)."""
        active_phonemes = self.get_active_phonemes(self.current_time_offset)
        if not active_phonemes:
            return None
        
        # Priority: consonant > vowel > buzz > silence
        priority_order = ['consonant', 'vowel', 'buzz', 'silence']
        
        for priority_type in priority_order:
            for phoneme in active_phonemes:
                if phoneme.type == priority_type:
                    return phoneme
        
        return active_phonemes[0]  # fallback
    
    def set_haptic_callback(self, callback: Callable[[Phoneme], None]):
        """Set callback function for haptic triggers."""
        self.on_haptic_trigger = callback
    
    def set_speech_analysis_callback(self, callback: Callable[[SpeechAnalysisResult], None]):
        """Set callback function for speech analysis results."""
        self.on_speech_analysis = callback
    
    def process_speech_analysis(self, analysis_result: Dict) -> SpeechAnalysisResult:
        """Process speech analysis result and determine pronunciation quality."""
        transcript = analysis_result.get('transcript', '')
        confidence = analysis_result.get('confidence', 0.0)
        detected_phonemes = analysis_result.get('detected_phonemes', [])
        
        # Determine pronunciation quality based on confidence
        if confidence >= 0.9:
            quality = PronunciationQuality.EXCELLENT
        elif confidence >= 0.7:
            quality = PronunciationQuality.GOOD
        elif confidence >= 0.5:
            quality = PronunciationQuality.NEEDS_WORK
        else:
            quality = PronunciationQuality.UNKNOWN
        
        # Generate suggestions based on quality
        suggestions = []
        if quality == PronunciationQuality.NEEDS_WORK:
            suggestions.append("Try to speak more clearly and at a steady pace")
        elif quality == PronunciationQuality.UNKNOWN:
            suggestions.append("Please speak louder or position microphone closer")
        
        result = SpeechAnalysisResult(
            transcript=transcript,
            confidence=confidence,
            detected_phonemes=detected_phonemes,
            pronunciation_quality=quality,
            suggestions=suggestions,
            timestamp=time.time()
        )
        
        if self.on_speech_analysis:
            self.on_speech_analysis(result)
        
        return result
    
    def get_playback_progress(self) -> Dict:
        """Get current playback progress information."""
        if not self.lesson_phonemes:
            return {'progress': 0, 'current_time': 0, 'total_duration': 0}
        
        total_duration = max(p.start + p.duration for p in self.lesson_phonemes)
        progress = min(1.0, self.current_time_offset / total_duration) if total_duration > 0 else 0
        
        current_phoneme = self.get_current_phoneme()
        
        return {
            'progress': progress,
            'current_time': self.current_time_offset,
            'total_duration': total_duration,
            'is_playing': self.is_playing,
            'current_phoneme': {
                'id': current_phoneme.id if current_phoneme else None,
                'type': current_phoneme.type if current_phoneme else None
            } if current_phoneme else None
        }


# Global phoneme engine instance
phoneme_engine = PhonemeEngine()


# Convenience functions
def load_lesson(lesson_file_path: str) -> bool:
    """Load a lesson into the global phoneme engine."""
    return phoneme_engine.load_lesson(lesson_file_path)

def start_playback(start_time_offset: float = 0.0):
    """Start playback of the currently loaded lesson."""
    phoneme_engine.start_playback(start_time_offset)

def update_phoneme_engine(delta_time: float = None):
    """Update the global phoneme engine."""
    phoneme_engine.update(delta_time)
