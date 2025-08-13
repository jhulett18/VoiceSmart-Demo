import { create } from 'zustand';
import { BusinessPersona } from '@/types';

// Voice State Machine
export type VoiceState = 
  | 'IDLE'       // Ready for input
  | 'RECORDING'  // Mic active, user speaking
  | 'PROCESSING' // Sending to LLM
  | 'RESPONDING' // Bot speaking
  | 'ERROR';     // Error state with recovery

interface VoiceStore {
  // Core State
  currentState: VoiceState;
  business: BusinessPersona | null;
  transcript: string;
  interimTranscript: string;
  currentResponse: string;
  error: string | null;
  
  // Capabilities
  speechRecognitionSupported: boolean;
  speechSynthesisSupported: boolean;
  microphonePermission: 'unknown' | 'granted' | 'denied' | 'requesting';
  
  // Computed Properties (will be calculated in components)
  // canRecord: boolean;
  // isActive: boolean;
  // statusMessage: string;
  
  // Actions
  setBusiness: (business: BusinessPersona) => void;
  setCapabilities: (recognition: boolean, synthesis: boolean) => void;
  requestMicrophonePermission: () => Promise<void>;
  setMicrophonePermission: (permission: 'unknown' | 'granted' | 'denied' | 'requesting') => void;
  startRecording: () => void;
  stopRecording: () => void;
  updateTranscript: (transcript: string, interim: string) => void;
  startProcessing: () => void;
  startResponding: (response: string) => void;
  finishResponding: () => void;
  setError: (error: string) => void;
  reset: () => void;
  clearError: () => void;
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  // Initial State
  currentState: 'IDLE',
  business: null,
  transcript: '',
  interimTranscript: '',
  currentResponse: '',
  error: null,
  speechRecognitionSupported: false,
  speechSynthesisSupported: false,
  microphonePermission: 'unknown',
  
  // Actions
  setBusiness: (business) => set({ business }),
  
  setCapabilities: (recognition, synthesis) => set({
    speechRecognitionSupported: recognition,
    speechSynthesisSupported: synthesis
  }),
  
  setMicrophonePermission: (permission) => set({
    microphonePermission: permission
  }),
  
  requestMicrophonePermission: async () => {
    set({ microphonePermission: 'requesting', error: null });
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop the stream immediately as we just needed permission
      stream.getTracks().forEach(track => track.stop());
      
      set({ microphonePermission: 'granted', error: null });
    } catch (error) {
      console.error('Microphone permission denied:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      set({ 
        microphonePermission: 'denied',
        error: `Microphone access error: ${errorMessage}. Please check your browser settings.`
      });
    }
  },
  
  startRecording: () => {
    const state = get();
    const canRecord = state.currentState === 'IDLE' && 
                     state.speechRecognitionSupported && 
                     state.microphonePermission === 'granted' &&
                     state.business !== null &&
                     state.error === null;
    
    if (canRecord) {
      set({
        currentState: 'RECORDING',
        transcript: '',
        interimTranscript: '',
        error: null
      });
    }
  },
  
  stopRecording: () => {
    const state = get();
    if (state.currentState === 'RECORDING') {
      set({ currentState: 'IDLE' });
    }
  },
  
  updateTranscript: (transcript, interim) => {
    const state = get();
    if (state.currentState === 'RECORDING') {
      set({
        transcript,
        interimTranscript: interim
      });
    }
  },
  
  startProcessing: () => {
    const state = get();
    if (state.currentState === 'RECORDING' || state.currentState === 'IDLE') {
      set({
        currentState: 'PROCESSING',
        interimTranscript: '' // Clear interim when processing
      });
    }
  },
  
  startResponding: (response) => {
    const state = get();
    if (state.currentState === 'PROCESSING') {
      set({
        currentState: 'RESPONDING',
        currentResponse: response
      });
    }
  },
  
  finishResponding: () => {
    const state = get();
    if (state.currentState === 'RESPONDING') {
      set({
        currentState: 'IDLE',
        currentResponse: '',
        transcript: '',
        interimTranscript: ''
      });
    }
  },
  
  setError: (error) => set({
    currentState: 'ERROR',
    error,
    interimTranscript: ''
  }),
  
  clearError: () => {
    const state = get();
    if (state.currentState === 'ERROR') {
      set({
        currentState: 'IDLE',
        error: null,
        transcript: '',
        interimTranscript: '',
        currentResponse: ''
      });
    }
  },
  
  reset: () => set({
    currentState: 'IDLE',
    transcript: '',
    interimTranscript: '',
    currentResponse: '',
    error: null
  })
}));