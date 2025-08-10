'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  Send, 
  Calendar, 
  FileText, 
  CheckCircle,
  User,
  Bot,
  AlertCircle,
  Loader2
} from 'lucide-react';
import type { BusinessPersona, AppointmentData } from '@/types';
import { useSpeechRecognition, useSpeechSynthesis } from '@/hooks/useSpeech';
import { useChat } from '@/hooks/useChat';


export function VoiceBotInterface({ business }: { business: BusinessPersona }) {
  const [inputText, setInputText] = useState('');
  const [showAppointmentForm, setShowAppointmentForm] = useState(false);
  const [appointmentData, setAppointmentData] = useState<AppointmentData>({
    name: '',
    phone: '',
    email: '',
    service: '',
    date: '',
    time: ''
  });
  const [emailSent, setEmailSent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [isAutoSpeakEnabled, setIsAutoSpeakEnabled] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        handleSendMessage(transcript.trim(), true);
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
    onEnd: () => {},
    onError: () => {
      setErrors(prev => [...prev, 'Speech synthesis error occurred']);
    }
  });

  // Chat Hook with LLM Integration
  const {
    messages,
    sendMessage,
    isLoading,
    streamingMessage,
    clearMessages
  } = useChat({
    businessId: business.id,
    onMessageReceived: (message) => {
      // Auto-speak bot responses if enabled
      if (isAutoSpeakEnabled && message.type === 'bot' && speechSynthesisSupported) {
        setTimeout(() => speak(message.content), 100);
      }
      
      // Check if appointment booking should be triggered
      if (message.content.toLowerCase().includes('appointment') || 
          message.content.toLowerCase().includes('schedule')) {
        setTimeout(() => setShowAppointmentForm(true), 1500);
      }
    },
    onError: (error) => {
      setErrors(prev => [...prev, `Chat error: ${error}`]);
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingMessage]);

  useEffect(() => {
    // Clear any previous errors after 10 seconds
    if (errors.length > 0) {
      const timer = setTimeout(() => {
        setErrors([]);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [errors]);

  useEffect(() => {
    // Initialize with a greeting message when business changes
    if (messages.length === 0) {
      setTimeout(() => {
        sendMessage('Hello! I would like to know about your services and how you can help me.', false);
      }, 500);
    }
  }, [business.name, sendMessage, messages.length]);

  const handleSendMessage = async (content: string, isVoice = false) => {
    if (!content.trim() || isLoading) return;
    
    // Cancel any ongoing speech
    if (isSpeaking) {
      cancelSpeech();
    }
    
    await sendMessage(content, isVoice);
    setInputText('');
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      if (!speechRecognitionSupported) {
        setErrors(prev => [...prev, 'Speech recognition not supported in this browser']);
        return;
      }
      startListening();
    }
  };

  const handleSpeechToggle = () => {
    if (isSpeaking) {
      cancelSpeech();
    } else {
      setIsAutoSpeakEnabled(!isAutoSpeakEnabled);
    }
  };

  const handleAppointmentSubmit = async () => {
    await sendMessage(`Schedule confirmed: ${appointmentData.service} on ${appointmentData.date} at ${appointmentData.time} for ${appointmentData.name}`, false);
    
    setShowAppointmentForm(false);
    setEmailSent(true);
    
    setAppointmentData({
      name: '',
      phone: '',
      email: '',
      service: '',
      date: '',
      time: ''
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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

      {/* Voice Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Voice Controls
            <div className="ml-auto flex gap-2 text-sm text-muted-foreground">
              {!speechRecognitionSupported && <span>⚠️ Speech recognition unavailable</span>}
              {!speechSynthesisSupported && <span>⚠️ Speech synthesis unavailable</span>}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            variant={isListening ? "destructive" : "default"}
            onClick={handleVoiceToggle}
            disabled={!speechRecognitionSupported}
            className="flex items-center gap-2"
          >
            {isListening ? (
              <>
                <MicOff className="w-4 h-4" />
                Stop Listening
              </>
            ) : (
              <>
                <Mic className="w-4 h-4" />
                Start Voice Input
              </>
            )}
          </Button>
          
          <Button
            variant={isAutoSpeakEnabled ? "default" : "outline"}
            onClick={handleSpeechToggle}
            disabled={!speechSynthesisSupported}
            className="flex items-center gap-2"
          >
            {isSpeaking ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Speaking...
              </>
            ) : isAutoSpeakEnabled ? (
              <>
                <Volume2 className="w-4 h-4" />
                Auto Speech On
              </>
            ) : (
              <>
                <VolumeX className="w-4 h-4" />
                Auto Speech Off
              </>
            )}
          </Button>

          {/* Clear conversation */}
          <Button
            variant="outline"
            onClick={clearMessages}
            className="flex items-center gap-2"
          >
            Clear Chat
          </Button>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card className="h-96">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Conversation</span>
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                AI thinking...
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex gap-2 max-w-[80%] ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}>
                    {message.type === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div className={`rounded-lg p-3 ${
                    message.type === 'user' 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted'
                  }`}>
                    <p className="text-sm">{message.content}</p>
                    {message.isVoice && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        <Mic className="w-3 h-3 mr-1" />
                        Voice Input
                      </Badge>
                    )}
                    {message.ragSources && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <FileText className="w-3 h-3" />
                          Sources: {message.ragSources.join(', ')}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            
            {/* Show streaming message */}
            {streamingMessage && (
              <div className="flex gap-3 justify-start">
                <div className="flex gap-2 max-w-[80%]">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-muted">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="rounded-lg p-3 bg-muted">
                    <p className="text-sm">{streamingMessage}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Loader2 className="w-3 h-3 animate-spin" />
                      <span className="text-xs text-muted-foreground">Typing...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Show current voice input */}
            {(transcript || interimTranscript) && (
              <div className="flex gap-3 justify-end">
                <div className="flex gap-2 max-w-[80%] flex-row-reverse">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-primary text-primary-foreground">
                    <Mic className="w-4 h-4" />
                  </div>
                  <div className="rounded-lg p-3 bg-primary text-primary-foreground">
                    <p className="text-sm">{transcript + interimTranscript}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                      <span className="text-xs opacity-70">Listening...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <div className="flex gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isListening ? "Listening..." : "Type your message..."}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
              disabled={isLoading || isListening}
            />
            <Button 
              onClick={() => handleSendMessage(inputText)}
              disabled={isLoading || !inputText.trim()}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Appointment Form */}
      {showAppointmentForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              Schedule Appointment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={appointmentData.name}
                  onChange={(e) => setAppointmentData(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  value={appointmentData.phone}
                  onChange={(e) => setAppointmentData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={appointmentData.email}
                  onChange={(e) => setAppointmentData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="service">Service Needed</Label>
                <select
                  id="service"
                  className="w-full p-2 border rounded-md"
                  value={appointmentData.service}
                  onChange={(e) => setAppointmentData(prev => ({ ...prev, service: e.target.value }))}
                >
                  <option value="">Select a service</option>
                  {business.services.map(service => (
                    <option key={service} value={service}>{service}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="date">Preferred Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={appointmentData.date}
                  onChange={(e) => setAppointmentData(prev => ({ ...prev, date: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="time">Preferred Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={appointmentData.time}
                  onChange={(e) => setAppointmentData(prev => ({ ...prev, time: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleAppointmentSubmit} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Schedule Appointment
              </Button>
              <Button variant="outline" onClick={() => setShowAppointmentForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Confirmation */}
      {emailSent && (
        <Alert>
          <CheckCircle className="w-4 h-4" />
          <AlertDescription>
            Appointment confirmation email sent successfully! (This is a demo - no actual email was sent)
          </AlertDescription>
        </Alert>
      )}

      {/* Real-time Status & Features */}
      <Card>
        <CardHeader>
          <CardTitle>Live Interactive Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${speechRecognitionSupported ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <strong>Voice Input:</strong> Real Web Speech API integration
              </p>
              <p className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${speechSynthesisSupported ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <strong>Voice Output:</strong> Native browser text-to-speech
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                <strong>LLM Integration:</strong> {process.env.NODE_ENV === 'development' ? 'OpenAI GPT-4 (requires API key)' : 'Live AI responses'}
              </p>
            </div>
            <div className="space-y-2">
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                <strong>Streaming:</strong> Real-time response generation
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500"></span>
                <strong>Business Context:</strong> Persona-specific AI prompts
              </p>
              <p className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                <strong>Full-Duplex:</strong> Interrupt and barge-in capable
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950 rounded-md">
            <p className="text-xs">
              <strong>Setup Required:</strong> Add your OpenAI API key to <code>.env.local</code> as <code>OPENAI_API_KEY</code> to enable live AI responses.
              Without it, you&apos;ll see connection errors in the chat.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}