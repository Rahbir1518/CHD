import React, { useState, useEffect, useCallback } from 'react';
import { isVibrationSupported } from '@/lib/haptics';

interface HapticEvent {
  type: 'haptic_feedback';
  pattern: number[];
  phoneme_type: string;
  confidence: number;
  timestamp: number;
}

interface HapticFeedbackProps {
  onHapticEvent?: (event: HapticEvent) => void;
  isEnabled?: boolean;
}

const HapticFeedback: React.FC<HapticFeedbackProps> = ({ 
  onHapticEvent,
  isEnabled = true 
}) => {
  const [currentPattern, setCurrentPattern] = useState<number[]>([]);
  const [isActive, setIsActive] = useState(false);
  const [phonemeType, setPhonemeType] = useState<string>('');
  const [confidence, setConfidence] = useState<number>(0);
  const [pulseIntensity, setPulseIntensity] = useState(0);
  
  // Handle incoming haptic events
  const handleHapticEvent = useCallback((event: HapticEvent) => {
    if (!isEnabled) return;
    
    setCurrentPattern(event.pattern);
    setPhonemeType(event.phoneme_type);
    setConfidence(event.confidence);
    setIsActive(true);
    
    // Trigger actual device vibration if supported (excludes iOS - can freeze)
    if (isVibrationSupported() && event.pattern.length > 0) {
      navigator.vibrate(event.pattern);
    }
    
    // Notify parent component
    if (onHapticEvent) {
      onHapticEvent(event);
    }
    
    // Set timeout to deactivate
    const totalDuration = event.pattern.reduce((sum, duration) => sum + duration, 0);
    setTimeout(() => {
      setIsActive(false);
      setCurrentPattern([]);
      setPhonemeType('');
    }, totalDuration + 500);
  }, [isEnabled, onHapticEvent]);
  
  // Pulse animation effect
  useEffect(() => {
    if (!isActive) return;
    
    const startTime = Date.now();
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      let totalElapsed = 0;
      let currentPulseIndex = 0;
      
      // Calculate current pulse intensity
      for (let i = 0; i < currentPattern.length; i += 2) {
        const pulseDuration = currentPattern[i] || 0;
        const pauseDuration = currentPattern[i + 1] || 0;
        
        if (elapsed >= totalElapsed && elapsed < totalElapsed + pulseDuration) {
          // During pulse - full intensity
          setPulseIntensity(1);
          currentPulseIndex = i;
          break;
        } else if (elapsed >= totalElapsed + pulseDuration && elapsed < totalElapsed + pulseDuration + pauseDuration) {
          // During pause - no intensity
          setPulseIntensity(0);
          currentPulseIndex = i;
          break;
        }
        
        totalElapsed += pulseDuration + pauseDuration;
      }
      
      // Continue animation while active
      if (isActive) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
    
    return () => {
      setPulseIntensity(0);
    };
  }, [isActive, currentPattern]);
  
  // Get visual representation of pattern
  const getPatternVisual = () => {
    if (currentPattern.length === 0) return null;
    
    return (
      <div className="flex items-center gap-1 mt-2">
        {currentPattern.map((duration, index) => (
          <div
            key={index}
            className={`h-2 rounded-full transition-all duration-100 ${
              index % 2 === 0 
                ? `w-${Math.min(Math.floor(duration / 20), 16)} bg-purple-500 ${isActive ? 'opacity-100 scale-110' : 'opacity-50'}`
                : 'w-1 bg-gray-300'
            }`}
            title={`${duration}ms`}
          />
        ))}
      </div>
    );
  };
  
  // Get phoneme type color
  const getPhonemeColor = () => {
    switch (phonemeType) {
      case 'vowel': return 'bg-green-500';
      case 'consonant': return 'bg-blue-500';
      case 'buzz': return 'bg-yellow-500';
      case 'silence': return 'bg-gray-500';
      default: return 'bg-purple-500';
    }
  };
  
  // Get confidence indicator
  const getConfidenceIndicator = () => {
    const confidenceLevel = confidence >= 0.9 ? 'high' : 
                          confidence >= 0.7 ? 'medium' : 'low';
    
    return (
      <div className="flex items-center gap-1 mt-1">
        <span className="text-xs text-gray-600">Confidence:</span>
        <div className="flex gap-0.5">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full ${
                i <= (confidenceLevel === 'high' ? 3 : confidenceLevel === 'medium' ? 2 : 1)
                  ? confidenceLevel === 'high' ? 'bg-green-500' :
                    confidenceLevel === 'medium' ? 'bg-yellow-500' : 'bg-red-500'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className="text-xs text-gray-500">{(confidence * 100).toFixed(0)}%</span>
      </div>
    );
  };
  
  return (
    <div className="fixed bottom-4 right-4 z-50">
      {/* Main haptic feedback display */}
      <div className={`
        bg-white rounded-xl shadow-lg border-2 transition-all duration-300
        ${isActive 
          ? `${getPhonemeColor()} border-purple-300 scale-105` 
          : 'border-gray-200'
        }
        ${pulseIntensity > 0 ? 'animate-pulse' : ''}
      `}>
        <div className="p-4 min-w-[200px]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-800">
              {isActive ? `Haptic: ${phonemeType}` : 'Ready for Haptics'}
            </h3>
            <div className={`w-3 h-3 rounded-full ${isEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
          </div>
          
          {isActive && (
            <>
              <div className="text-sm text-gray-600 mb-2">
                Vibrating device...
              </div>
              {getPatternVisual()}
              {getConfidenceIndicator()}
            </>
          )}
          
          {!isActive && (
            <div className="text-sm text-gray-500">
              Listening for phoneme events
            </div>
          )}
        </div>
      </div>
      
      {/* Floating action button for testing */}
      <div className="mt-2 flex gap-2">
        <button
          onClick={() => handleHapticEvent({
            type: 'haptic_feedback',
            pattern: [100, 50, 100],
            phoneme_type: 'vowel',
            confidence: 0.95,
            timestamp: Date.now()
          })}
          className="px-3 py-1 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition-colors"
          disabled={!isEnabled}
        >
          Test Vowel
        </button>
        
        <button
          onClick={() => handleHapticEvent({
            type: 'haptic_feedback',
            pattern: [200, 100, 200],
            phoneme_type: 'consonant',
            confidence: 0.85,
            timestamp: Date.now()
          })}
          className="px-3 py-1 bg-blue-500 text-white text-xs rounded-lg hover:bg-blue-600 transition-colors"
          disabled={!isEnabled}
        >
          Test Consonant
        </button>
      </div>
    </div>
  );
};

export default HapticFeedback;
