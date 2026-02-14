"""
Snowflake AI Coach - Simple version
"""

import os
from typing import Dict, List
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local"))

try:
    import snowflake.connector
    CONNECTOR_AVAILABLE = True
except ImportError:
    CONNECTOR_AVAILABLE = False


@dataclass
class CoachingFeedback:
    feedback_text: str
    focus_areas: List[str]
    encouragement: str
    next_steps: List[str]
    model_used: str


class SnowflakeCoach:
    def __init__(self):
        self.account = os.getenv("SNOWFLAKE_ACCOUNT", "")
        self.user = os.getenv("SNOWFLAKE_USER", "")
        self.password = os.getenv("SNOWFLAKE_PASSWORD", "")
        self.database = os.getenv("SNOWFLAKE_DATABASE", "SNOWFLAKE")
        self.warehouse = os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH")
        self.schema = os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC")
        self.mock_mode = os.getenv("SNOWFLAKE_MOCK_MODE", "false").lower() == "true"
        
        self.enabled = CONNECTOR_AVAILABLE and self.account and self.user and self.password
        
        if self.mock_mode:
            print("🎭 Snowflake MOCK MODE enabled")
        elif not self.enabled:
            print("⚠️  Snowflake not configured")
            print("   Set SNOWFLAKE_ACCOUNT, SNOWFLAKE_USER, SNOWFLAKE_PASSWORD")
            print("   Or set SNOWFLAKE_MOCK_MODE=true for demo")
        else:
            print(f"✅ Snowflake enabled: {self.account}")
    
    async def generate_coaching_feedback(
        self, 
        phonemes_practiced: List[str],
        accuracy_scores: Dict[str, float],
        struggles: List[str],
        session_duration: int = None,
        model: str = "mistral-large"
    ) -> CoachingFeedback:
        
        if self.mock_mode:
            return self._generate_mock(phonemes_practiced, accuracy_scores, struggles)
        
        if not self.enabled:
            return self._fallback()
        
        # Build prompt
        avg = sum(accuracy_scores.values()) / len(accuracy_scores) if accuracy_scores else 0
        prompt = f"""You are a speech therapist coaching a deaf student.

Session: {len(phonemes_practiced)} phonemes, {avg*100:.0f}% avg accuracy
Struggles: {', '.join(struggles) if struggles else 'None'}

Provide warm feedback in 3 parts:
CELEBRATE: One encouraging sentence
FOCUS: 2 specific things to work on
NEXT: One action for next practice

Be concise and motivating."""

        try:
            conn = snowflake.connector.connect(
                account=self.account,
                user=self.user,
                password=self.password,
                warehouse=self.warehouse,
                database=self.database,
                schema=self.schema
            )
            
            cursor = conn.cursor()
            safe_prompt = prompt.replace("'", "''")
            
            sql = f"SELECT SNOWFLAKE.CORTEX.COMPLETE('{model}', '{safe_prompt}') as response"
            cursor.execute(sql)
            result = cursor.fetchone()
            conn.close()
            
            return self._parse(result[0] if result else "", model)
            
        except Exception as e:
            print(f"Snowflake error: {e}")
            return self._fallback()
    
    async def get_quick_tip(self, phoneme: str) -> str:
        if self.mock_mode:
            tips = {
                "AH": "Deep, steady throat vibration - like at the doctor's",
                "EE": "Higher, faster vibration - lips back, tight throat",
                "S": "No vibration! Air-only - feel it on your hand"
            }
            return tips.get(phoneme.upper(), f"Practice {phoneme} vibration")
        
        return f"Focus on consistent vibration for {phoneme}"
    
    def _parse(self, text: str, model: str) -> CoachingFeedback:
        lines = text.strip().split('\n')
        celebrate = ""
        focus = []
        next_step = ""
        
        for line in lines:
            if "CELEBRATE:" in line:
                celebrate = line.split("CELEBRATE:")[1].strip()
            elif "NEXT:" in line:
                next_step = line.split("NEXT:")[1].strip()
            elif line.startswith("-") or line.startswith("•"):
                focus.append(line.lstrip("-• ").strip())
        
        return CoachingFeedback(
            feedback_text=text,
            focus_areas=focus,
            encouragement=celebrate or "Great work!",
            next_steps=[next_step] if next_step else [],
            model_used=model
        )
    
    def _generate_mock(self, phonemes: List[str], scores: Dict[str, float], struggles: List[str]) -> CoachingFeedback:
        avg = sum(scores.values()) / len(scores) if scores else 0.5
        best = max(scores.items(), key=lambda x: x[1])[0] if scores else "vowels"
        worst = min(scores.items(), key=lambda x: x[1])[0] if scores else "consonants"
        
        return CoachingFeedback(
            feedback_text=f"CELEBRATE: Excellent {best} sounds!\nFOCUS:\n- Practice {worst} more\n- Keep steady vibration\nNEXT: 5 min on {worst}",
            focus_areas=[f"Practice {worst} with breath support", "Steady vibration patterns"],
            encouragement=f"Excellent work on {best}!",
            next_steps=[f"Focus on {worst} for 5 minutes tomorrow"],
            model_used="mock-mistral"
        )
    
    def _fallback(self) -> CoachingFeedback:
        return CoachingFeedback(
            feedback_text="Keep practicing!",
            focus_areas=["Regular practice", "Focus on vibration"],
            encouragement="You're improving!",
            next_steps=["Practice daily"],
            model_used="fallback"
        )


snowflake_coach = SnowflakeCoach()
