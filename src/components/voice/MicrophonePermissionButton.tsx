'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, AlertTriangle } from 'lucide-react';
import { useVoiceStore } from '@/stores/voiceStore';

export function MicrophonePermissionButton() {
  const { 
    microphonePermission, 
    speechRecognitionSupported,
    requestMicrophonePermission 
  } = useVoiceStore();

  // Don't show if speech recognition isn't supported at all
  if (!speechRecognitionSupported) {
    return (
      <div className="text-center space-y-2">
        <div className="text-sm text-red-600">❌ Speech recognition not supported in this browser</div>
        <div className="text-xs text-muted-foreground">Try using Chrome or Edge for full support</div>
      </div>
    );
  }

  // Don't show if permission is already granted
  if (microphonePermission === 'granted') {
    return null;
  }

  const getButtonContent = () => {
    switch (microphonePermission) {
      case 'requesting':
        return (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Requesting Access...
          </>
        );
      case 'denied':
        return (
          <>
            <AlertTriangle className="w-5 h-5" />
            Microphone Blocked - Try Again
          </>
        );
      default:
        return (
          <>
            <Mic className="w-5 h-5" />
            Allow Microphone Access
          </>
        );
    }
  };

  const getButtonVariant = () => {
    switch (microphonePermission) {
      case 'denied':
        return 'destructive' as const;
      case 'requesting':
        return 'secondary' as const;
      default:
        return 'default' as const;
    }
  };

  return (
    <div className="space-y-4">
      <Button
        variant={getButtonVariant()}
        onClick={requestMicrophonePermission}
        disabled={microphonePermission === 'requesting'}
        className="w-full h-14 text-base font-medium"
      >
        {getButtonContent()}
      </Button>

      <div className="text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          {microphonePermission === 'denied' 
            ? 'Microphone access was blocked. Please check your browser settings.'
            : 'Click to grant microphone permission for voice features.'
          }
        </p>
        
        {microphonePermission === 'denied' && (
          <div className="text-xs text-muted-foreground space-y-1">
            <p><strong>Chrome/Edge:</strong> Click the microphone icon in the address bar</p>
            <p><strong>Firefox:</strong> Look for permission popup at the top</p>
            <p><strong>Safari:</strong> Check Settings → Websites → Microphone</p>
          </div>
        )}
      </div>
    </div>
  );
}