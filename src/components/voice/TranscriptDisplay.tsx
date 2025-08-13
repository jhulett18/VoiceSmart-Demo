'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { useVoiceStore } from '@/stores/voiceStore';

export function TranscriptDisplay() {
  const { 
    transcript, 
    interimTranscript, 
    currentResponse,
    currentState 
  } = useVoiceStore();

  // Don't show anything if there's no content
  if (!transcript && !interimTranscript && !currentResponse) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardContent className="p-4 space-y-4">
        {/* User Transcript */}
        {(transcript || interimTranscript) && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              You said:
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-sm">
                <span className="text-foreground">{transcript}</span>
                {interimTranscript && (
                  <span className="text-muted-foreground italic">
                    {interimTranscript}
                  </span>
                )}
                {currentState === 'RECORDING' && (
                  <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-1"></span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bot Response */}
        {currentResponse && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground">
              Assistant response:
            </div>
            <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-sm text-foreground">
                {currentResponse}
                {currentState === 'RESPONDING' && (
                  <span className="inline-block w-2 h-4 bg-green-500 animate-pulse ml-1"></span>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}