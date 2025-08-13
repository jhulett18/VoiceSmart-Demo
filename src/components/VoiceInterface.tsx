'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Phone,
  PhoneOff,
  Loader2,
  AlertCircle
} from 'lucide-react';
import type { BusinessPersona } from '@/types';
import { useSpeechRecognition, useSpeechSynthesis } from '@/hooks/useSpeech';

interface VoiceInterfaceProps {
  business: BusinessPersona;
}

export function VoiceInterface({ business }: VoiceInterfaceProps) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isAutoSpeakEnabled, setIsAutoSpeakEnabled] = useState(true);
  const [errors, setErrors] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');

  // Speech Recognition Hook
  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported: speechRecognitionSupported,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechRecognition({
    onResult: (transcript, isFinal) => {
      if (isFinal && transcript.trim()) {
        handleVoiceInput(transcript.trim());
        resetTranscript();
      }
    },
    onError: (error) => {
      setErrors(prev => [...prev, `Speech recognition error: ${error}`]);
    },
    continuous: false,
    interimResults: true
  });

  // Speech Synthesis Hook
  const {
    speak,
    cancel: cancelSpeech,
    isSpeaking,
    isSupported: speechSynthesisSupported
  } = useSpeechSynthesis({
    rate: 0.9,
    pitch: 1.0,
    volume: 0.8,
    onStart: () => {},
    onEnd: () => {
      if (isCallActive) {
        // After bot speaks, start listening again
        setTimeout(() => {
          if (speechRecognitionSupported && isCallActive) {
            startListening();
          }
        }, 500);
      }
    },
    onError: () => {
      setErrors(prev => [...prev, 'Speech synthesis error occurred']);
    }
  });

  useEffect(() => {
    // Clear errors after 5 seconds
    if (errors.length > 0) {
      const timer = setTimeout(() => {
        setErrors([]);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [errors]);

  const handleVoiceInput = async (voiceText: string) => {
    if (!voiceText.trim() || isProcessing) return;
    
    setIsProcessing(true);
    setCurrentTranscript(voiceText);

    try {
      const response = await fetch('/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: voiceText,
          businessId: business.id
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (isAutoSpeakEnabled && speechSynthesisSupported) {
        speak(data.response);
      }
      
    } catch (error) {
      console.error('Voice processing error:', error);
      setErrors(prev => [...prev, 'Failed to process voice input. Please try again.']);
      
      // Provide fallback response
      if (isAutoSpeakEnabled && speechSynthesisSupported) {
        speak("I'm sorry, I encountered an error. Please try speaking again.");
      }
    } finally {
      setIsProcessing(false);
      setCurrentTranscript('');
    }
  };

  const startCall = () => {
    setIsCallActive(true);
    setErrors([]);
    
    // Start with a greeting
    if (isAutoSpeakEnabled && speechSynthesisSupported) {
      const greeting = `Hello! Welcome to ${business.name}. How can I help you today?`;
      speak(greeting);
    }
  };

  const endCall = () => {
    setIsCallActive(false);
    stopListening();
    cancelSpeech();
    resetTranscript();
    setCurrentTranscript('');
    setIsProcessing(false);
  };

  const toggleMute = () => {
    if (isListening) {
      stopListening();
    } else if (isCallActive && speechRecognitionSupported) {
      startListening();
    }
  };

  const toggleSpeaker = () => {
    if (isSpeaking) {
      cancelSpeech();
    } else {
      setIsAutoSpeakEnabled(!isAutoSpeakEnabled);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Error Display */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>
            <div className="space-y-1">
              {errors.map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Voice Call Interface */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Phone className="w-5 h-5" />
              Voice Assistant
            </span>
            <div className="flex items-center gap-2">
              {!speechRecognitionSupported && (
                <Badge variant="destructive" className="text-xs">No Microphone</Badge>
              )}
              {!speechSynthesisSupported && (
                <Badge variant="destructive" className="text-xs">No Speaker</Badge>
              )}
              {isCallActive && (
                <Badge variant="secondary" className="text-xs animate-pulse">
                  Call Active
                </Badge>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isCallActive ? (
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">
                Start a voice conversation with {business.name}
              </p>
              <Button 
                onClick={startCall}
                disabled={!speechRecognitionSupported || !speechSynthesisSupported}
                className="w-full h-12 text-lg"
              >
                <Phone className="w-5 h-5 mr-2" />
                Start Voice Call
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Call Status */}
              <div className="text-center space-y-2">
                <div className="text-lg font-medium">Connected to {business.name}</div>
                {isProcessing && (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </div>
                )}
                {isSpeaking && (
                  <div className="flex items-center justify-center gap-2 text-sm text-green-600">
                    <Volume2 className="w-4 h-4" />
                    Assistant Speaking
                  </div>
                )}
                {isListening && (
                  <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                    <Mic className="w-4 h-4" />
                    Listening...
                  </div>
                )}
                {currentTranscript && (
                  <div className="text-sm text-muted-foreground italic">
                    You said: &quot;{currentTranscript}&quot;
                  </div>
                )}
              </div>

              {/* Voice Input Display */}
              {(transcript || interimTranscript) && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground mb-1">Speaking:</div>
                  <div className="font-medium">
                    {transcript + interimTranscript}
                  </div>
                </div>
              )}

              {/* Call Controls */}
              <div className="flex justify-center gap-4">
                <Button
                  variant={isListening ? "destructive" : "secondary"}
                  onClick={toggleMute}
                  disabled={!speechRecognitionSupported}
                  className="flex items-center gap-2 h-12 px-6"
                >
                  {isListening ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      Mute
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4" />
                      Unmute
                    </>
                  )}
                </Button>

                <Button
                  variant={isAutoSpeakEnabled ? "secondary" : "outline"}
                  onClick={toggleSpeaker}
                  disabled={!speechSynthesisSupported}
                  className="flex items-center gap-2 h-12 px-6"
                >
                  {isSpeaking ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Speaking
                    </>
                  ) : isAutoSpeakEnabled ? (
                    <>
                      <Volume2 className="w-4 h-4" />
                      Speaker On
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-4 h-4" />
                      Speaker Off
                    </>
                  )}
                </Button>

                <Button
                  variant="destructive"
                  onClick={endCall}
                  className="flex items-center gap-2 h-12 px-6"
                >
                  <PhoneOff className="w-4 h-4" />
                  End Call
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">How to Use</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. Click &quot;Start Voice Call&quot; to begin</p>
          <p>2. The assistant will greet you and start listening</p>
          <p>3. Speak naturally - the assistant will respond automatically</p>
          <p>4. Use the controls to mute/unmute or toggle speaker</p>
          <p>5. Click &quot;End Call&quot; when finished</p>
        </CardContent>
      </Card>
    </div>
  );
}