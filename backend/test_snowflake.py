#!/usr/bin/env python3
"""
Test script for Snowflake integration.
Run this to verify your Snowflake setup is working.
"""

import asyncio
import os
from dotenv import load_dotenv

# Load environment
load_dotenv(".env.local")

# Import our coach
from snowflake_coach import snowflake_coach


async def test_coaching_feedback():
    """Test the main coaching feedback feature."""
    print("\n" + "="*70)
    print("TEST 1: Coaching Feedback")
    print("="*70)
    
    # Sample practice session data
    phonemes = ["AH", "EE", "S"]
    scores = {
        "AH": 0.85,
        "EE": 0.62,
        "S": 0.90
    }
    struggles = ["inconsistent pitch on EE", "weak vibration"]
    
    print(f"\n📊 Practice Session:")
    print(f"   Phonemes: {phonemes}")
    print(f"   Scores: {scores}")
    print(f"   Struggles: {struggles}")
    print(f"\n⏳ Calling Snowflake Cortex...")
    
    try:
        feedback = await snowflake_coach.generate_coaching_feedback(
            phonemes_practiced=phonemes,
            accuracy_scores=scores,
            struggles=struggles,
            session_duration=300,  # 5 minutes
            model="mistral-large"
        )
        
        print(f"\n✅ SUCCESS! Got feedback from model: {feedback.model_used}")
        print("\n" + "-"*70)
        print(feedback.feedback_text)
        print("-"*70)
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return False
    
    return True


async def test_quick_tip():
    """Test the quick tip feature."""
    print("\n" + "="*70)
    print("TEST 2: Quick Phoneme Tip")
    print("="*70)
    
    phoneme = "AH"
    print(f"\n🔤 Getting tip for phoneme: {phoneme}")
    print(f"⏳ Calling Snowflake Cortex...")
    
    try:
        tip = await snowflake_coach.get_quick_tip(phoneme)
        print(f"\n✅ SUCCESS!")
        print(f"💡 Tip: {tip}")
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        return False
    
    return True


async def main():
    """Run all tests."""
    print("\n" + "="*70)
    print("🧪 SNOWFLAKE INTEGRATION TEST SUITE")
    print("="*70)
    
    # Check configuration
    print("\n📋 Configuration Check:")
    print(f"   Account: {os.getenv('SNOWFLAKE_ACCOUNT', 'NOT SET')}")
    print(f"   User: {os.getenv('SNOWFLAKE_USER', 'NOT SET')}")
    print(f"   Password: {'***' if os.getenv('SNOWFLAKE_PASSWORD') else 'NOT SET'}")
    print(f"   Mock Mode: {os.getenv('SNOWFLAKE_MOCK_MODE', 'false')}")
    
    if snowflake_coach.mock_mode:
        print("\n🎭 Running in MOCK MODE (no real API calls)")
    elif not snowflake_coach.enabled:
        print("\n⚠️  Snowflake not configured!")
        print("\nTo test with MOCK data:")
        print("   Add to .env.local: SNOWFLAKE_MOCK_MODE=true")
        print("\nTo test with REAL Snowflake:")
        print("   Add to .env.local:")
        print("   SNOWFLAKE_ACCOUNT=your_account")
        print("   SNOWFLAKE_USER=your_username")
        print("   SNOWFLAKE_PASSWORD=your_password")
        print("   SNOWFLAKE_DATABASE=your_database")
        return
    
    # Run tests
    results = []
    
    results.append(await test_coaching_feedback())
    results.append(await test_quick_tip())
    
    # Summary
    print("\n" + "="*70)
    print("📊 TEST SUMMARY")
    print("="*70)
    passed = sum(results)
    total = len(results)
    print(f"\n   Passed: {passed}/{total}")
    
    if all(results):
        print("\n   ✅ All tests passed! Snowflake integration is working.")
    else:
        print("\n   ⚠️  Some tests failed. Check errors above.")
    
    print("\n" + "="*70)


if __name__ == "__main__":
    asyncio.run(main())
