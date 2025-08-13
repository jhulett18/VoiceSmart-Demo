import { useVoiceStore } from '@/stores/voiceStore';

export function useVoiceHelpers() {
  const state = useVoiceStore();
  
  const canRecord = state.currentState === 'IDLE' && 
                   state.speechRecognitionSupported && 
                   state.microphonePermission === 'granted' &&
                   state.business !== null &&
                   state.error === null;
  
  const isActive = state.currentState !== 'IDLE' && state.currentState !== 'ERROR';
  
  const statusMessage = (() => {
    switch (state.currentState) {
      case 'IDLE':
        if (state.error) return 'Error occurred - Ready to try again';
        if (!state.speechRecognitionSupported) return 'Microphone not supported';
        if (!state.speechSynthesisSupported) return 'Speaker not supported';
        if (state.microphonePermission === 'denied') return 'Microphone access denied';
        if (state.microphonePermission === 'requesting') return 'Requesting microphone access...';
        if (state.microphonePermission !== 'granted') return 'Microphone permission needed';
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
  })();

  return {
    canRecord,
    isActive,
    statusMessage
  };
}