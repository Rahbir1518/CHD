import { useState, useEffect, useRef, useCallback } from 'react';

interface SocketHookOptions {
  url: string;
  autoConnect?: boolean;
  reconnectAttempts?: number;
  reconnectDelay?: number;
}

interface SocketState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

export const useSocket = (options: SocketHookOptions) => {
  const [state, setState] = useState<SocketState>({
    isConnected: false,
    isConnecting: false,
    error: null
  });
  
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const connectRef = useRef<(() => void) | undefined>(undefined);
  
  const { 
    url, 
    autoConnect = true, 
    reconnectAttempts = 5, 
    reconnectDelay = 3000 
  } = options;
  
  // Connect to WebSocket
  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }
    
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    
    try {
      const socket = new WebSocket(url);
      socketRef.current = socket;
      
      socket.onopen = () => {
        setState({
          isConnected: true,
          isConnecting: false,
          error: null
        });
        reconnectAttemptsRef.current = 0;
        console.log(`🔌 Connected to ${url}`);
      };
      
      socket.onclose = (event) => {
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false
        }));
        
        console.log(`🔌 Disconnected from ${url}`, event.reason);
        
        // Attempt reconnection if not closed intentionally
        if (!event.wasClean && reconnectAttemptsRef.current < reconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          console.log(`🔁 Reconnection attempt ${reconnectAttemptsRef.current}/${reconnectAttempts}`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            // Use the connect function reference
            if (connectRef.current) {
              connectRef.current();
            }
          }, reconnectDelay);
        }
      };
      
      socket.onerror = (error) => {
        setState(prev => ({
          ...prev,
          error: 'WebSocket connection error',
          isConnecting: false
        }));
        console.error('WebSocket error:', error);
      };
      
    } catch (error) {
      setState({
        isConnected: false,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Connection failed'
      });
    }
  }, [url, reconnectAttempts, reconnectDelay]);
  
  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (socketRef.current) {
      socketRef.current.close(1000, 'Client disconnect');
      socketRef.current = null;
    }
    
    setState({
      isConnected: false,
      isConnecting: false,
      error: null
    });
  }, []);
  
  // Send message
  const sendMessage = useCallback((data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data));
    } else {
      console.warn('Cannot send message - socket not connected');
    }
  }, []);
  
  // Listen for messages
  const onMessage = useCallback((handler: (data: any) => void) => {
    if (socketRef.current) {
      const listener = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          handler(data);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
      
      socketRef.current.addEventListener('message', listener);
      
      // Return cleanup function
      return () => {
        socketRef.current?.removeEventListener('message', listener);
      };
    }
    
    return () => {};
  }, []);
  
  // Auto-connect effect
  useEffect(() => {
    // Store connect function reference
    connectRef.current = connect;
    
    if (autoConnect) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);
  
  return {
    ...state,
    connect,
    disconnect,
    sendMessage,
    onMessage,
    get socket() {
      return socketRef.current;
    }
  };
};

// Specific hooks for different socket types
export const useVideoSocket = (autoConnect = true) => {
  return useSocket({
    url: 'ws://localhost:8000/ws/video',
    autoConnect
  });
};

export const useViewerSocket = (autoConnect = true) => {
  return useSocket({
    url: 'ws://localhost:8000/ws/viewer',
    autoConnect
  });
};
