import cv2
import base64
import time
import asyncio
import websockets
import json

def create_test_frame():
    """Create a simple test frame with some visual elements"""
    # Create a black image
    frame = cv2.imread('test_image.jpg') if cv2.haveImageReader('test_image.jpg') else None
    
    if frame is None:
        # Create a simple colored frame
        frame = cv2.imread('test_image.png') if cv2.haveImageReader('test_image.png') else None
        
    if frame is None:
        # Create a synthetic frame
        import numpy as np
        frame = np.zeros((480, 640, 3), dtype=np.uint8)
        # Add some colored rectangles
        cv2.rectangle(frame, (50, 50), (200, 150), (255, 0, 0), -1)  # Blue
        cv2.rectangle(frame, (250, 50), (400, 150), (0, 255, 0), -1)  # Green
        cv2.rectangle(frame, (450, 50), (600, 150), (0, 0, 255), -1)  # Red
        cv2.putText(frame, "TEST STREAM", (200, 250), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)
        cv2.putText(frame, time.strftime("%H:%M:%S"), (250, 300), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    
    # Encode to base64
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
    frame_base64 = base64.b64encode(buffer).decode('utf-8')
    return frame_base64

async def test_video_stream():
    """Test sending video frames to the backend"""
    uri = "ws://localhost:8000/ws/video"
    
    try:
        async with websockets.connect(uri) as websocket:
            print(f"Connected to {uri}")
            
            # Send test frames
            for i in range(30):  # Send 30 frames
                frame_data = create_test_frame()
                
                # Send as JSON
                message = json.dumps({
                    "frame_base64": frame_data,
                    "timestamp": time.time(),
                    "frame_number": i
                })
                
                await websocket.send(message)
                print(f"Sent frame {i}")
                
                # Wait a bit between frames
                await asyncio.sleep(0.1)
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    print("Testing video stream...")
    asyncio.run(test_video_stream())