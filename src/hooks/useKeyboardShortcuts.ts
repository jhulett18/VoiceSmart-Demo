'use client';

import { useEffect } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';
import { useSpeechEngine } from './useSpeechEngine';

export function useKeyboardShortcuts() {
  const { canRecord, currentState } = useVoiceStore();
  const { startRecording, stopRecording } = useSpeechEngine();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle spacebar for push-to-talk
      if (event.code === 'Space') {
        // Don't interfere if user is typing in an input field
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
          return;
        }

        // Prevent default spacebar behavior (page scroll)
        event.preventDefault();

        // Start recording if we can and aren't already
        if (canRecord && currentState === 'IDLE') {
          startRecording();
        }
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
          return;
        }

        event.preventDefault();

        // Stop recording if we're currently recording
        if (currentState === 'RECORDING') {
          stopRecording();
        }
      }
    };

    // Add event listeners
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keyup', handleKeyUp);
    };
  }, [canRecord, currentState, startRecording, stopRecording]);

  // Return keyboard status for UI feedback
  return {
    isSpacebarSupported: true,
    shortcutText: 'Hold spacebar to talk'
  };
}