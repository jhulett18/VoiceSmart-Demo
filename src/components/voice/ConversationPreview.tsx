'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useVoiceStore } from '@/stores/voiceStore';
import { 
  MessageSquare, 
  Mic, 
  Bot, 
  Loader2, 
  User, 
  History,
  Activity,
  Timer,
  Volume2,
  TrendingUp
} from 'lucide-react';

// Dynamic import to avoid SSR issues with llm-ui
const LLMMessage = dynamic(() => import('./LLMMessage').then(mod => ({ default: mod.LLMMessage })), {
  ssr: false,
  loading: () => (
    <div className="text-sm text-foreground leading-relaxed animate-pulse">
      Loading...
    </div>
  )
});

const ConversationHistoryPanel = dynamic(() => import('./ConversationHistoryPanel').then(mod => ({ default: mod.ConversationHistoryPanel })), {
  ssr: false
});

export function ConversationPreview() {
  const { 
    transcript, 
    interimTranscript, 
    currentResponse,
    currentState,
    conversationHistory,
    metrics
  } = useVoiceStore();

  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [currentSessionTime, setCurrentSessionTime] = useState(0);

  // Track session time
  useEffect(() => {
    const interval = setInterval(() => {
      if (metrics.sessionStartTime) {
        setCurrentSessionTime(Math.floor((Date.now() - metrics.sessionStartTime.getTime()) / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [metrics.sessionStartTime]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStateIcon = () => {
    switch (currentState) {
      case 'RECORDING':
        return <Mic className="w-4 h-4 text-red-500 animate-pulse" />;
      case 'PROCESSING':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'RESPONDING':
        return <Bot className="w-4 h-4 text-green-500 animate-pulse" />;
      default:
        return <MessageSquare className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStateText = () => {
    switch (currentState) {
      case 'RECORDING':
        return 'Recording...';
      case 'PROCESSING':
        return 'Processing your request...';
      case 'RESPONDING':
        return 'Assistant is responding...';
      case 'IDLE':
        return 'Ready for conversation';
      default:
        return 'Voice conversation';
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Voice Status Card */}
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                {getStateIcon()}
                <span>Voice Status</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowHistoryPanel(true)}
                className="h-6 text-xs text-muted-foreground hover:text-foreground"
              >
                <History className="w-3 h-3 mr-1" />
                History ({conversationHistory.length})
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">{getStateText()}</span>
              </div>
              <div className="flex items-center gap-3">
                <Timer className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Session: {formatTime(currentSessionTime)}</span>
              </div>
              <div className="flex items-center gap-3">
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Quality: {metrics.voiceQualityScore}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session Metrics Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="w-4 h-4" />
              Session Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{metrics.totalInteractions}</div>
                <div className="text-xs text-muted-foreground">Interactions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{metrics.successfulInteractions}</div>
                <div className="text-xs text-muted-foreground">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.avgResponseTime > 0 ? `${(metrics.avgResponseTime / 1000).toFixed(1)}s` : '0s'}
                </div>
                <div className="text-xs text-muted-foreground">Avg Response</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {metrics.totalInteractions > 0 ? Math.round((metrics.successfulInteractions / metrics.totalInteractions) * 100) + '%' : '0%'}
                </div>
                <div className="text-xs text-muted-foreground">Success Rate</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Conversation Card */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" />
            Current Conversation
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-4">
            {/* Current User Input */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Mic className="w-4 h-4" />
                Your Input
              </div>
              
              {(transcript || interimTranscript) ? (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg rounded-tl-none border border-blue-200 dark:border-blue-800">
                      <div className="text-sm leading-relaxed">
                        <span className="text-foreground font-medium">{transcript}</span>
                        {interimTranscript && (
                          <span className="text-muted-foreground italic ml-1">
                            {interimTranscript}
                          </span>
                        )}
                        {currentState === 'RECORDING' && (
                          <span className="inline-block w-2 h-4 bg-blue-500 animate-pulse ml-2 rounded-sm"></span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 border-2 border-dashed border-muted-foreground/20 rounded-lg text-center">
                  <div className="text-sm text-muted-foreground">
                    {currentState === 'RECORDING' ? (
                      <div className="flex items-center justify-center gap-2">
                        <Mic className="w-4 h-4 text-red-500 animate-pulse" />
                        <span>Listening... speak now</span>
                      </div>
                    ) : (
                      'Press and hold to speak'
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Current Assistant Response */}
            {(transcript || currentResponse || currentState === 'PROCESSING' || currentState === 'RESPONDING') && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Bot className="w-4 h-4" />
                  Assistant Response
                </div>
                
                {currentResponse ? (
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg rounded-tl-none border border-gray-200 dark:border-gray-800">
                        <LLMMessage 
                          content={currentResponse} 
                          isStreaming={currentState === 'RESPONDING'} 
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 border-2 border-dashed border-muted-foreground/20 rounded-lg text-center">
                    <div className="text-sm text-muted-foreground">
                      {currentState === 'PROCESSING' ? (
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                          <span>Processing your request...</span>
                        </div>
                      ) : currentState === 'RESPONDING' ? (
                        <div className="flex items-center justify-center gap-2">
                          <Bot className="w-4 h-4 text-green-500 animate-pulse" />
                          <span>Assistant is responding...</span>
                        </div>
                      ) : (
                        'Waiting for your input'
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Conversation History Panel */}
      <ConversationHistoryPanel 
        isOpen={showHistoryPanel} 
        onClose={() => setShowHistoryPanel(false)} 
      />
    </>
  );
}