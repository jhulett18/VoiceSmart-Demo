'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useVoiceStore } from '@/stores/voiceStore';
import { useVoiceHelpers } from '@/hooks/useVoiceHelpers';

export function DebugPanel() {
  const { 
    currentState, 
    microphonePermission, 
    speechRecognitionSupported, 
    speechSynthesisSupported,
    error,
    business
  } = useVoiceStore();
  
  const { canRecord } = useVoiceHelpers();

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <Card className="mt-4 border-dashed">
      <CardHeader>
        <CardTitle className="text-sm">🐛 Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-1">
        <div><strong>Current State:</strong> {currentState}</div>
        <div><strong>Microphone Permission:</strong> {microphonePermission}</div>
        <div><strong>Speech Recognition:</strong> {speechRecognitionSupported ? '✅' : '❌'}</div>
        <div><strong>Speech Synthesis:</strong> {speechSynthesisSupported ? '✅' : '❌'}</div>
        <div><strong>Can Record:</strong> {canRecord ? '✅' : '❌'}</div>
        <div><strong>Business:</strong> {business?.name || 'None'}</div>
        <div><strong>Error:</strong> {error || 'None'}</div>
        <div className="text-purple-600"><strong>Debug canRecord calculation:</strong></div>
        <div className="ml-2 text-xs">
          <div>• State IDLE: {currentState === 'IDLE' ? '✅' : '❌'}</div>
          <div>• Speech supported: {speechRecognitionSupported ? '✅' : '❌'}</div>
          <div>• Mic granted: {microphonePermission === 'granted' ? '✅' : '❌'}</div>
          <div>• Business set: {business !== null ? '✅' : '❌'}</div>
          <div>• No error: {error === null ? '✅' : '❌'}</div>
        </div>
        <div><strong>User Agent:</strong> {typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 50) + '...' : 'N/A'}</div>
      </CardContent>
    </Card>
  );
}