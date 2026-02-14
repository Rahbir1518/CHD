import React, { useRef, useEffect, useState } from 'react';

interface LipLandmark {
  x: number;
  y: number;
  z: number;
  index: number;
}

interface LipMeshOverlayProps {
  landmarks: LipLandmark[];
  width: number;
  height: number;
  isVisible?: boolean;
}

const LipMeshOverlay: React.FC<LipMeshOverlayProps> = ({ 
  landmarks, 
  width, 
  height, 
  isVisible = true 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Draw landmarks on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    if (landmarks.length === 0) return;
    
    // Draw each landmark
    landmarks.forEach(landmark => {
      const x = landmark.x * width;
      const y = landmark.y * height;
      
      // Different styles for different landmarks
      let color: string;
      let radius: number;
      
      switch (landmark.index) {
        case 0: // Cupid's bow - red
          color = '#ef4444';
          radius = 4;
          break;
        case 13: // Inner lip top - green
        case 14: // Inner lip bottom - green
          color = '#10b981';
          radius = 3;
          break;
        case 78: // Left outer corner - blue
        case 308: // Right outer corner - blue
          color = '#3b82f6';
          radius = 3;
          break;
        default:
          color = '#6b7280';
          radius = 2;
      }
      
      // Draw circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      
      // Draw border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw index label
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(landmark.index.toString(), x, y - 8);
    });
    
    // Draw connections between landmarks
    if (landmarks.length >= 2) {
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      
      // Connect cupids bow to inner lip
      const cupidBow = landmarks.find(l => l.index === 0);
      const innerTop = landmarks.find(l => l.index === 13);
      const innerBottom = landmarks.find(l => l.index === 14);
      
      if (cupidBow && innerTop) {
        ctx.beginPath();
        ctx.moveTo(cupidBow.x * width, cupidBow.y * height);
        ctx.lineTo(innerTop.x * width, innerTop.y * height);
        ctx.stroke();
      }
      
      if (cupidBow && innerBottom) {
        ctx.beginPath();
        ctx.moveTo(cupidBow.x * width, cupidBow.y * height);
        ctx.lineTo(innerBottom.x * width, innerBottom.y * height);
        ctx.stroke();
      }
    }
  }, [landmarks, width, height, isVisible]);
  
  if (!isVisible) return null;
  
  return (
    <div className="absolute inset-0 pointer-events-none">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-full"
        style={{
          position: 'absolute',
          top: 0,
          left: 0
        }}
      />
      
      {/* Status indicator */}
      <div className="absolute top-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">
        Lip Landmarks: {landmarks.length}
      </div>
      
      {/* Legend */}
      {landmarks.length > 0 && (
        <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span>Cupid&apos;s Bow (0)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span>Inner Lip (13,14)</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-blue-500"></div>
              <span>Outer Corners (78,308)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LipMeshOverlay;
