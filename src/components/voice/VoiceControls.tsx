'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { RotateCcw, VolumeX } from 'lucide-react';
import { useVoiceStore } from '@/stores/voiceStore';
import { useSpeechEngine } from '@/hooks/useSpeechEngine';

export function VoiceControls() {
  const { reset, clearError, currentState } = useVoiceStore();
  const { cancelSpeech } = useSpeechEngine();

  const handleReset = () => {
    cancelSpeech();
    reset();
    clearError();
  };

  const handleStopSpeaking = () => {
    if (currentState === 'RESPONDING') {
      cancelSpeech();
    }
  };

  return (
    <div className="flex gap-2 justify-center">
      <Button
        variant="outline"
        size="sm"
        onClick={handleReset}
        className="flex items-center gap-2"
      >
        <RotateCcw className="w-4 h-4" />
        Reset
      </Button>

      {currentState === 'RESPONDING' && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleStopSpeaking}
          className="flex items-center gap-2"
        >
          <VolumeX className="w-4 h-4" />
          Stop Speaking
        </Button>
      )}
    </div>
  );
}