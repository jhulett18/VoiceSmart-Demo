import { create } from 'zustand';
import { BusinessPersona } from '@/types';

// Voice State Machine
export type VoiceState = 
  | 'IDLE'       // Ready for input
  | 'RECORDING'  // Mic active, user speaking
  | 'PROCESSING' // Sending to LLM
  | 'RESPONDING' // Bot speaking
  | 'ERROR';     // Error state with recovery

export interface ConversationExchange {
  id: string;
  userMessage: string;
  assistantResponse: string;
  timestamp: Date;
}

interface VoiceStore {
  // Core State
  currentState: VoiceState;
  business: BusinessPersona | null;
  transcript: string;
  interimTranscript: string;
  currentResponse: string;
  error: string | null;
  
  // Conversation History
  conversationHistory: ConversationExchange[];
  
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
  
  // Conversation Actions
  clearConversationHistory: () => void;
}

export const useVoiceStore = create<VoiceStore>((set, get) => ({
  // Initial State
  currentState: 'IDLE',
  business: null,
  transcript: '',
  interimTranscript: '',
  currentResponse: '',
  error: null,
  conversationHistory: [],
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
    if (state.currentState === 'RESPONDING' && state.transcript && state.currentResponse) {
      // Save the completed exchange to history
      const exchange: ConversationExchange = {
        id: Math.random().toString(36).substring(7),
        userMessage: state.transcript,
        assistantResponse: state.currentResponse,
        timestamp: new Date()
      };
      
      set({
        currentState: 'IDLE',
        currentResponse: '',
        transcript: '',
        interimTranscript: '',
        // Add new exchange at the end (bottom) for bottom-to-top ordering
        conversationHistory: [...state.conversationHistory, exchange]
      });
    } else if (state.currentState === 'RESPONDING') {
      // If no transcript/response, just go back to idle
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
  }),
  
  clearConversationHistory: () => set({
    conversationHistory: []
  })
}));