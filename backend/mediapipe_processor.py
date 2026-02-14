import cv2
import mediapipe as mp
import base64
import numpy as np
from typing import List, Dict, Tuple, Optional


class MediaPipeProcessor:
    """Processes video frames using MediaPipe Face Mesh to extract lip landmarks."""
    
    # Key lip landmark indices as per MediaPipe Face Mesh
    LIP_LANDMARKS = [0, 13, 14, 78, 308]  # Cupid's bow, inner lip top/bottom, outer corners
    
    def __init__(self):
        """Initialize MediaPipe Face Mesh detector."""
        try:
            # Try the new API first
            self.BaseOptions = mp.tasks.BaseOptions
            self.FaceLandmarker = mp.tasks.vision.FaceLandmarker
            self.FaceLandmarkerOptions = mp.tasks.vision.FaceLandmarkerOptions
            self.VisionRunningMode = mp.tasks.vision.RunningMode
            
            # Create FaceLandmarker instance
            options = self.FaceLandmarkerOptions(
                base_options=self.BaseOptions(),
                running_mode=self.VisionRunningMode.IMAGE,
                num_faces=1,
                min_face_detection_confidence=0.5,
                min_face_presence_confidence=0.5,
                min_tracking_confidence=0.5
            )
            
            self.face_landmarker = self.FaceLandmarker.create_from_options(options)
            self.use_new_api = True
            
        except Exception as e:
            print(f"New API failed: {e}, falling back to legacy API")
            # Fallback to legacy API
            try:
                self.mp_face_mesh = mp.solutions.face_mesh
                self.face_mesh = self.mp_face_mesh.FaceMesh(
                    static_image_mode=True,
                    max_num_faces=1,
                    refine_landmarks=True,
                    min_detection_confidence=0.5
                )
                self.use_new_api = False
            except Exception as e2:
                print(f"Legacy API also failed: {e2}")
                # Create dummy processor that returns empty landmarks
                self.use_new_api = None
                print("MediaPipe initialization failed, using dummy processor")
    
    def decode_frame(self, frame_data: str) -> Optional[np.ndarray]:
        """Decode base64 frame data to OpenCV image."""
        try:
            # Remove data URL prefix if present
            if frame_data.startswith('data:image'):
                frame_data = frame_data.split(',')[1]
            
            # Decode base64
            frame_bytes = base64.b64decode(frame_data)
            frame_array = np.frombuffer(frame_bytes, dtype=np.uint8)
            frame = cv2.imdecode(frame_array, cv2.IMREAD_COLOR)
            return frame
        except Exception as e:
            print(f"Error decoding frame: {e}")
            return None
    
    def encode_frame(self, frame: np.ndarray) -> str:
        """Encode OpenCV image to base64 string."""
        try:
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
            frame_base64 = base64.b64encode(buffer).decode('utf-8')
            return frame_base64
        except Exception as e:
            print(f"Error encoding frame: {e}")
            return ""
    
    def extract_lip_landmarks(self, frame: np.ndarray) -> List[Dict[str, float]]:
        """Extract lip landmarks from frame using MediaPipe."""
        landmarks = []
        
        if self.use_new_api is None:
            # Dummy processor - return empty landmarks
            return landmarks
        
        # Convert BGR to RGB
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        try:
            if self.use_new_api:
                # New API
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
                face_landmarker_result = self.face_landmarker.detect(mp_image)
                
                if face_landmarker_result.face_landmarks:
                    # Get the first face
                    face_landmarks = face_landmarker_result.face_landmarks[0]
                    
                    # Extract lip landmarks
                    for idx in self.LIP_LANDMARKS:
                        if idx < len(face_landmarks):
                            landmark = face_landmarks[idx]
                            landmarks.append({
                                'x': landmark.x,
                                'y': landmark.y,
                                'z': landmark.z,
                                'index': idx
                            })
            else:
                # Legacy API
                results = self.face_mesh.process(rgb_frame)
                
                if results.multi_face_landmarks:
                    for face_landmarks in results.multi_face_landmarks:
                        for idx in self.LIP_LANDMARKS:
                            if idx < len(face_landmarks.landmark):
                                landmark = face_landmarks.landmark[idx]
                                landmarks.append({
                                    'x': landmark.x,
                                    'y': landmark.y,
                                    'z': landmark.z,
                                    'index': idx
                                })
        except Exception as e:
            print(f"Error in face landmark detection: {e}")
        
        return landmarks
    
    def process_frame(self, frame_data: str) -> Dict:
        """Process a frame: decode, extract landmarks, re-encode."""
        # Decode frame
        frame = self.decode_frame(frame_data)
        if frame is None:
            return {'error': 'Failed to decode frame'}
        
        # Extract lip landmarks
        landmarks = self.extract_lip_landmarks(frame)
        
        # Re-encode frame (could add annotations here)
        processed_frame_base64 = self.encode_frame(frame)
        
        return {
            'frame_base64': processed_frame_base64,
            'landmarks': landmarks,
            'landmark_count': len(landmarks)
        }
    
    def annotate_frame(self, frame: np.ndarray, landmarks: List[Dict[str, float]]) -> np.ndarray:
        """Draw lip landmarks on frame for visualization."""
        if not landmarks:
            return frame
        
        # Convert to RGB for drawing
        annotated_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        height, width = annotated_frame.shape[:2]
        
        # Draw landmarks
        for landmark in landmarks:
            x = int(landmark['x'] * width)
            y = int(landmark['y'] * height)
            
            # Different colors for different landmarks
            if landmark['index'] == 0:  # Cupid's bow - red
                color = (255, 0, 0)
            elif landmark['index'] in [13, 14]:  # Inner lip - green
                color = (0, 255, 0)
            else:  # Outer corners - blue
                color = (0, 0, 255)
            
            cv2.circle(annotated_frame, (x, y), 3, color, -1)
            cv2.putText(annotated_frame, str(landmark['index']), 
                       (x+5, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)
        
        # Convert back to BGR
        return cv2.cvtColor(annotated_frame, cv2.COLOR_RGB2BGR)
    
    def close(self):
        """Clean up MediaPipe resources."""
        try:
            if self.use_new_api and hasattr(self, 'face_landmarker'):
                self.face_landmarker.close()
            elif not self.use_new_api and hasattr(self, 'face_mesh'):
                self.face_mesh.close()
        except Exception as e:
            print(f"Error closing MediaPipe: {e}")


# Utility function for standalone use
def process_frame_with_mediapipe(frame_data: str) -> Dict:
    """Convenience function to process a frame with MediaPipe."""
    processor = MediaPipeProcessor()
    try:
        result = processor.process_frame(frame_data)
        return result
    finally:
        processor.close()
