'use client';

import React, { useEffect } from 'react';
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
import { TranscriptDisplay } from './TranscriptDisplay';
import { VoiceControls } from './VoiceControls';
import { MicrophonePermissionButton } from './MicrophonePermissionButton';
import { DebugPanel } from './DebugPanel';

interface VoiceContainerProps {
  business: BusinessPersona;
}

export function VoiceContainer({ business }: VoiceContainerProps) {
  const { setBusiness, currentState, transcript, microphonePermission, speechRecognitionSupported } = useVoiceStore();
  const { shortcutText } = useKeyboardShortcuts();
  const { processVoiceInput } = useVoiceAPI();

  // Initialize speech engine (sets up capabilities)
  useSpeechEngine();

  // Set the business context when component mounts
  useEffect(() => {
    setBusiness(business);
  }, [business, setBusiness]);

  // Handle state transitions to processing
  useEffect(() => {
    if (currentState === 'PROCESSING' && transcript.trim()) {
      processVoiceInput();
    }
  }, [currentState, transcript, processVoiceInput]);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Main Voice Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Voice Assistant
          </CardTitle>
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

      {/* Transcript Display */}
      <TranscriptDisplay />

      {/* Debug Panel (development only) */}
      <DebugPanel />

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How to Use</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Press and hold the &quot;Push to Talk&quot; button</p>
          <p>2. Speak your question or request clearly</p>
          <p>3. Release the button to send your message</p>
          <p>4. Wait for the assistant to respond</p>
          <p>5. Repeat as needed for your conversation</p>
          <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-950 rounded text-xs">
            <strong>Tip:</strong> You can also hold the spacebar instead of clicking the button
          </div>
        </CardContent>
      </Card>
    </div>
  );
}