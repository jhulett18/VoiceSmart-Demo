import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
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
  Bot
} from 'lucide-react';
import type { BusinessPersona } from '../App';

interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  isVoice?: boolean;
  ragSources?: string[];
}

interface AppointmentData {
  name: string;
  phone: string;
  email: string;
  service: string;
  date: string;
  time: string;
}

export function VoiceBotInterface({ business }: { business: BusinessPersona }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mock RAG knowledge base
  const mockKnowledgeBase = {
    dental: {
      'appointment booking': 'We offer same-day appointments for emergencies. Regular cleanings should be scheduled 2 weeks in advance. We accept most insurance plans.',
      'services': 'We provide routine cleanings, fillings, root canals, cosmetic dentistry, and emergency dental care.',
      'hours': 'We are open Monday through Friday 8AM to 6PM, and Saturdays 9AM to 3PM. Closed Sundays.',
      'insurance': 'We accept most major insurance plans including Blue Cross, Aetna, Cigna, and Delta Dental.',
      'emergency': 'For dental emergencies after hours, call our emergency line. We provide same-day emergency appointments.',
    },
    auto: {
      'services': 'We offer oil changes, brake repair, engine diagnostics, tire service, transmission repair, and general automotive maintenance.',
      'warranty': 'All repairs come with a 12-month/12,000-mile warranty. We use OEM and high-quality aftermarket parts.',
      'hours': 'Open Monday through Friday 7AM to 7PM, and Saturdays 8AM to 4PM. Closed Sundays.',
      'appointment': 'Most services can be completed same-day. For major repairs, we may need 1-2 days. Free estimates provided.',
      'pricing': 'We offer competitive pricing and free estimates. Payment plans available for major repairs over $500.',
    },
    fitness: {
      'membership': 'We offer monthly memberships, annual memberships with discounts, and day passes. Student discounts available.',
      'classes': 'Group classes include yoga, spin, HIIT, pilates, and strength training. Personal training sessions available.',
      'hours': 'Open Monday through Friday 5AM to 11PM, and weekends 6AM to 10PM.',
      'equipment': 'State-of-the-art cardio equipment, free weights, resistance machines, and functional training areas.',
      'trial': 'New members get a free 3-day trial pass. No commitment required to try our facilities.',
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initial greeting
    const greeting = {
      id: Date.now().toString(),
      type: 'bot' as const,
      content: `Hello! I'm the AI assistant for ${business.name}. I can help you with information about our services, scheduling appointments, and answering questions. How can I assist you today?`,
      timestamp: new Date(),
      ragSources: [`${business.name} Welcome Protocol`]
    };
    setMessages([greeting]);
  }, [business]);

  const mockRAGRetrieval = (query: string): string[] => {
    const sources: string[] = [];
    const kb = mockKnowledgeBase[business.id as keyof typeof mockKnowledgeBase];
    
    Object.keys(kb).forEach(key => {
      if (query.toLowerCase().includes(key) || key.includes(query.toLowerCase())) {
        sources.push(`${business.name} ${key.toUpperCase()} SOP`);
      }
    });
    
    if (sources.length === 0) {
      sources.push(`${business.name} General Information`);
    }
    
    return sources;
  };

  const generateBotResponse = (userMessage: string): { content: string; sources: string[] } => {
    const query = userMessage.toLowerCase();
    const sources = mockRAGRetrieval(query);
    
    // Check for appointment-related queries
    if (query.includes('appointment') || query.includes('book') || query.includes('schedule')) {
      return {
        content: `I'd be happy to help you schedule an appointment! Let me gather some information from you. What service are you interested in?`,
        sources
      };
    }
    
    // Service-specific responses
    const kb = mockKnowledgeBase[business.id as keyof typeof mockKnowledgeBase];
    
    for (const [key, response] of Object.entries(kb)) {
      if (query.includes(key)) {
        return { content: response, sources };
      }
    }
    
    // Generic response
    const responses = [
      `I understand you're asking about ${query}. Let me check our ${business.name} knowledge base for the most accurate information.`,
      `That's a great question about our services at ${business.name}. Based on our current policies and procedures, I can help you with that.`,
      `I'd be happy to help you with information about ${business.name}. Let me provide you with the most up-to-date details.`
    ];
    
    return {
      content: responses[Math.floor(Math.random() * responses.length)],
      sources
    };
  };

  const handleSendMessage = (content: string, isVoice = false) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date(),
      isVoice
    };

    setMessages(prev => [...prev, userMessage]);

    // Simulate processing delay
    setTimeout(() => {
      const { content: botContent, sources } = generateBotResponse(content);
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: botContent,
        timestamp: new Date(),
        ragSources: sources
      };

      setMessages(prev => [...prev, botMessage]);

      // Check if we should show appointment form
      if (content.toLowerCase().includes('appointment') || content.toLowerCase().includes('book')) {
        setTimeout(() => setShowAppointmentForm(true), 1000);
      }
    }, 1000);

    setInputText('');
  };

  const startListening = () => {
    setIsListening(true);
    // Simulate voice recognition
    setTimeout(() => {
      const voiceInputs = [
        "I'd like to schedule an appointment",
        "What services do you offer?",
        "What are your hours?",
        "Do you accept insurance?",
        "I need information about pricing"
      ];
      const randomInput = voiceInputs[Math.floor(Math.random() * voiceInputs.length)];
      handleSendMessage(randomInput, true);
      setIsListening(false);
    }, 2000);
  };

  const toggleSpeaking = () => {
    setIsSpeaking(!isSpeaking);
  };

  const handleAppointmentSubmit = () => {
    const appointment: Message = {
      id: Date.now().toString(),
      type: 'bot',
      content: `Perfect! I've scheduled your appointment for ${appointmentData.service} on ${appointmentData.date} at ${appointmentData.time}. A confirmation email will be sent to ${appointmentData.email}. Is there anything else I can help you with?`,
      timestamp: new Date(),
      ragSources: [`${business.name} Appointment System`]
    };
    
    setMessages(prev => [...prev, appointment]);
    setShowAppointmentForm(false);
    setEmailSent(true);
    
    // Reset form
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
      {/* Voice Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5" />
            Voice Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <Button
            variant={isListening ? "destructive" : "default"}
            onClick={isListening ? () => setIsListening(false) : startListening}
            className="flex items-center gap-2"
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {isListening ? 'Stop Listening' : 'Start Voice Input'}
          </Button>
          
          <Button
            variant={isSpeaking ? "default" : "outline"}
            onClick={toggleSpeaking}
            className="flex items-center gap-2"
          >
            {isSpeaking ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            {isSpeaking ? 'Audio On' : 'Audio Off'}
          </Button>
        </CardContent>
      </Card>

      {/* Chat Interface */}
      <Card className="h-96">
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
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
            <div ref={messagesEndRef} />
          </div>
          
          <div className="flex gap-2">
            <Input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type your message..."
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage(inputText)}
            />
            <Button onClick={() => handleSendMessage(inputText)}>
              <Send className="w-4 h-4" />
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

      {/* Demo Information */}
      <Card>
        <CardHeader>
          <CardTitle>Demo Technical Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• <strong>Voice Input:</strong> Simulated speech-to-text (would integrate with Web Speech API or similar)</p>
          <p>• <strong>RAG System:</strong> Mock knowledge retrieval from business SOPs and SLA documents</p>
          <p>• <strong>Voice Output:</strong> Simulated text-to-speech (would integrate with Speech Synthesis API)</p>
          <p>• <strong>Email Service:</strong> Mock email sending (would integrate with Resend API)</p>
          <p>• <strong>Full-Duplex:</strong> Real-time conversation flow simulation</p>
        </CardContent>
      </Card>
    </div>
  );
}