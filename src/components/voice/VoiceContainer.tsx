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

interface VoiceContainerProps {
  business: BusinessPersona;
}

export function VoiceContainer({ business }: VoiceContainerProps) {
  const { setBusiness, currentState, transcript } = useVoiceStore();
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

          {/* Push to Talk Button */}
          <PushToTalkButton />

          {/* Keyboard Shortcut Hint */}
          <div className="text-center text-sm text-muted-foreground">
            {shortcutText}
          </div>

          {/* Secondary Controls */}
          <VoiceControls />
        </CardContent>
      </Card>

      {/* Transcript Display */}
      <TranscriptDisplay />

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