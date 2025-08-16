'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useVoiceStore } from '@/stores/voiceStore';
import { MessageSquare, Mic, Bot, Clock, Loader2, User, Trash2 } from 'lucide-react';

export function ConversationPreview() {
  const { 
    transcript, 
    interimTranscript, 
    currentResponse,
    currentState,
    conversationHistory,
    clearConversationHistory
  } = useVoiceStore();

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
    <Card className="w-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            {getStateIcon()}
            <span>Conversation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground font-normal">
              <Clock className="w-3 h-3" />
              {getStateText()}
            </div>
            {conversationHistory.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearConversationHistory}
                className="h-6 text-xs text-muted-foreground hover:text-foreground"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          {/* Conversation History - Bottom to Top (newest at bottom) */}
          {conversationHistory.length > 0 && (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {conversationHistory.map((exchange) => (
                <div key={exchange.id} className="space-y-3 pb-4 border-b border-muted-foreground/10 last:border-b-0">
                  {/* User Message */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">You</span>
                        <span className="text-xs text-muted-foreground">
                          {exchange.timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg rounded-tl-none">
                        <p className="text-sm text-foreground">{exchange.userMessage}</p>
                      </div>
                    </div>
                  </div>

                  {/* Assistant Response */}
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">Assistant</span>
                        <span className="text-xs text-muted-foreground">
                          {exchange.timestamp.toLocaleTimeString([], { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </span>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg rounded-tl-none">
                        <p className="text-sm text-foreground">{exchange.assistantResponse}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Current Exchange - Always at Bottom */}
          <div className="space-y-4 pt-2">
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
                        <div className="text-sm text-foreground leading-relaxed">
                          {currentResponse}
                          {currentState === 'RESPONDING' && (
                            <span className="inline-block w-2 h-4 bg-green-500 animate-pulse ml-2 rounded-sm"></span>
                          )}
                        </div>
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
        </div>
      </CardContent>
    </Card>
  );
}