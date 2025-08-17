'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Phone, 
  Mic, 
  MicOff, 
  Calendar, 
  MessageSquare, 
  CheckCircle,
  Clock,
  MapPin,
  Headphones,
  Star,
  DollarSign,
  Users,
  Sparkles,
  Zap
} from 'lucide-react';
import Image from 'next/image';
import { useSimpleVoice } from '@/hooks/useSimpleVoice';
import { useRouter } from 'next/navigation';

interface CallData {
  customerName: string;
  phoneNumber: string;
  address: string;
  issue: string;
  urgency: 'emergency' | 'urgent' | 'routine';
  preferredTime: string;
  estimatedCost: string;
}

const voiceSmartDemo = {
  name: "VoiceSmart AI Assistant",
  tagline: "AI-Powered Voice Assistant Platform",
  capabilities: ["Customer Support", "Appointment Scheduling", "Information Gathering", "Call Routing"],
  uptime: "99.9%",
  businessesServed: 47,
  avgResponseTime: "< 2 seconds"
};

const timeSlots = [
  "Today 2:00 PM",
  "Today 4:30 PM", 
  "Tomorrow 9:00 AM",
  "Tomorrow 11:30 AM",
  "Tomorrow 2:00 PM"
];

export default function ContractorDemo() {
  const router = useRouter();
  const [demoStep, setDemoStep] = useState<'intro' | 'voice' | 'processing' | 'results'>('intro');
  const [callData, setCallData] = useState<CallData | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(timeSlots[0]);
  const [showVoiceDemo, setShowVoiceDemo] = useState(false);
  
  const voice = useSimpleVoice({
    onTranscriptChange: (transcript) => {
      console.log('Transcript:', transcript);
    },
    onResponse: (response) => {
      console.log('AI Response:', response);
      // Auto-extract data from response for demo
      if (response.toLowerCase().includes('dental') || response.toLowerCase().includes('cleaning') || response.toLowerCase().includes('appointment')) {
        setTimeout(() => {
          setCallData(mockCallScenarios[0].data);
          setDemoStep('results');
        }, 1000);
      } else {
        setTimeout(() => {
          setCallData(mockCallScenarios[1].data);
          setDemoStep('results');
        }, 1000);
      }
    },
    onError: (error) => {
      console.error('Voice Error:', error);
    }
  });

  const mockCallScenarios = [
    {
      transcript: "Hi, I'm Sarah Johnson. I need to schedule a dental cleaning appointment. I'm available afternoons next week and would prefer Thursday if possible. My number is 813-555-0123.",
      data: {
        customerName: "Sarah Johnson",
        phoneNumber: "(813) 555-0123", 
        address: "4521 Westshore Boulevard, Tampa, FL",
        issue: "Dental cleaning appointment request",
        urgency: "routine" as const,
        preferredTime: "Thursday afternoon next week",
        estimatedCost: "$150-$200"
      }
    },
    {
      transcript: "This is Mike Rodriguez calling. My car is making a strange noise when I brake. I'd like to bring it in for an inspection. I'm flexible on timing this week. You can reach me at 813-555-0456.",
      data: {
        customerName: "Mike Rodriguez",
        phoneNumber: "(813) 555-0456",
        address: "789 Hyde Park Avenue, Tampa, FL", 
        issue: "Auto brake inspection needed",
        urgency: "urgent" as const,
        preferredTime: "This week",
        estimatedCost: "$100-$300"
      }
    }
  ];

  const startVoiceDemo = () => {
    router.push('/voice-demo');
  };

  const handleVoiceInteraction = async () => {
    setDemoStep('processing');
    await voice.handleVoiceInteraction();
  };

  const resetDemo = () => {
    setDemoStep('intro');
    setShowVoiceDemo(false);
    setCallData(null);
    voice.reset();
  };

  if (demoStep === 'intro') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-3 mb-6">
              <Image 
                src="/voicesmart_logo.png" 
                alt="VoiceSmart Logo" 
                width={64} 
                height={64} 
                className="rounded-xl"
              />
              <h1 className="text-4xl font-bold text-white">VoiceSmart Beta Demo</h1>
            </div>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-4">
              Experience the future of customer interaction. VoiceSmart transforms any business 
              with an AI voice assistant that handles support, scheduling, and customer engagement 24/7.
            </p>
            <Badge className="bg-purple-900 text-purple-300 px-4 py-2">
              Beta Program • Currently serving 47+ businesses
            </Badge>
          </div>

          {/* Contractor Profile */}
          <Card className="max-w-2xl mx-auto mb-8 bg-slate-800 border-slate-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Headphones className="w-5 h-5 text-purple-400" />
                    {voiceSmartDemo.name}
                  </CardTitle>
                  <CardDescription className="text-gray-400">{voiceSmartDemo.tagline}</CardDescription>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1 mb-1">
                    <Zap className="w-4 h-4 text-purple-500 fill-current" />
                    <span className="font-semibold text-white">{voiceSmartDemo.uptime}</span>
                  </div>
                  <Badge variant="outline" className="text-xs border-slate-600 text-gray-300">Beta Access</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="font-semibold text-white">{voiceSmartDemo.businessesServed}</span>
                  </div>
                  <p className="text-xs text-gray-400">Businesses Served</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="font-semibold text-white">{voiceSmartDemo.avgResponseTime}</span>
                  </div>
                  <p className="text-xs text-gray-400">Response Time</p>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Sparkles className="w-4 h-4 text-gray-500" />
                    <span className="font-semibold text-white">Free</span>
                  </div>
                  <p className="text-xs text-gray-400">Beta Access</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {voiceSmartDemo.capabilities.map((capability) => (
                  <Badge key={capability} variant="secondary" className="text-xs">
                    {capability}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Live Voice Demo */}
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-8 text-white">Experience AI Voice Assistant</h2>
            <Card className="bg-slate-800 border-slate-700 mb-8">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center gap-2 text-white">
                  <Mic className="w-6 h-6 text-purple-400" />
                  Talk to VoiceSmart AI
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Click the button and describe any business inquiry - customer service, scheduling, or support
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-4">
                {!showVoiceDemo ? (
                  <Button 
                    onClick={startVoiceDemo}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg"
                  >
                    <Mic className="w-5 h-5 mr-2" />
                    Start Voice Demo
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="text-gray-300">
                      {voice.isListening && (
                        <div className="animate-pulse">
                          <div className="w-20 h-20 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Mic className="w-10 h-10 text-white" />
                          </div>
                          <p>Listening... speak now!</p>
                        </div>
                      )}
                      {voice.isProcessing && (
                        <div>
                          <div className="w-20 h-20 bg-purple-600 rounded-full flex items-center justify-center mx-auto mb-2 animate-spin">
                            <Headphones className="w-10 h-10 text-white" />
                          </div>
                          <p>Processing your request...</p>
                        </div>
                      )}
                      {!voice.isListening && !voice.isProcessing && (
                        <Button 
                          onClick={handleVoiceInteraction}
                          className="bg-purple-600 hover:bg-purple-700"
                          disabled={!voice.isSupported || !voice.hasPermission}
                        >
                          <Mic className="w-5 h-5 mr-2" />
                          {voice.hasPermission ? 'Click to Speak' : 'Enable Microphone'}
                        </Button>
                      )}
                    </div>
                    
                    {voice.transcript && (
                      <div className="bg-slate-700 p-4 rounded-lg">
                        <h4 className="text-white font-semibold mb-2">You said:</h4>
                        <p className="text-gray-300 text-sm">{voice.transcript}</p>
                      </div>
                    )}
                    
                    {voice.response && (
                      <div className="bg-purple-900 p-4 rounded-lg">
                        <h4 className="text-white font-semibold mb-2">AI Response:</h4>
                        <p className="text-purple-200 text-sm">{voice.response}</p>
                      </div>
                    )}

                    {voice.error && (
                      <div className="bg-red-900 p-4 rounded-lg">
                        <h4 className="text-white font-semibold mb-2">Error:</h4>
                        <p className="text-red-200 text-sm">{voice.error}</p>
                      </div>
                    )}
                  </div>
                )}
                
                <Button 
                  onClick={resetDemo}
                  variant="outline" 
                  className="border-slate-600 text-gray-300 hover:bg-slate-700"
                >
                  Reset Demo
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Value Props */}
          <div className="mt-16 max-w-6xl mx-auto">
            <h2 className="text-2xl font-semibold text-center mb-8 text-white">Transform Customer Interaction with AI</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="font-semibold mb-2 text-white">24/7 Customer Support</h3>
                <p className="text-gray-300">
                  AI handles customer inquiries around the clock. Instant responses, smart routing, perfect consistency.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="font-semibold mb-2 text-white">Smart Scheduling</h3>
                <p className="text-gray-300">
                  Handles appointments, bookings, and calendar management across any industry automatically.
                </p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-purple-900 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-purple-400" />
                </div>
                <h3 className="font-semibold mb-2 text-white">Intelligent Insights</h3>
                <p className="text-gray-300">
                  Extracts key information, generates summaries, and provides actionable customer data.
                </p>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="mt-16 text-center">
            <div className="bg-slate-800 border border-slate-700 p-8 rounded-lg shadow-lg max-w-md mx-auto">
              <h3 className="text-xl font-semibold mb-4 text-white">Beta Program Access</h3>
              <div className="text-3xl font-bold text-purple-400 mb-2">Free Access</div>
              <div className="text-xl font-semibold text-gray-300 mb-4">Beta Testing</div>
              <p className="text-sm text-gray-400 mb-6">
                Get early access to VoiceSmart. Help shape the future of AI customer interaction.
              </p>
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" size="lg">
                Join Beta Program
              </Button>
              <p className="text-xs text-gray-500 mt-2">
                Limited beta spots available
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (demoStep === 'call') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
        <Card className="max-w-lg mx-auto">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Phone className="w-6 h-6 text-green-600" />
              Incoming Call
            </CardTitle>
            <CardDescription>{mockContractor.name}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center">
              <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                {isRecording ? (
                  <Mic className="w-16 h-16 text-white" />
                ) : (
                  <MicOff className="w-16 h-16 text-white" />
                )}
              </div>
              <p className="text-lg font-semibold">
                {isRecording ? 'Customer Speaking...' : 'Call Ended'}
              </p>
            </div>
            
            {transcript && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">Live Transcript:</h4>
                <p className="text-sm text-gray-700">{transcript}</p>
              </div>
            )}
            
            <Button onClick={resetDemo} variant="outline" className="w-full">
              Back to Demo Selection
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (demoStep === 'processing') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-slate-100 flex items-center justify-center">
        <Card className="max-w-lg mx-auto">
          <CardContent className="pt-6 text-center space-y-6">
            <div className="w-24 h-24 bg-purple-600 rounded-full flex items-center justify-center mx-auto animate-spin">
              <Headphones className="w-12 h-12 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800">AI Processing Call...</h3>
              <p className="text-gray-700">
                Extracting customer info, scheduling preferences, and job details
              </p>
            </div>
            <div className="space-y-2 text-left">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Customer information extracted</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm">Issue severity assessed</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                <span className="text-sm">Scheduling optimal appointment...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (demoStep === 'results' && callData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2 text-white">Customer Request Captured!</h2>
            <p className="text-gray-300">Here's what VoiceSmart extracted and processed:</p>
          </div>

          <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-6 mb-8">
            {/* Calendar Booking */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-600" />
                  Smart Booking
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Customer</label>
                  <p className="text-lg">{callData.customerName}</p>
                  <p className="text-sm text-gray-600">{callData.phoneNumber}</p>
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <p className="flex items-center gap-1">
                    <MapPin className="w-4 h-4 text-gray-500" />
                    {callData.address}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Appointment Time</label>
                  <select 
                    value={selectedTimeSlot} 
                    onChange={(e) => setSelectedTimeSlot(e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    {timeSlots.map(slot => (
                      <option key={slot} value={slot}>{slot}</option>
                    ))}
                  </select>
                </div>
                <Badge className={`${callData.urgency === 'emergency' ? 'bg-red-100 text-red-800' : callData.urgency === 'urgent' ? 'bg-yellow-100 text-yellow-800' : 'bg-purple-100 text-purple-800'}`}>
                  {callData.urgency.charAt(0).toUpperCase() + callData.urgency.slice(1)} Priority
                </Badge>
              </CardContent>
            </Card>

            {/* SMS Preview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-purple-600" />
                  Customer Communication
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-500">
                  <p className="text-sm">
                    <strong>VoiceSmart Demo:</strong><br/>
                    Hi {callData.customerName}! We've scheduled your {callData.issue.toLowerCase()} for {selectedTimeSlot}. 
                    Confirmation details sent via email. Estimated cost: {callData.estimatedCost}. 
                    Questions? Reply or call us anytime.
                  </p>
                </div>
                <div className="mt-4 text-xs text-gray-500">
                  ✓ Sent automatically<br/>
                  ✓ Customer can reschedule by replying<br/>
                  ✓ Reminder sent 1 hour before
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Job Summary for Contractor */}
          <Card className="max-w-2xl mx-auto mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Headphones className="w-5 h-5 text-purple-600" />
                Business Summary (Sent to You)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-purple-50 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">New Request - {selectedTimeSlot}</h4>
                <div className="space-y-1 text-sm">
                  <p><strong>Customer:</strong> {callData.customerName} ({callData.phoneNumber})</p>
                  <p><strong>Address:</strong> {callData.address}</p>
                  <p><strong>Issue:</strong> {callData.issue}</p>
                  <p><strong>Urgency:</strong> {callData.urgency}</p>
                  <p><strong>Est. Cost:</strong> {callData.estimatedCost}</p>
                  <p><strong>Added to calendar:</strong> ✓</p>
                  <p><strong>Customer notified:</strong> ✓</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center space-y-4">
            <p className="text-lg font-semibold text-purple-300">
              ✨ Customer served instantly while you focused on your business!
            </p>
            <div className="space-x-4">
              <Button onClick={resetDemo} variant="outline">
                Try Another Scenario
              </Button>
              <Button className="bg-purple-600 hover:bg-purple-700">
                Join VoiceSmart Beta - Free Access
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}