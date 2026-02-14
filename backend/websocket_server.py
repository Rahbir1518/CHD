import os
from typing import List
from fastapi import WebSocket, WebSocketDisconnect

class ConnectionManager:
    """Manages WebSocket connections from phones (camera sources)."""
    def __init__(self):
        # Allow multiple phones? For now, we'll just track them all.
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"📱 Phone connected. Total source connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"📱 Phone disconnected. Total source connections: {len(self.active_connections)}")

class ViewerManager:
    """Manages WebSocket connections from dashboards (viewers)."""
    def __init__(self):
        self.viewers: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.viewers.append(websocket)
        print(f"👁️  Dashboard viewer connected. Total viewers: {len(self.viewers)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.viewers:
            self.viewers.remove(websocket)
        print(f"👁️  Dashboard viewer disconnected. Total viewers: {len(self.viewers)}")

    async def broadcast(self, data: dict):
        """Send data (JSON with frame_base64) to all connected viewers."""
        if not self.viewers:
            return
            
        disconnected = []
        for viewer in self.viewers:
            try:
                await viewer.send_json(data)
            except Exception:
                disconnected.append(viewer)
        
        for v in disconnected:
            self.disconnect(v)
