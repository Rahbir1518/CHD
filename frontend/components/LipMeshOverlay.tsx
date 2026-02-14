import React, { useRef, useEffect } from 'react';

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

interface LipMeshOverlayProps {
  landmarks: LipLandmark[];
  width: number;
  height: number;
  isVisible?: boolean;
  lipBoundingBox?: LipBoundingBox | null;
}

const LipMeshOverlay: React.FC<LipMeshOverlayProps> = ({ 
  landmarks, 
  width, 
  height, 
  isVisible = true,
  lipBoundingBox = null
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Draw landmarks + bounding box on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isVisible) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    if (landmarks.length === 0 && !lipBoundingBox) return;
    
    // ── Draw lip bounding box ──
    if (lipBoundingBox) {
      const bx = lipBoundingBox.x * width;
      const by = lipBoundingBox.y * height;
      const bw = lipBoundingBox.width * width;
      const bh = lipBoundingBox.height * height;

      // Outer glow
      ctx.shadowColor = '#22c55e';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.shadowBlur = 0;

      // Corner accents
      const cornerLen = Math.min(bw, bh) * 0.2;
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 3;
      // Top-left
      ctx.beginPath();
      ctx.moveTo(bx, by + cornerLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + cornerLen, by);
      ctx.stroke();
      // Top-right
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + cornerLen);
      ctx.stroke();
      // Bottom-left
      ctx.beginPath();
      ctx.moveTo(bx, by + bh - cornerLen);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + cornerLen, by + bh);
      ctx.stroke();
      // Bottom-right
      ctx.beginPath();
      ctx.moveTo(bx + bw - cornerLen, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - cornerLen);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'left';
      ctx.fillText('LIPS', bx + 4, by - 6);
    }
    
    // ── Draw each landmark point ──
    landmarks.forEach(landmark => {
      const x = landmark.x * width;
      const y = landmark.y * height;
      
      let color: string;
      let radius: number;
      
      switch (landmark.index) {
        case 0:
          color = '#ef4444';
          radius = 4;
          break;
        case 13:
        case 14:
          color = '#10b981';
          radius = 3;
          break;
        case 78:
        case 308:
          color = '#3b82f6';
          radius = 3;
          break;
        default:
          color = '#6b7280';
          radius = 2;
      }
      
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.stroke();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(landmark.index.toString(), x, y - 8);
    });
    
    // ── Draw connections between landmarks ──
    if (landmarks.length >= 2) {
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      
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
  }, [landmarks, width, height, isVisible, lipBoundingBox]);
  
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
