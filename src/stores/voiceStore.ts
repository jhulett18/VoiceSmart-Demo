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
  metrics?: {
    processingTime: number;
    responseTime: number;
    voiceQuality: number;
    transcriptConfidence: number;
    resolved: boolean;
  };
}

interface VoiceMetrics {
  sessionStartTime: Date | null;
  totalInteractions: number;
  successfulInteractions: number;
  avgResponseTime: number;
  avgProcessingTime: number;
  voiceQualityScore: number;
  transcriptAccuracy: number;
  currentInteractionStart: Date | null;
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
  
  // Metrics
  metrics: VoiceMetrics;
  
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
  
  // Metrics Actions
  initializeSession: () => void;
  updateVoiceQuality: (quality: number) => void;
  updateTranscriptAccuracy: (accuracy: number) => void;
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
  metrics: {
    sessionStartTime: null,
    totalInteractions: 0,
    successfulInteractions: 0,
    avgResponseTime: 0,
    avgProcessingTime: 0,
    voiceQualityScore: 95,
    transcriptAccuracy: 95,
    currentInteractionStart: null,
  },
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
        error: null,
        metrics: {
          ...state.metrics,
          currentInteractionStart: new Date(),
          sessionStartTime: state.metrics.sessionStartTime || new Date()
        }
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
      // Calculate interaction metrics
      const now = new Date();
      const interactionTime = state.metrics.currentInteractionStart 
        ? now.getTime() - state.metrics.currentInteractionStart.getTime()
        : 0;
      
      const processingTime = Math.floor(Math.random() * 2000 + 500); // Mock processing time
      const responseTime = interactionTime;
      const voiceQuality = Math.floor(Math.random() * 10 + 90); // 90-100%
      const transcriptConfidence = Math.floor(Math.random() * 15 + 85); // 85-100%
      
      // Save the completed exchange to history with metrics
      const exchange: ConversationExchange = {
        id: Math.random().toString(36).substring(7),
        userMessage: state.transcript,
        assistantResponse: state.currentResponse,
        timestamp: now,
        metrics: {
          processingTime,
          responseTime,
          voiceQuality,
          transcriptConfidence,
          resolved: true // Assume resolved for demo
        }
      };
      
      // Update session metrics
      const newTotalInteractions = state.metrics.totalInteractions + 1;
      const newSuccessfulInteractions = state.metrics.successfulInteractions + 1;
      const newAvgResponseTime = Math.floor(
        (state.metrics.avgResponseTime * state.metrics.totalInteractions + responseTime) / newTotalInteractions
      );
      const newAvgProcessingTime = Math.floor(
        (state.metrics.avgProcessingTime * state.metrics.totalInteractions + processingTime) / newTotalInteractions
      );
      
      set({
        currentState: 'IDLE',
        currentResponse: '',
        transcript: '',
        interimTranscript: '',
        conversationHistory: [...state.conversationHistory, exchange],
        metrics: {
          ...state.metrics,
          totalInteractions: newTotalInteractions,
          successfulInteractions: newSuccessfulInteractions,
          avgResponseTime: newAvgResponseTime,
          avgProcessingTime: newAvgProcessingTime,
          currentInteractionStart: null
        }
      });
    } else if (state.currentState === 'RESPONDING') {
      // If no transcript/response, just go back to idle
      set({
        currentState: 'IDLE',
        currentResponse: '',
        transcript: '',
        interimTranscript: '',
        metrics: {
          ...state.metrics,
          currentInteractionStart: null
        }
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
  }),
  
  // Metrics Actions
  initializeSession: () => set((state) => ({
    metrics: {
      ...state.metrics,
      sessionStartTime: new Date(),
      totalInteractions: 0,
      successfulInteractions: 0,
      avgResponseTime: 0,
      avgProcessingTime: 0,
    }
  })),
  
  updateVoiceQuality: (quality) => set((state) => ({
    metrics: {
      ...state.metrics,
      voiceQualityScore: quality
    }
  })),
  
  updateTranscriptAccuracy: (accuracy) => set((state) => ({
    metrics: {
      ...state.metrics,
      transcriptAccuracy: accuracy
    }
  }))
}));