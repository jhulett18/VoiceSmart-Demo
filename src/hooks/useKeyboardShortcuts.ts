'use client';

import { useEffect, useRef } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';
import { useSpeechEngine } from './useSpeechEngine';
import { useVoiceHelpers } from './useVoiceHelpers';

export function useKeyboardShortcuts() {
  const { currentState, startRecording: storeStartRecording } = useVoiceStore();
  const { canRecord } = useVoiceHelpers();
  const { startRecording, stopRecording } = useSpeechEngine();
  const isSpacePressed = useRef(false);

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

        // Prevent repeat keydown events
        if (isSpacePressed.current) {
          return;
        }

        isSpacePressed.current = true;

        // Start recording if we can and aren't already
        if (canRecord && currentState === 'IDLE') {
          storeStartRecording();
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

        // Reset space pressed flag
        isSpacePressed.current = false;

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
  }, [canRecord, currentState, storeStartRecording, startRecording, stopRecording]);

  // Return keyboard status for UI feedback
  return {
    isSpacebarSupported: true,
    shortcutText: 'Hold spacebar to talk'
  };
}