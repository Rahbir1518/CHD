# SNOWFLAKE QUICK START - READ THIS FIRST! 🚀

## TL;DR - Get it working in 30 seconds:

```bash
cd backend

# Option 1: Demo with fake data (INSTANT)
echo 'SNOWFLAKE_MOCK_MODE=true' > .env.local
python test_snowflake.py

# Option 2: Real Snowflake (5 min signup at signup.snowflake.com)
# Add to .env.local:
# SNOWFLAKE_ACCOUNT=your_account
# SNOWFLAKE_USER=your_email
# SNOWFLAKE_PASSWORD=your_password
# SNOWFLAKE_DATABASE=your_db_name
```

## What I Built:

### ✅ **Files Created:**
1. `snowflake_coach.py` - AI coaching engine
2. `test_snowflake.py` - Test script
3. `.env.example` - Config template
4. Added to `main.py`: 2 new API endpoints
5. Added to `requirements.txt`: snowflake-connector-python

### ✅ **3 Operating Modes:**

**🎭 Mock Mode** (for demo, no signup needed):
- Set `SNOWFLAKE_MOCK_MODE=true`
- Returns realistic fake responses
- **Use this for hackathon demo if time is tight!**

**⚡ Python Connector** (easiest real mode):
- Just need: account, username, password
- Auto-executes SQL with Cortex

**🔧 REST API** (backup):
- Needs account + JWT token
- Works if connector fails

### ✅ **API Endpoints Added:**

**POST /api/coaching-feedback**
```bash
curl -X POST http://localhost:8000/api/coaching-feedback \
  -H "Content-Type: application/json" \
  -d '{
    "phonemes": ["AH", "EE"],
    "scores": {"AH": 0.85, "EE": 0.62},
    "struggles": ["inconsistent pitch"]
  }'
```

**GET /api/phoneme-tip/{phoneme}**
```bash
curl http://localhost:8000/api/phoneme-tip/AH
```

## How It Works:

```
Student practice session
        ↓
Frontend calls: POST /api/coaching-feedback
        ↓
Backend (main.py) → snowflake_coach.py
        ↓
Snowflake Cortex LLM (Mistral/Llama/Mixtral)
        ↓
Returns: Personalized coaching feedback
        ↓
Display to student
```

## Test It:

```bash
cd backend

# Install (if needed)
pip install snowflake-connector-python

# Test
python test_snowflake.py

# Start server
python main.py

# In another terminal, test API:
curl -X POST http://localhost:8000/api/coaching-feedback \
  -H "Content-Type: application/json" \
  -d '{"phonemes":["AH"],"scores":{"AH":0.85},"struggles":[]}' \
  | python -m json.tool
```

## For Hackathon Demo:

**Best strategy:**
1. Use **mock mode** for reliability (`SNOWFLAKE_MOCK_MODE=true`)
2. Show judges the code in `snowflake_coach.py`
3. Explain: "Using mock mode for demo reliability, but full Snowflake integration is built"
4. Point out the SQL: `SNOWFLAKE.CORTEX.COMPLETE(model, prompt)`

**Talking points:**
- "We use Gemini for real-time lip reading, Snowflake for long-term coaching"
- "Snowflake gives us multi-model access (Mistral, Llama, Mixtral) through one API"
- "Built for data + AI integration - we can store sessions and analyze trends"
- "Free 120-day student trial = accessible for schools"

## Troubleshooting:

| Problem | Fix |
|---------|-----|
| No time to sign up | Use mock mode |
| Connector won't install | Use mock mode |
| Network issues on demo day | **Use mock mode!** |
| Want to show real Snowflake | Follow setup in SNOWFLAKE_SETUP.md |

## Files to Show Judges:

1. **`snowflake_coach.py`** - The integration code
2. **`main.py`** (lines 485+) - The API endpoints
3. **`SNOWFLAKE_INTEGRATION.md`** - Why we chose Snowflake
4. **This file** - Quick reference

---

**Read SNOWFLAKE_SETUP.md for detailed instructions.**
**Read SNOWFLAKE_INTEGRATION.md for the "why Snowflake" story.**
