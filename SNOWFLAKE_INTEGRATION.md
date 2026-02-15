# Snowflake Integration Guide

## Why We Use Snowflake

**HapticPhonix uses TWO AI platforms, each for different purposes:**

### Gemini API (Google) - Real-Time Analysis
- **What:** Lip reading from video frames
- **Why:** Best-in-class vision models for real-time analysis
- **When:** During active practice sessions

### Snowflake Cortex - Long-Term Coaching
- **What:** Personalized AI coaching and progress analysis
- **Why:** Multi-model access + data integration capabilities
- **When:** After practice sessions, for insights over time

## What Makes Snowflake Unique

1. **Multi-Model Access Through One API**
   - Mistral Large (detailed coaching)
   - Llama 3 70B (educational explanations)
   - Mixtral 8x7B (fast tips)
   - Switch models without changing code

2. **Data + AI Integration**
   - Unlike pure LLM APIs, Snowflake lets you store practice data AND run AI on it natively
   - Perfect for analyzing patterns across sessions
   - Built-in vector search for RAG applications

3. **Enterprise-Grade for Education**
   - Free 120-day student trial (no credit card)
   - Production-ready for scaling
   - Built for compliance and data governance

4. **Future-Proof Architecture**
   - Currently: AI coaching after each session
   - Next: Store all practice data, build RAG knowledge base
   - Later: Analyze trends across thousands of students

## How We Use It

### Current Implementation

**Endpoint:** `POST /api/coaching-feedback`

**Request:**
```json
{
  "phonemes": ["AH", "EE", "S"],
  "scores": {
    "AH": 0.85,
    "EE": 0.62,
    "S": 0.90
  },
  "struggles": ["inconsistent pitch", "weak vibration"],
  "duration": 300,
  "model": "mistral-large"
}
```

**Response:**
```json
{
  "success": true,
  "encouragement": "Great work on those S sounds!",
  "focus_areas": [
    "Practice EE sound with consistent breath support",
    "Feel for steady vibration on sustained vowels"
  ],
  "next_steps": [
    "Try 5-minute practice focusing on EE vs AH contrast"
  ],
  "model": "mistral-large",
  "provider": "snowflake-cortex"
}
```

### Quick Tips Endpoint

**Endpoint:** `GET /api/phoneme-tip/{phoneme}`

Example: `GET /api/phoneme-tip/AH`

Returns fast, model-generated tips using Mixtral (fastest Snowflake model).

## Setup Instructions

### 1. Get Snowflake Account (FREE)

```bash
# Visit https://signup.snowflake.com/
# Use your student email for 120-day free trial
# Note your account identifier (e.g., "abc12345.us-east-1")
```

### 2. Generate API Key

1. Log into Snowflake console
2. Go to: **Account Settings → API Keys**
3. Click **Generate Key Pair**
4. Download private key
5. Copy the JWT token

### 3. Configure Environment

```bash
# In backend/.env.local:
SNOWFLAKE_ACCOUNT=abc12345.us-east-1
SNOWFLAKE_API_KEY=your_jwt_token_here
```

### 4. Test the Integration

```bash
# Start backend server
cd backend
python main.py

# Test coaching endpoint
curl -X POST http://localhost:8000/api/coaching-feedback \
  -H "Content-Type: application/json" \
  -d '{
    "phonemes": ["AH", "EE"],
    "scores": {"AH": 0.85, "EE": 0.62},
    "struggles": ["inconsistent pitch"]
  }'
```

## Demo Script for Judges

**"Let me show you our dual-AI architecture:"**

1. **Real-time (Gemini):** 
   - Student speaks → camera captures lips
   - Gemini analyzes: "Detected: 'Hello'"
   - Instant haptic feedback

2. **Post-session (Snowflake):**
   - Student finishes 5-minute practice
   - Click "Get Coaching Feedback"
   - Snowflake Cortex analyzes their performance across all phonemes
   - Returns: "Great work on vowels! Focus on 'S' sounds next. Try..."

**"Why we need both:"**
- Gemini = Real-time vision (what they're doing NOW)
- Snowflake = Long-term coach (how they're improving OVER TIME)

**"What makes Snowflake special:"**
- We can switch between 3 different LLM models instantly
- Future: Store all practice data in Snowflake tables, run SQL + AI together
- Student trial = accessible for deaf education programs

## Code Highlights for Judges

**Show them:**
1. [`snowflake_coach.py`](snowflake_coach.py) - Clean API wrapper
2. [`main.py`](main.py#L485) - `/api/coaching-feedback` endpoint
3. Compare Gemini (real-time) vs Snowflake (coaching) use cases

**Key talking points:**
- "Multi-model access with one API call"
- "Built for data + AI integration (we'll add session storage next)"
- "Free 120-day student trial makes this accessible"

## Troubleshooting

### "Snowflake credentials not set"
- Check `.env.local` has `SNOWFLAKE_ACCOUNT` and `SNOWFLAKE_API_KEY`
- Restart backend server after adding credentials

### "API key invalid"
- Regenerate API key in Snowflake console
- Ensure you're using JWT token, not OAuth for this setup

### "Cortex function not found"
- Ensure you have access to Snowflake Cortex (included in trial)
- Check account has `CORTEX_DB` database created

## Next Steps (Post-Hackathon)

1. **Add session storage:** Store practice data in Snowflake tables
2. **Build RAG knowledge base:** Speech therapy tips searchable via embeddings
3. **Multi-student analytics:** Compare progress across cohorts
4. **Automated lesson generation:** Use LLM to create personalized practice plans

---

**For prize consideration:** This demonstrates using Snowflake Cortex API for intelligent, multi-model coaching that complements our real-time Gemini integration.
