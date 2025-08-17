'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useVoiceStore } from '@/stores/voiceStore';
import { 
  MessageSquare, 
  User, 
  Bot, 
  Trash2, 
  Download, 
  Search,
  Calendar,
  X,
  History
} from 'lucide-react';
import { LLMMessage } from './LLMMessage';

interface ConversationHistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConversationHistoryPanel({ isOpen, onClose }: ConversationHistoryPanelProps) {
  const { conversationHistory, clearConversationHistory } = useVoiceStore();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter conversations based on search and filter
  const filteredHistory = conversationHistory.filter(exchange => {
    const matchesSearch = searchTerm === '' || 
      exchange.userMessage.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exchange.assistantResponse.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const exportConversations = () => {
    const exportData = conversationHistory.map(exchange => ({
      timestamp: exchange.timestamp.toISOString(),
      userMessage: exchange.userMessage,
      assistantResponse: exchange.assistantResponse
    }));

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-history-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full h-[80vh] flex flex-col m-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <History className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-semibold">Conversation History</h2>
            <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
              {conversationHistory.length} conversations
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3 p-4 border-b">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
            />
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={exportConversations}
            disabled={conversationHistory.length === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={clearConversationHistory}
            disabled={conversationHistory.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Clear All
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <MessageSquare className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {conversationHistory.length === 0 ? 'No conversations yet' : 'No matching conversations'}
              </h3>
              <p className="text-muted-foreground max-w-md">
                {conversationHistory.length === 0 
                  ? 'Start a voice conversation to see your history here.'
                  : 'Try adjusting your search terms or filters.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredHistory.slice().reverse().map((exchange) => (
                <Card key={exchange.id} className="border-l-4 border-l-primary">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        {exchange.timestamp.toLocaleString()}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* User Message */}
                    <div className="flex gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium">You</span>
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
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm font-medium">Assistant</span>
                        </div>
                        <div className="p-3 bg-gray-50 dark:bg-gray-950 rounded-lg rounded-tl-none">
                          <LLMMessage content={exchange.assistantResponse} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}