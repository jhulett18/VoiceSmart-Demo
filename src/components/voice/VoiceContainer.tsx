'use client';

import React, { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone } from 'lucide-react';
import { BusinessPersona } from '@/types';
import { useVoiceStore } from '@/stores/voiceStore';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useSpeechEngine } from '@/hooks/useSpeechEngine';
import { useVoiceAPI } from '@/hooks/useVoiceAPI';

// Import our modular components
import { PushToTalkButton } from './PushToTalkButton';
import { VoiceStatus } from './VoiceStatus';
import { ConversationPreview } from './ConversationPreview';
import { VoiceControls } from './VoiceControls';
import { MicrophonePermissionButton } from './MicrophonePermissionButton';
import { DebugModal } from './DebugModal';
import { InstructionsModal } from './InstructionsModal';
import { AboutBusinessModal } from './AboutBusinessModal';

interface VoiceContainerProps {
  business: BusinessPersona;
}

export function VoiceContainer({ business }: VoiceContainerProps) {
  const { setBusiness, currentState, transcript, microphonePermission, speechRecognitionSupported } = useVoiceStore();
  const { shortcutText } = useKeyboardShortcuts();
  const { processVoiceInput } = useVoiceAPI();
  const processingRef = useRef(false);
  const lastProcessedTranscript = useRef('');

  // Initialize speech engine (sets up capabilities)
  useSpeechEngine();

  // Set the business context when component mounts
  useEffect(() => {
    setBusiness(business);
  }, [business, setBusiness]);

  // Handle state transitions to processing
  useEffect(() => {
    if (currentState === 'PROCESSING' && 
        transcript.trim() && 
        !processingRef.current && 
        transcript !== lastProcessedTranscript.current) {
      processingRef.current = true;
      lastProcessedTranscript.current = transcript;
      processVoiceInput().finally(() => {
        processingRef.current = false;
      });
    }
  }, [currentState, transcript, processVoiceInput]); // Re-added processVoiceInput with processing guard

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Main Voice Interface */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Voice Assistant
            </CardTitle>
            <div className="flex items-center gap-2">
              <AboutBusinessModal />
              <InstructionsModal />
              {/* Debug Modal Button (development only) */}
              <DebugModal />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Display */}
          <VoiceStatus />

          {/* Microphone Permission Button (shows when permission needed) */}
          <MicrophonePermissionButton />

          {/* Push to Talk Button (shows when permission granted) */}
          {microphonePermission === 'granted' && <PushToTalkButton />}

          {/* Debug: Show current permission state */}
          {process.env.NODE_ENV === 'development' && (
            <div className="text-xs text-center text-muted-foreground border border-dashed p-2 rounded">
              Permission: <strong>{microphonePermission}</strong> | 
              Speech: <strong>{speechRecognitionSupported ? 'Yes' : 'No'}</strong>
            </div>
          )}

          {/* Keyboard Shortcut Hint (only when permission granted) */}
          {microphonePermission === 'granted' && (
            <div className="text-center text-sm text-muted-foreground">
              {shortcutText}
              {currentState === 'RECORDING' && (
                <div className="mt-1 text-xs text-blue-600 animate-pulse">
                  Spacebar activated
                </div>
              )}
            </div>
          )}

          {/* Secondary Controls */}
          <VoiceControls />
        </CardContent>
      </Card>

      {/* Current Exchange Display */}
      <ConversationPreview />
    </div>
  );
}