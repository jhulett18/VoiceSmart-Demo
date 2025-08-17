import { useState, useRef, useCallback } from 'react';

interface UseSimpleVoiceProps {
  onTranscriptChange?: (transcript: string) => void;
  onResponse?: (response: string) => void;
  onError?: (error: string) => void;
}

interface VoiceState {
  isListening: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  transcript: string;
  response: string;
  error: string | null;
  isSupported: boolean;
  hasPermission: boolean;
}

export function useSimpleVoice({
  onTranscriptChange,
  onResponse,
  onError
}: UseSimpleVoiceProps = {}) {
  const [state, setState] = useState<VoiceState>({
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
    transcript: '',
    response: '',
    error: null,
    isSupported: false,
    hasPermission: false
  });

  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize speech recognition and synthesis
  const initialize = useCallback(async () => {
    // Check for speech recognition support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const speechSynthesis = window.speechSynthesis;

    if (!SpeechRecognition || !speechSynthesis) {
      setState(prev => ({ 
        ...prev, 
        isSupported: false, 
        error: 'Speech recognition or synthesis not supported in this browser' 
      }));
      return false;
    }

    setState(prev => ({ ...prev, isSupported: true }));
    synthRef.current = speechSynthesis;

    // Request microphone permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop immediately after getting permission
      setState(prev => ({ ...prev, hasPermission: true, error: null }));
      return true;
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        hasPermission: false, 
        error: 'Microphone permission denied. Please allow microphone access and try again.' 
      }));
      onError?.('Microphone permission denied');
      return false;
    }
  }, [onError]);

  // Start listening
  const startListening = useCallback(async () => {
    if (!state.isSupported || !state.hasPermission) {
      const initialized = await initialize();
      if (!initialized) return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'en-US';

    recognitionRef.current.onstart = () => {
      setState(prev => ({ ...prev, isListening: true, error: null, transcript: '' }));
    };

    recognitionRef.current.onresult = (event: any) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      const fullTranscript = finalTranscript || interimTranscript;
      setState(prev => ({ ...prev, transcript: fullTranscript }));
      onTranscriptChange?.(fullTranscript);
    };

    recognitionRef.current.onend = () => {
      setState(prev => ({ ...prev, isListening: false }));
    };

    recognitionRef.current.onerror = (event: any) => {
      const errorMessage = `Speech recognition error: ${event.error}`;
      setState(prev => ({ ...prev, isListening: false, error: errorMessage }));
      onError?.(errorMessage);
    };

    try {
      recognitionRef.current.start();
    } catch (error) {
      const errorMessage = 'Failed to start speech recognition';
      setState(prev => ({ ...prev, error: errorMessage }));
      onError?.(errorMessage);
    }
  }, [state.isSupported, state.hasPermission, initialize, onTranscriptChange, onError]);

  // Stop listening
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  // Process transcript with AI
  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim()) return;

    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: transcript }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      const aiResponse = data.reply || 'Sorry, I didn\'t understand that.';
      
      setState(prev => ({ ...prev, response: aiResponse, isProcessing: false }));
      onResponse?.(aiResponse);
      
      return aiResponse;
    } catch (error) {
      const errorMessage = 'Failed to process your request. Please try again.';
      setState(prev => ({ ...prev, isProcessing: false, error: errorMessage }));
      onError?.(errorMessage);
      return null;
    }
  }, [onResponse, onError]);

  // Speak response
  const speak = useCallback((text: string) => {
    if (!synthRef.current || !text.trim()) return;

    // Stop any current speech
    synthRef.current.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.0;
    utterance.volume = 0.8;

    utterance.onstart = () => {
      setState(prev => ({ ...prev, isSpeaking: true }));
    };

    utterance.onend = () => {
      setState(prev => ({ ...prev, isSpeaking: false }));
      currentUtteranceRef.current = null;
    };

    utterance.onerror = () => {
      setState(prev => ({ ...prev, isSpeaking: false }));
      currentUtteranceRef.current = null;
    };

    currentUtteranceRef.current = utterance;
    synthRef.current.speak(utterance);
  }, []);

  // Stop speaking
  const stopSpeaking = useCallback(() => {
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setState(prev => ({ ...prev, isSpeaking: false }));
  }, []);

  // Complete voice interaction (listen, process, speak)
  const handleVoiceInteraction = useCallback(async () => {
    // Start listening
    await startListening();
    
    // We'll process when listening ends
    return new Promise<void>((resolve) => {
      const checkForTranscript = () => {
        if (!state.isListening && state.transcript) {
          processTranscript(state.transcript).then((response) => {
            if (response) {
              speak(response);
            }
            resolve();
          });
        } else if (!state.isListening) {
          resolve();
        } else {
          setTimeout(checkForTranscript, 100);
        }
      };
      checkForTranscript();
    });
  }, [startListening, state.isListening, state.transcript, processTranscript, speak]);

  // Reset state
  const reset = useCallback(() => {
    stopListening();
    stopSpeaking();
    setState(prev => ({ 
      ...prev, 
      transcript: '', 
      response: '', 
      error: null,
      isProcessing: false 
    }));
  }, [stopListening, stopSpeaking]);

  return {
    ...state,
    startListening,
    stopListening,
    processTranscript,
    speak,
    stopSpeaking,
    handleVoiceInteraction,
    reset,
    initialize
  };
}