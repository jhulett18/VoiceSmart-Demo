'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mic, 
  Volume2, 
  Loader2, 
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { useVoiceStore } from '@/stores/voiceStore';

export function VoiceStatus() {
  const { 
    currentState, 
    statusMessage, 
    error,
    speechRecognitionSupported,
    speechSynthesisSupported,
    business 
  } = useVoiceStore();

  const getStatusIcon = () => {
    switch (currentState) {
      case 'RECORDING':
        return <Mic className="w-4 h-4 animate-pulse" />;
      case 'PROCESSING':
        return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'RESPONDING':
        return <Volume2 className="w-4 h-4" />;
      case 'ERROR':
        return <AlertCircle className="w-4 h-4" />;
      case 'IDLE':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusVariant = () => {
    switch (currentState) {
      case 'RECORDING':
        return 'destructive' as const;
      case 'PROCESSING':
      case 'RESPONDING':
        return 'secondary' as const;
      case 'ERROR':
        return 'destructive' as const;
      default:
        return 'outline' as const;
    }
  };

  return (
    <div className="space-y-4">
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Main Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant={getStatusVariant()} className="flex items-center gap-2 px-3 py-1">
            {getStatusIcon()}
            {statusMessage}
          </Badge>
        </div>

        {/* Capability Indicators */}
        <div className="flex items-center gap-2">
          {!speechRecognitionSupported && (
            <Badge variant="destructive" className="text-xs">
              No Microphone
            </Badge>
          )}
          {!speechSynthesisSupported && (
            <Badge variant="destructive" className="text-xs">
              No Speaker
            </Badge>
          )}
          {business && (
            <Badge variant="outline" className="text-xs">
              {business.name}
            </Badge>
          )}
        </div>
      </div>

      {/* Recording Indicator */}
      {currentState === 'RECORDING' && (
        <div className="flex items-center justify-center gap-2 text-sm text-red-600 animate-pulse">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
          Recording in progress...
        </div>
      )}
    </div>
  );
}