import os
import httpx
import base64
from typing import Optional

class TTSManager:
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Default voice ID: Rachel
        self.voice_id = "21m00Tcm4TlvDq8ikWAM" 
        self.base_url = "https://api.elevenlabs.io/v1/text-to-speech"

    async def generate_audio_base64(self, text: str) -> Optional[str]:
        """
        Generates audio for the given text using ElevenLabs and returns it as a base64 string.
        """
        if not self.api_key:
            print("[TTS] Error: No ElevenLabs API Key provided")
            return None

        url = f"{self.base_url}/{self.voice_id}"
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": self.api_key
        }
        data = {
            "text": text,
            "model_id": "eleven_monolingual_v1",
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.5
            }
        }

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=data, headers=headers)
                if response.status_code == 200:
                    # Return base64 encoded audio
                    return base64.b64encode(response.content).decode('utf-8')
                else:
                    print(f"[TTS] Error from ElevenLabs: {response.status_code} - {response.text}")
                    return None
        except Exception as e:
            print(f"[TTS] Exception during audio generation: {e}")
            return None
