
import React from 'react';

type ConnectionStatusProps = {
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
};

const ConnectionStatus = ({ status }: ConnectionStatusProps) => {
  const getColor = () => {
    switch (status) {
      case 'connected': return 'bg-green-500';
      case 'disconnected': return 'bg-red-500';
      case 'error': return 'bg-yellow-500';
      case 'connecting': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full border border-white/10 backdrop-blur-sm">
      <div className={`w-2 h-2 rounded-full ${getColor()} animate-pulse`} />
      <span className="text-xs font-medium capitalize text-white/90">
        {status}
      </span>
    </div>
  );
};

export default ConnectionStatus;
