'use client';

import { useCallback } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';
import { useSpeechEngine } from './useSpeechEngine';

export function useVoiceAPI() {
  const { business, transcript, setError } = useVoiceStore();
  const { speak } = useSpeechEngine();

  const processVoiceInput = useCallback(async (inputText?: string) => {
    const textToProcess = inputText || transcript;
    
    if (!textToProcess.trim() || !business) {
      setError('No text to process or business not selected');
      return;
    }

    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: textToProcess,
          businessId: business.id
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.response) {
        speak(data.response);
      } else {
        setError('No response from server');
      }
      
    } catch (error) {
      console.error('Voice API error:', error);
      setError('Failed to process voice input. Please try again.');
      
      // Provide fallback response
      speak("I'm sorry, I encountered an error. Please try speaking again.");
    }
  }, [business, transcript, setError, speak]);

  return {
    processVoiceInput
  };
}