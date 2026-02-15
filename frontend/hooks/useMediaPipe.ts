import { useState, useEffect, useRef, useCallback } from 'react';

interface LipLandmark {
  x: number;
  y: number;
  z: number;
  index: number;
}

interface MediaPipeState {
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;
  landmarks: LipLandmark[];
}

// Key lip landmark indices
const LIP_LANDMARKS = [0, 13, 14, 78, 308]; // Cupid's bow, inner lip top/bottom, outer corners

export const useMediaPipe = (videoRef: React.RefObject<HTMLVideoElement>) => {
  const [state, setState] = useState<MediaPipeState>({
    isInitialized: false,
    isLoading: false,
    error: null,
    landmarks: []
  });
  
  const faceMeshRef = useRef<unknown>(null);
  const animationFrameRef = useRef<number>(0);
  
  // Load MediaPipe from CDN
  const loadMediaPipe = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && (window as { FaceMesh?: unknown }).FaceMesh) {
        resolve((window as { FaceMesh?: unknown }).FaceMesh);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559220/face_mesh.js';
      script.onload = () => {
        const checkReady = () => {
          if ((window as { FaceMesh?: unknown }).FaceMesh) {
            resolve((window as { FaceMesh?: unknown }).FaceMesh);
          } else {
            setTimeout(checkReady, 100);
          }
        };
        checkReady();
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }, []);
  
  // Process frames
  const processFrame = useCallback(() => {
    if (!faceMeshRef.current || !videoRef.current) return;
    
    const process = async () => {
      try {
        // MediaPipe types cast
        await (faceMeshRef.current as { send: (image: { image: HTMLVideoElement }) => Promise<void> }).send({ image: videoRef.current as HTMLVideoElement });
      } catch (error) {
        console.error('Frame processing error:', error);
      }
    };
    
    process();
    animationFrameRef.current = requestAnimationFrame(() => {
      processFrame();
    });
  }, [videoRef]);
  
  // Initialize MediaPipe
  const initializeMediaPipe = useCallback(async () => {
    if (state.isInitialized || state.isLoading) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      const FaceMesh = await loadMediaPipe();
      
      // MediaPipe constructor
      const faceMesh = new (FaceMesh as new (config: unknown) => unknown)({
        locateFile: (file: string) => 
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559220/${file}`
      });
      
      // MediaPipe types
      (faceMesh as { setOptions: (options: unknown) => void }).setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      
      // MediaPipe types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (faceMesh as { onResults: (callback: (results: any) => void) => void }).onResults((results: { multiFaceLandmarks?: Array<Array<{ x: number; y: number; z: number }>> }) => {
        if (results.multiFaceLandmarks?.[0]) {
          const landmarks = results.multiFaceLandmarks[0]
            .filter((_: unknown, i: number) => LIP_LANDMARKS.includes(i))
            .map((landmark: { x: number; y: number; z: number }, idx: number) => ({
              x: landmark.x,
              y: landmark.y,
              z: landmark.z,
              index: LIP_LANDMARKS[idx]
            }));
          setState(prev => ({ ...prev, landmarks }));
        } else {
          setState(prev => ({ ...prev, landmarks: [] }));
        }
      });
      
      faceMeshRef.current = faceMesh;
      setState({
        isInitialized: true,
        isLoading: false,
        error: null,
        landmarks: []
      });
      
    } catch (error) {
      setState({
        isInitialized: false,
        isLoading: false,
        error: 'Failed to initialize MediaPipe',
        landmarks: []
      });
    }
  }, [state.isInitialized, state.isLoading, loadMediaPipe]);
  
  // Control functions
  const startProcessing = useCallback(() => {
    if (state.isInitialized && videoRef.current) {
      processFrame();
    }
  }, [state.isInitialized, processFrame, videoRef]);
  
  const stopProcessing = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = 0;
    }
  }, []);
  
  const cleanup = useCallback(() => {
    stopProcessing();
    // MediaPipe types
    (faceMeshRef.current as { close?: () => void })?.close?.();
    faceMeshRef.current = null;
    setState({
      isInitialized: false,
      isLoading: false,
      error: null,
      landmarks: []
    });
  }, [stopProcessing]);
  
  // Auto-initialize
  useEffect(() => {
    if (videoRef.current) {
      initializeMediaPipe();
    }
    return cleanup;
  }, [videoRef, initializeMediaPipe, cleanup]);
  
  return {
    ...state,
    initialize: initializeMediaPipe,
    startProcessing,
    stopProcessing,
    cleanup
  };
};

// Alternative hook for processing image data (base64)
export const useMediaPipeImageProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  
  const processImage = useCallback(async (imageData: string): Promise<LipLandmark[]> => {
    setIsProcessing(true);
    
    try {
      // In a real implementation, this would send the image to a backend service
      // that uses MediaPipe to process it
      
      // For now, return empty array (placeholder)
      console.log('Processing image with MediaPipe:', imageData.substring(0, 50) + '...');
      return [];
      
    } catch (error) {
      console.error('Error processing image:', error);
      return [];
    } finally {
      setIsProcessing(false);
    }
  }, []);
  
  return {
    isProcessing,
    processImage
  };
};