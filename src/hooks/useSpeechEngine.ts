'use client';

import { useEffect, useRef } from 'react';
import { useVoiceStore } from '@/stores/voiceStore';

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  addEventListener(type: 'result', listener: (event: SpeechRecognitionEvent) => void): void;
  addEventListener(type: 'error', listener: (event: SpeechRecognitionErrorEvent) => void): void;
  addEventListener(type: 'start' | 'end' | 'soundstart' | 'soundend' | 'speechstart' | 'speechend', listener: () => void): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useSpeechEngine() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const synthesisRef = useRef<SpeechSynthesisUtterance | null>(null);
  const userCancelledRef = useRef<boolean>(false);
  const speechStartedRef = useRef<boolean>(false);
  
  const {
    setCapabilities,
    updateTranscript,
    startProcessing,
    setError,
    stopRecording,
    startResponding,
    finishResponding,
    setMicrophonePermission
  } = useVoiceStore();

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const speechSynthesisSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    
    setCapabilities(!!SpeechRecognition, speechSynthesisSupported);
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.addEventListener('result', (event: SpeechRecognitionEvent) => {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        updateTranscript(finalTranscript, interimTranscript);
        
        // If we got a final result, start processing
        if (finalTranscript.trim()) {
          startProcessing();
        }
      });

      recognition.addEventListener('error', (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setError(`Speech recognition error: ${event.error}`);
      });

      recognition.addEventListener('end', () => {
        stopRecording();
      });

      recognitionRef.current = recognition;
    }

    // Check initial microphone permission status
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        setMicrophonePermission(result.state === 'granted' ? 'granted' : 
                                result.state === 'denied' ? 'denied' : 'unknown');
      }).catch((err) => {
        // Permissions API not supported or failed, leave as unknown
        console.warn('Permissions API check failed:', err);
        setMicrophonePermission('unknown');
      });
    } else {
      // No permissions API available
      setMicrophonePermission('unknown');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, [setCapabilities, updateTranscript, startProcessing, setError, stopRecording, setMicrophonePermission]);

  const startRecording = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        setError('Failed to start speech recognition');
      }
    }
  };

  const stopRecordingNow = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  };

  const speak = (text: string) => {
    if (!text.trim() || typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }

    // Cancel any existing speech
    userCancelledRef.current = true; // Mark as user-initiated cancel
    window.speechSynthesis.cancel();
    userCancelledRef.current = false; // Reset for new speech

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    utterance.addEventListener('start', () => {
      speechStartedRef.current = true;
      startResponding(text);
    });

    utterance.addEventListener('end', () => {
      speechStartedRef.current = false;
      // Only finish responding if not cancelled by user
      if (!userCancelledRef.current) {
        finishResponding();
      }
    });

    // Removed error event listener entirely - speech synthesis errors are mostly
    // browser quirks during cancellation. Real issues like API errors are handled elsewhere.

    synthesisRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const cancelSpeech = () => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      // Mark as user-initiated cancellation
      userCancelledRef.current = true;
      speechStartedRef.current = false;
      
      // Cancel the speech synthesis
      window.speechSynthesis.cancel();
      
      // Clean up state - transition back to IDLE and ready for next input
      finishResponding();
      
      // Reset the cancellation flag - shorter delay since no error events to worry about
      setTimeout(() => {
        userCancelledRef.current = false;
      }, 50);
    }
  };

  return {
    startRecording,
    stopRecording: stopRecordingNow,
    speak,
    cancelSpeech
  };
}