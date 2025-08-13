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
  
  // Computed Properties
  canRecord: boolean;
  isActive: boolean;
  statusMessage: string;
  
  // Actions
  setBusiness: (business: BusinessPersona) => void;
  setCapabilities: (recognition: boolean, synthesis: boolean) => void;
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
  
  // Computed Properties
  get canRecord() {
    const state = get();
    return state.currentState === 'IDLE' && 
           state.speechRecognitionSupported && 
           state.business !== null &&
           state.error === null;
  },
  
  get isActive() {
    const state = get();
    return state.currentState !== 'IDLE' && state.currentState !== 'ERROR';
  },
  
  get statusMessage() {
    const state = get();
    switch (state.currentState) {
      case 'IDLE':
        if (state.error) return 'Error occurred - Ready to try again';
        if (!state.speechRecognitionSupported) return 'Microphone not supported';
        if (!state.speechSynthesisSupported) return 'Speaker not supported';
        if (!state.business) return 'No business selected';
        return 'Ready to listen';
      case 'RECORDING':
        return 'Listening... Speak now';
      case 'PROCESSING':
        return 'Processing your message...';
      case 'RESPONDING':
        return 'Assistant is speaking...';
      case 'ERROR':
        return state.error || 'Something went wrong';
      default:
        return 'Unknown state';
    }
  },
  
  // Actions
  setBusiness: (business) => set({ business }),
  
  setCapabilities: (recognition, synthesis) => set({
    speechRecognitionSupported: recognition,
    speechSynthesisSupported: synthesis
  }),
  
  startRecording: () => {
    const state = get();
    if (state.canRecord) {
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