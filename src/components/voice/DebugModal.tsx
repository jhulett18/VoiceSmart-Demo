'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useVoiceStore } from '@/stores/voiceStore';
import { useVoiceHelpers } from '@/hooks/useVoiceHelpers';
import { Bug, Settings } from 'lucide-react';

export function DebugModal() {
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
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Bug className="w-4 h-4" />
          Debug
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Debug Information
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* System Status */}
          <div>
            <h3 className="font-semibold mb-3">System Status</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Current State:</span>
                  <span className="font-mono bg-muted px-2 py-1 rounded">{currentState}</span>
                </div>
                <div className="flex justify-between">
                  <span>Can Record:</span>
                  <span className={canRecord ? 'text-green-600' : 'text-red-600'}>
                    {canRecord ? '✅ Yes' : '❌ No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Business:</span>
                  <span className="font-mono">{business?.name || 'None'}</span>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Microphone:</span>
                  <span className={microphonePermission === 'granted' ? 'text-green-600' : 'text-red-600'}>
                    {microphonePermission}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Speech Recognition:</span>
                  <span className={speechRecognitionSupported ? 'text-green-600' : 'text-red-600'}>
                    {speechRecognitionSupported ? '✅' : '❌'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Speech Synthesis:</span>
                  <span className={speechSynthesisSupported ? 'text-green-600' : 'text-red-600'}>
                    {speechSynthesisSupported ? '✅' : '❌'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Error State */}
          {error && (
            <div>
              <h3 className="font-semibold mb-2 text-red-600">Current Error</h3>
              <div className="bg-red-50 border border-red-200 rounded-md p-3 text-sm text-red-800">
                {error}
              </div>
            </div>
          )}

          {/* Can Record Breakdown */}
          <div>
            <h3 className="font-semibold mb-3">Recording Capability Check</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>State is IDLE:</span>
                <span className={currentState === 'IDLE' ? 'text-green-600' : 'text-red-600'}>
                  {currentState === 'IDLE' ? '✅' : '❌'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Speech Recognition Supported:</span>
                <span className={speechRecognitionSupported ? 'text-green-600' : 'text-red-600'}>
                  {speechRecognitionSupported ? '✅' : '❌'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Microphone Permission Granted:</span>
                <span className={microphonePermission === 'granted' ? 'text-green-600' : 'text-red-600'}>
                  {microphonePermission === 'granted' ? '✅' : '❌'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Business Context Set:</span>
                <span className={business !== null ? 'text-green-600' : 'text-red-600'}>
                  {business !== null ? '✅' : '❌'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>No Active Error:</span>
                <span className={error === null ? 'text-green-600' : 'text-red-600'}>
                  {error === null ? '✅' : '❌'}
                </span>
              </div>
            </div>
          </div>

          {/* Browser Information */}
          <div>
            <h3 className="font-semibold mb-2">Browser Information</h3>
            <div className="text-xs font-mono bg-muted p-2 rounded">
              {typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A'}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}