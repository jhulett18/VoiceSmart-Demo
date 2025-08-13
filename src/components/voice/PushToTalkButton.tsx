'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { useVoiceStore } from '@/stores/voiceStore';
import { useSpeechEngine } from '@/hooks/useSpeechEngine';
import { useVoiceHelpers } from '@/hooks/useVoiceHelpers';

export function PushToTalkButton() {
  const { 
    currentState,
    startRecording: storeStartRecording 
  } = useVoiceStore();
  
  const { canRecord } = useVoiceHelpers();
  const { startRecording, stopRecording } = useSpeechEngine();

  const handleMouseDown = () => {
    if (canRecord) {
      storeStartRecording();
      startRecording();
    }
  };

  const handleMouseUp = () => {
    if (currentState === 'RECORDING') {
      stopRecording();
    }
  };

  const handleMouseLeave = () => {
    // Stop recording if mouse leaves button while recording
    if (currentState === 'RECORDING') {
      handleMouseUp();
    }
  };

  const getButtonVariant = () => {
    switch (currentState) {
      case 'RECORDING':
        return 'destructive' as const;
      case 'PROCESSING':
      case 'RESPONDING':
        return 'secondary' as const;
      default:
        return 'default' as const;
    }
  };

  const getButtonContent = () => {
    switch (currentState) {
      case 'RECORDING':
        return (
          <>
            <MicOff className="w-6 h-6" />
            Release to Send
          </>
        );
      case 'PROCESSING':
        return (
          <>
            <Loader2 className="w-6 h-6 animate-spin" />
            Processing...
          </>
        );
      case 'RESPONDING':
        return (
          <>
            <Loader2 className="w-6 h-6 animate-spin" />
            Speaking...
          </>
        );
      case 'ERROR':
        return (
          <>
            <Mic className="w-6 h-6" />
            Try Again
          </>
        );
      default:
        return (
          <>
            <Mic className="w-6 h-6" />
            Push to Talk
          </>
        );
    }
  };

  const isDisabled = !canRecord || currentState === 'PROCESSING' || currentState === 'RESPONDING';

  return (
    <Button
      variant={getButtonVariant()}
      size="lg"
      className={`
        w-full h-20 text-lg font-semibold transition-all duration-200
        ${currentState === 'RECORDING' ? 'scale-95 shadow-lg' : ''}
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105'}
      `}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      disabled={isDisabled}
    >
      <div className="flex flex-col items-center gap-2">
        {getButtonContent()}
      </div>
    </Button>
  );
}