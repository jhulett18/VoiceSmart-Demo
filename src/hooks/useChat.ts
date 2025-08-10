'use client';

import { useState, useCallback } from 'react';
import { Message } from '@/types';

interface UseChatOptions {
  businessId: string;
  onMessageReceived?: (message: Message) => void;
  onError?: (error: string) => void;
}

export function useChat({ businessId, onMessageReceived, onError }: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');

  const sendMessage = useCallback(async (content: string, isVoice = false) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date(),
      isVoice
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingMessage('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.content
          })),
          businessId,
          stream: true
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            if (data === '[DONE]') {
              const botMessage: Message = {
                id: (Date.now() + 1).toString(),
                type: 'bot',
                content: accumulatedContent,
                timestamp: new Date(),
                ragSources: [`${businessId} AI Assistant`]
              };
              
              setMessages(prev => [...prev, botMessage]);
              setStreamingMessage('');
              setIsLoading(false);
              
              if (onMessageReceived) {
                onMessageReceived(botMessage);
              }
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                accumulatedContent += parsed.content;
                setStreamingMessage(accumulatedContent);
              }
            } catch (error) {
              // Ignore JSON parse errors for partial chunks
            }
          }
        }
      }
    } catch (error) {
      console.error('Chat error:', error);
      setIsLoading(false);
      setStreamingMessage('');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: 'I apologize, but I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
        ragSources: ['Error Handler']
      };
      
      setMessages(prev => [...prev, botMessage]);
      
      if (onError) {
        onError(errorMessage);
      }
    }
  }, [messages, businessId, onMessageReceived, onError]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setStreamingMessage('');
    setIsLoading(false);
  }, []);

  return {
    messages,
    sendMessage,
    isLoading,
    streamingMessage,
    clearMessages
  };
}