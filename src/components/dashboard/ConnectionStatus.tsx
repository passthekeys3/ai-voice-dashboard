'use client';

import { Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ConnectionStatus as ConnectionStatusType } from '@/types/realtime';

interface ConnectionStatusProps {
  status: ConnectionStatusType;
  className?: string;
  showLabel?: boolean;
}

export function ConnectionStatus({
  status,
  className,
  showLabel = true,
}: ConnectionStatusProps) {
  const getStatusColor = () => {
    if (status.connected) return 'text-green-500';
    if (status.reconnecting) return 'text-yellow-500';
    if (status.error) return 'text-red-500';
    return 'text-gray-400';
  };

  const getStatusText = () => {
    if (status.connected) return 'Live';
    if (status.reconnecting) return 'Reconnecting...';
    if (status.error) return 'Disconnected';
    return 'Connecting...';
  };

  const getIcon = () => {
    if (status.reconnecting) {
      return <Loader2 className="h-4 w-4 animate-spin" />;
    }
    if (status.connected) {
      return <Wifi className="h-4 w-4" />;
    }
    return <WifiOff className="h-4 w-4" />;
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-sm',
        getStatusColor(),
        className
      )}
      title={
        status.lastConnected
          ? `Last connected: ${status.lastConnected.toLocaleTimeString()}`
          : undefined
      }
    >
      {status.connected && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
      )}
      {!status.connected && getIcon()}
      {showLabel && <span className="font-medium">{getStatusText()}</span>}
    </div>
  );
}
