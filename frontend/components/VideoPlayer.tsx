
import React, { useRef, useEffect, useState } from 'react';
import LipMeshOverlay from './LipMeshOverlay';

interface LipLandmark {
  x: number;
  y: number;
  z: number;
  index: number;
}

interface LipBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface VideoPlayerProps {
  frameSrc: string | null;
  status: string;
  landmarks?: LipLandmark[];
  showOverlay?: boolean;
  mouthOpenness?: number;
  currentPhoneme?: string | null;
  lipBoundingBox?: LipBoundingBox | null;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ 
  frameSrc, 
  status, 
  landmarks = [], 
  showOverlay = true,
  mouthOpenness,
  currentPhoneme,
  lipBoundingBox = null
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 640, height: 480 });

  // Track container dimensions for overlay sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div 
      ref={containerRef}
      className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center"
    >
      {frameSrc ? (
        <>
          <img 
            src={frameSrc} 
            alt="Live Stream" 
            className="w-full h-full object-contain"
          />
          {/* Lip landmark overlay */}
          {showOverlay && (
            <LipMeshOverlay
              landmarks={landmarks}
              width={dimensions.width}
              height={dimensions.height}
              isVisible={true}
              lipBoundingBox={lipBoundingBox}
            />
          )}
        </>
      ) : (
        <div className="flex flex-col items-center gap-2 text-gray-500">
          <div className="animate-pulse">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="text-sm font-medium">Waiting for video stream...</span>
          <span className="text-xs opacity-75">Status: {status}</span>
        </div>
      )}
      
      {/* Overlay info */}
      <div className="absolute top-2 right-2 flex items-center gap-2">
        <div className="bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">
          Live Feed
        </div>
        {landmarks.length > 0 && (
          <div className="bg-green-600/70 px-2 py-1 rounded text-xs text-white backdrop-blur-sm animate-pulse">
            🎯 Tracking
          </div>
        )}
      </div>

      {/* Mouth openness + current phoneme HUD */}
      {(mouthOpenness !== undefined || currentPhoneme) && (
        <div className="absolute bottom-2 right-2 bg-black/60 px-3 py-2 rounded-lg text-xs text-white backdrop-blur-sm space-y-1">
          {mouthOpenness !== undefined && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Mouth:</span>
              <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-400 rounded-full transition-all duration-100" 
                  style={{ width: `${Math.min(mouthOpenness * 100, 100)}%` }}
                />
              </div>
              <span className="font-mono w-8 text-right">{(mouthOpenness * 100).toFixed(0)}%</span>
            </div>
          )}
          {currentPhoneme && (
            <div className="flex items-center gap-2">
              <span className="text-gray-400">Sound:</span>
              <span className="font-bold text-yellow-300 text-sm">{currentPhoneme}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
