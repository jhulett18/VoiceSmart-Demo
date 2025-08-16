'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { HelpCircle, Mic, Send, Headphones, Repeat } from 'lucide-react';

export function InstructionsModal() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4" />
          How to Use
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5" />
            How to Use the Voice Assistant
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-semibold text-blue-600">1</span>
              </div>
              <div>
                <p className="font-medium flex items-center gap-2">
                  <Mic className="w-4 h-4" />
                  Press and Hold
                </p>
                <p className="text-sm text-muted-foreground">
                  Press and hold the "Push to Talk" button or spacebar
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-semibold text-green-600">2</span>
              </div>
              <div>
                <p className="font-medium flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  Speak Clearly
                </p>
                <p className="text-sm text-muted-foreground">
                  Speak your question or request clearly into your microphone
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-semibold text-purple-600">3</span>
              </div>
              <div>
                <p className="font-medium">Release to Send</p>
                <p className="text-sm text-muted-foreground">
                  Release the button to send your message for processing
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-semibold text-orange-600">4</span>
              </div>
              <div>
                <p className="font-medium flex items-center gap-2">
                  <Headphones className="w-4 h-4" />
                  Listen to Response
                </p>
                <p className="text-sm text-muted-foreground">
                  Wait for the assistant to respond with helpful information
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-sm font-semibold text-teal-600">5</span>
              </div>
              <div>
                <p className="font-medium flex items-center gap-2">
                  <Repeat className="w-4 h-4" />
                  Continue Conversation
                </p>
                <p className="text-sm text-muted-foreground">
                  Repeat as needed for your conversation
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 mt-6">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Pro Tips</h4>
            <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
              <li>• Use the spacebar instead of clicking for hands-free operation</li>
              <li>• Speak naturally - no need to be overly formal</li>
              <li>• Check the conversation history on the right to see your chat</li>
              <li>• Grant microphone permission when prompted for the best experience</li>
            </ul>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-4">
            <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">🎯 Try Asking About</h4>
            <ul className="space-y-1 text-sm text-amber-800 dark:text-amber-200">
              <li>• Business hours and contact information</li>
              <li>• Available services and pricing</li>
              <li>• Scheduling appointments or consultations</li>
              <li>• General questions about the business</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}