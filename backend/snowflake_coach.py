"""
Snowflake AI Coach — HapticPhonix
Provides personalized coaching via Snowflake Cortex multi-model LLMs.
Supports: Python Connector, REST API fallback, and mock mode for demos.
"""

import os
import json
import time
from typing import Dict, List, Optional
from dataclasses import dataclass, field, asdict
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env.local"))

try:
    import snowflake.connector
    CONNECTOR_AVAILABLE = True
except ImportError:
    CONNECTOR_AVAILABLE = False

try:
    import httpx
    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False


@dataclass
class CoachingFeedback:
    feedback_text: str
    focus_areas: List[str]
    encouragement: str
    next_steps: List[str]
    model_used: str
    provider: str = "snowflake-cortex"

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SessionSummary:
    """Captures a practice session for trend analysis."""
    phonemes: List[str]
    scores: Dict[str, float]
    struggles: List[str]
    duration: int
    timestamp: float = field(default_factory=time.time)
    avg_accuracy: float = 0.0

    def __post_init__(self):
        if self.scores:
            self.avg_accuracy = sum(self.scores.values()) / len(self.scores)


# ── Phoneme knowledge base for rich mock tips ────────────────────────────
PHONEME_TIPS: Dict[str, dict] = {
    "AH": {
        "tip": "Place your hand on your throat — feel a deep, steady vibration like saying 'ahhh' at the doctor's.",
        "placement": "Open mouth wide, tongue low and flat",
        "common_error": "Mouth not open enough; vibration too weak",
    },
    "EE": {
        "tip": "Lips pulled back, tongue high and forward — feel a higher, faster vibration than AH.",
        "placement": "Smile shape, tongue tip behind lower teeth",
        "common_error": "Jaw too open, creating 'ih' instead",
    },
    "OO": {
        "tip": "Round your lips into a small circle — feel a deep, rounded vibration.",
        "placement": "Lips rounded and pushed forward, tongue pulled back",
        "common_error": "Lips not rounded enough",
    },
    "S": {
        "tip": "No throat vibration! Push air through a narrow gap — feel cool air on your hand.",
        "placement": "Tongue behind upper teeth, teeth nearly closed",
        "common_error": "Adding voicing (turning S into Z)",
    },
    "SH": {
        "tip": "Wider tongue channel than S — feel warm spread air. No vibration.",
        "placement": "Lips slightly rounded, tongue pulled back from S position",
        "common_error": "Too narrow, sounds like S",
    },
    "TH": {
        "tip": "Tongue tip between your teeth — feel air flowing over tongue tip.",
        "placement": "Tongue visible between upper and lower teeth",
        "common_error": "Tongue not far enough forward",
    },
    "M": {
        "tip": "Lips together, hum — feel strong vibration on your lips and nose.",
        "placement": "Lips sealed, air flows through nose",
        "common_error": "Lips not fully closed",
    },
    "N": {
        "tip": "Tongue tip touches the ridge behind upper teeth — feel vibration in your nose.",
        "placement": "Tongue tip on alveolar ridge",
        "common_error": "Tongue too far back (sounds like NG)",
    },
    "B": {
        "tip": "Like M but release a burst of air — feel a pop of vibration on your lips.",
        "placement": "Lips together then release",
        "common_error": "Not enough air pressure buildup",
    },
    "P": {
        "tip": "Same lip position as B but NO throat vibration — feel a puff of air on your hand.",
        "placement": "Lips together then release without voicing",
        "common_error": "Adding voicing (turning P into B)",
    },
    "F": {
        "tip": "Upper teeth on lower lip — feel air flowing over your lip. No vibration.",
        "placement": "Light contact between teeth and lip",
        "common_error": "Biting lip too hard, blocking airflow",
    },
    "V": {
        "tip": "Same as F but with throat vibration — feel buzzing where teeth touch lip.",
        "placement": "Light contact, teeth on lower lip, voice on",
        "common_error": "No voicing (sounds like F)",
    },
    "R": {
        "tip": "Tongue curls back slightly, doesn't touch anything — feel vibration shift.",
        "placement": "Tongue bunched or retroflex, lips slightly rounded",
        "common_error": "Tongue touching the roof of the mouth",
    },
    "L": {
        "tip": "Tongue tip touches ridge behind teeth, air flows around sides.",
        "placement": "Tongue tip on alveolar ridge, sides lowered",
        "common_error": "Using back of tongue instead of tip",
    },
}


class SnowflakeCoach:
    """
    AI coaching engine powered by Snowflake Cortex.
    
    Modes:
      1. Python Connector — executes SNOWFLAKE.CORTEX.COMPLETE() via SQL
      2. REST API — calls Snowflake REST endpoint with JWT
      3. Mock — realistic responses without any credentials
    """

    AVAILABLE_MODELS = {
        "mistral-large": "Detailed coaching analysis",
        "llama3-70b": "Educational explanations",
        "mixtral-8x7b": "Fast tips and quick feedback",
    }

    def __init__(self):
        self.account = os.getenv("SNOWFLAKE_ACCOUNT", "")
        self.user = os.getenv("SNOWFLAKE_USER", "")
        self.password = os.getenv("SNOWFLAKE_PASSWORD", "")
        self.api_key = os.getenv("SNOWFLAKE_API_KEY", "")
        self.database = os.getenv("SNOWFLAKE_DATABASE", "SNOWFLAKE")
        self.warehouse = os.getenv("SNOWFLAKE_WAREHOUSE", "COMPUTE_WH")
        self.schema = os.getenv("SNOWFLAKE_SCHEMA", "PUBLIC")
        self.mock_mode = os.getenv("SNOWFLAKE_MOCK_MODE", "false").lower() == "true"

        # Connection mode resolution
        self.connector_enabled = (
            CONNECTOR_AVAILABLE and bool(self.account) and bool(self.user) and bool(self.password)
        )
        self.rest_enabled = bool(self.account) and bool(self.api_key) and HTTPX_AVAILABLE
        self.enabled = self.connector_enabled or self.rest_enabled

        # Session history for trend analysis
        self.session_history: List[SessionSummary] = []

        if self.mock_mode:
            print("🎭 Snowflake Coach: MOCK MODE — realistic responses, no credentials needed")
        elif self.connector_enabled:
            print(f"✅ Snowflake Coach: Python Connector → {self.account}")
        elif self.rest_enabled:
            print(f"✅ Snowflake Coach: REST API → {self.account}")
        else:
            print("⚠️  Snowflake Coach: Not configured — using fallback responses")
            print("   → Set SNOWFLAKE_ACCOUNT + SNOWFLAKE_USER + SNOWFLAKE_PASSWORD")
            print("   → Or set SNOWFLAKE_MOCK_MODE=true for demo")

    # ── Core: Execute Cortex LLM ─────────────────────────────────────────

    async def _call_cortex(self, prompt: str, model: str = "mistral-large") -> Optional[str]:
        """Execute a Snowflake Cortex COMPLETE call. Returns raw text or None."""
        if self.connector_enabled:
            return await self._call_via_connector(prompt, model)
        if self.rest_enabled:
            return await self._call_via_rest(prompt, model)
        return None

    async def _call_via_connector(self, prompt: str, model: str) -> Optional[str]:
        try:
            conn = snowflake.connector.connect(
                account=self.account,
                user=self.user,
                password=self.password,
                warehouse=self.warehouse,
                database=self.database,
                schema=self.schema,
            )
            cursor = conn.cursor()
            safe_prompt = prompt.replace("'", "''")
            sql = f"SELECT SNOWFLAKE.CORTEX.COMPLETE('{model}', '{safe_prompt}') AS response"
            cursor.execute(sql)
            result = cursor.fetchone()
            conn.close()
            return result[0] if result else None
        except Exception as e:
            print(f"[Snowflake Connector] Error: {e}")
            return None

    async def _call_via_rest(self, prompt: str, model: str) -> Optional[str]:
        try:
            url = f"https://{self.account}.snowflakecomputing.com/api/v2/cortex/inference:complete"
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            }
            payload = {
                "model": model,
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 512,
            }
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(url, json=payload, headers=headers)
                resp.raise_for_status()
                data = resp.json()
                return data.get("choices", [{}])[0].get("message", {}).get("content", "")
        except Exception as e:
            print(f"[Snowflake REST] Error: {e}")
            return None

    # ── Coaching Feedback ────────────────────────────────────────────────

    async def generate_coaching_feedback(
        self,
        phonemes_practiced: List[str],
        accuracy_scores: Dict[str, float],
        struggles: List[str],
        session_duration: Optional[int] = None,
        model: str = "mistral-large",
    ) -> CoachingFeedback:
        """Generate personalized coaching feedback after a practice session."""

        # Record session for trend analysis
        session = SessionSummary(
            phonemes=phonemes_practiced,
            scores=accuracy_scores,
            struggles=struggles,
            duration=session_duration or 0,
        )
        self.session_history.append(session)

        if self.mock_mode:
            return self._generate_mock(phonemes_practiced, accuracy_scores, struggles)

        if not self.enabled:
            return self._fallback()

        # Build rich prompt with session context
        avg = session.avg_accuracy
        duration_str = f"{session_duration // 60}m {session_duration % 60}s" if session_duration else "unknown"

        # Include trend data if we have history
        trend_context = ""
        if len(self.session_history) > 1:
            prev = self.session_history[-2]
            improvement = avg - prev.avg_accuracy
            trend_context = f"\nTrend: {'Improving' if improvement > 0 else 'Needs focus'} ({improvement*100:+.1f}% from last session)"

        phoneme_detail = ", ".join(
            f"{p}: {accuracy_scores.get(p, 0)*100:.0f}%"
            for p in phonemes_practiced
        ) if phonemes_practiced else "No phonemes tracked"

        prompt = f"""You are a warm, encouraging speech therapist coaching a deaf or hard-of-hearing student learning to speak using haptic (vibration) feedback.

SESSION DATA:
- Duration: {duration_str}
- Phonemes practiced: {phoneme_detail}
- Overall accuracy: {avg*100:.0f}%
- Struggles reported: {', '.join(struggles) if struggles else 'None reported'}
- Session #{len(self.session_history)}{trend_context}

Respond in EXACTLY this JSON format (no markdown, no extra text):
{{
  "encouragement": "One warm, specific sentence celebrating their best achievement this session",
  "focus_areas": ["First specific area to improve with a concrete tip", "Second specific area with actionable advice"],
  "next_steps": ["One clear action item for their next practice session"]
}}

Rules:
- Reference their actual scores and phonemes
- Give tactile/haptic-focused advice (feel vibration, feel air, feel placement)
- Keep each string under 120 characters
- Be genuinely encouraging — learning speech is incredibly hard"""

        raw = await self._call_cortex(prompt, model)
        if raw:
            return self._parse_json_response(raw, model)

        return self._fallback()

    # ── Quick Phoneme Tips ───────────────────────────────────────────────

    async def get_quick_tip(self, phoneme: str, model: str = "mixtral-8x7b") -> dict:
        """Get a pronunciation tip for a specific phoneme."""
        phoneme = phoneme.upper()

        # Always include our curated knowledge base data
        base_tip = PHONEME_TIPS.get(phoneme, {
            "tip": f"Practice the {phoneme} sound with steady, controlled airflow.",
            "placement": "Consult your speech therapist for tongue/lip positioning",
            "common_error": "Inconsistent production",
        })

        if self.mock_mode or not self.enabled:
            return base_tip

        # Enhance with Cortex AI
        prompt = f"""You are a speech therapist. Give a brief, practical tip for a deaf student learning the "{phoneme}" sound using haptic (vibration) feedback.

Focus on what they should FEEL (vibrations, air, placement) rather than what they should HEAR.
Respond in one concise sentence, max 100 characters."""

        raw = await self._call_cortex(prompt, model)
        if raw:
            base_tip["ai_tip"] = raw.strip().strip('"')
        
        return base_tip

    # ── Session History / Trends ─────────────────────────────────────────

    async def get_session_trends(self, model: str = "llama3-70b") -> dict:
        """Analyze trends across multiple practice sessions."""
        if len(self.session_history) < 2:
            return {
                "trend": "not_enough_data",
                "message": "Complete at least 2 sessions to see trends.",
                "sessions_completed": len(self.session_history),
            }

        recent = self.session_history[-5:]  # Last 5 sessions
        accuracies = [s.avg_accuracy for s in recent]
        all_struggles = []
        for s in recent:
            all_struggles.extend(s.struggles)

        trend_data = {
            "sessions_analyzed": len(recent),
            "accuracy_trend": accuracies,
            "avg_improvement": accuracies[-1] - accuracies[0] if len(accuracies) > 1 else 0,
            "recurring_struggles": list(set(all_struggles)),
            "total_practice_time": sum(s.duration for s in recent),
        }

        if (self.mock_mode or not self.enabled):
            trend_data["summary"] = (
                f"Over {len(recent)} sessions, your accuracy went from "
                f"{accuracies[0]*100:.0f}% to {accuracies[-1]*100:.0f}%. "
                f"{'Great improvement!' if trend_data['avg_improvement'] > 0 else 'Keep practicing — consistency is key!'}"
            )
            return trend_data

        # Use Cortex for richer analysis
        prompt = f"""Analyze this speech therapy progress for a deaf student:
Sessions: {len(recent)}
Accuracy trend: {[f'{a*100:.0f}%' for a in accuracies]}
Recurring struggles: {', '.join(set(all_struggles)) or 'None'}
Total practice: {sum(s.duration for s in recent) // 60} minutes

Give a 2-sentence encouraging summary of their progress and one suggestion. Keep it under 200 characters total."""

        raw = await self._call_cortex(prompt, model)
        trend_data["summary"] = raw.strip() if raw else "Keep up the great work! Consistency is the key to improvement."
        return trend_data

    def get_status(self) -> dict:
        """Return current coach configuration status."""
        return {
            "enabled": self.enabled or self.mock_mode,
            "mode": (
                "mock" if self.mock_mode
                else "connector" if self.connector_enabled
                else "rest" if self.rest_enabled
                else "disabled"
            ),
            "account": self.account[:8] + "..." if self.account else None,
            "available_models": list(self.AVAILABLE_MODELS.keys()),
            "sessions_tracked": len(self.session_history),
        }

    # ── Response Parsing ─────────────────────────────────────────────────

    def _parse_json_response(self, raw: str, model: str) -> CoachingFeedback:
        """Try to parse JSON response from Cortex, fall back to text parsing."""
        try:
            # Strip markdown code fences if present
            cleaned = raw.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()

            data = json.loads(cleaned)
            return CoachingFeedback(
                feedback_text=raw,
                focus_areas=data.get("focus_areas", []),
                encouragement=data.get("encouragement", "Great effort!"),
                next_steps=data.get("next_steps", []),
                model_used=model,
                provider="snowflake-cortex",
            )
        except (json.JSONDecodeError, KeyError):
            return self._parse_text_response(raw, model)

    def _parse_text_response(self, text: str, model: str) -> CoachingFeedback:
        """Legacy text-based parsing for non-JSON responses."""
        lines = text.strip().split("\n")
        celebrate = ""
        focus = []
        next_step = ""

        for line in lines:
            line_stripped = line.strip()
            if "CELEBRATE:" in line_stripped:
                celebrate = line_stripped.split("CELEBRATE:", 1)[1].strip()
            elif "NEXT:" in line_stripped:
                next_step = line_stripped.split("NEXT:", 1)[1].strip()
            elif line_stripped.startswith(("-", "•", "*")):
                cleaned = line_stripped.lstrip("-•* ").strip()
                if cleaned:
                    focus.append(cleaned)

        return CoachingFeedback(
            feedback_text=text,
            focus_areas=focus if focus else ["Keep practicing consistently"],
            encouragement=celebrate or "Great work today!",
            next_steps=[next_step] if next_step else ["Practice for 5 minutes tomorrow"],
            model_used=model,
            provider="snowflake-cortex",
        )

    # ── Mock & Fallback ──────────────────────────────────────────────────

    def _generate_mock(
        self, phonemes: List[str], scores: Dict[str, float], struggles: List[str]
    ) -> CoachingFeedback:
        avg = sum(scores.values()) / len(scores) if scores else 0.5
        best = max(scores.items(), key=lambda x: x[1])[0] if scores else "vowels"
        worst = min(scores.items(), key=lambda x: x[1])[0] if scores else "consonants"
        best_score = scores.get(best, 0.5) * 100
        worst_score = scores.get(worst, 0.5) * 100

        # Dynamic encouragement based on performance
        if avg >= 0.85:
            enc = f"Outstanding! Your {best} sound hit {best_score:.0f}% accuracy — real progress!"
        elif avg >= 0.7:
            enc = f"Great work on {best} ({best_score:.0f}%)! Your dedication is showing."
        elif avg >= 0.5:
            enc = f"Good effort! Your {best} sound is getting stronger at {best_score:.0f}%."
        else:
            enc = f"Every practice session builds muscle memory. Your {best} is your strongest at {best_score:.0f}%."

        # Specific focus areas
        focus = []
        if worst_score < 70:
            tip = PHONEME_TIPS.get(worst, {})
            focus.append(
                tip.get("tip", f"Practice {worst} — focus on feeling the vibration pattern")
            )
        if struggles:
            focus.append(f"Work on: {struggles[0]}")
        if not focus:
            focus = [
                f"Keep refining {worst} — try holding it for 3 seconds",
                "Practice transitioning between different sounds smoothly",
            ]

        return CoachingFeedback(
            feedback_text=f"Session analysis: {len(phonemes)} phonemes, {avg*100:.0f}% avg",
            focus_areas=focus[:3],
            encouragement=enc,
            next_steps=[f"Spend 5 minutes focusing on {worst} ({worst_score:.0f}%) — it's ready for a breakthrough!"],
            model_used="mock-mistral-large",
            provider="snowflake-cortex",
        )

    def _fallback(self) -> CoachingFeedback:
        return CoachingFeedback(
            feedback_text="Keep practicing — every session makes you stronger!",
            focus_areas=["Maintain regular practice schedule", "Focus on feeling vibrations clearly"],
            encouragement="You're building skills with every session!",
            next_steps=["Practice for 5 minutes tomorrow — consistency beats intensity"],
            model_used="fallback",
            provider="snowflake-cortex",
        )


# Singleton
snowflake_coach = SnowflakeCoach()
