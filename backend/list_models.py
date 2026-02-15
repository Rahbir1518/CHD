import os
import requests
from dotenv import load_dotenv

load_dotenv(".env.local")
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("No API Key found")
    exit(1)

url = f"https://generativelanguage.googleapis.com/v1beta/models?key={api_key}"
try:
    resp = requests.get(url)
    print(f"Status: {resp.status_code}")
    if resp.status_code == 200:
        models = resp.json().get('models', [])
        for m in models:
            if 'generateContent' in m.get('supportedGenerationMethods', []):
                print(f"- {m['name']}")
    else:
        print(resp.text)
except Exception as e:
    print(e)
