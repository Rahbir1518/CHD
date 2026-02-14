
import React from 'react';

interface VideoPlayerProps {
  frameSrc: string | null;
  status: string;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ frameSrc, status }) => {
  return (
    <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden border border-gray-800 flex items-center justify-center">
      {frameSrc ? (
        <img 
          src={frameSrc} 
          alt="Live Stream" 
          className="w-full h-full object-contain"
        />
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
      <div className="absolute top-2 right-2 bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">
        Live Feed
      </div>
    </div>
  );
};

export default VideoPlayer;
