'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft,
  Upload,
  Mic,
  MicOff,
  Play,
  Pause,
  Square,
  Calendar,
  Phone,
  FileText,
  Settings,
  HelpCircle,
  Activity,
  Users,
  Clock,
  Headphones,
  Eye,
  X
} from 'lucide-react';
import Image from 'next/image';
import { useSimpleVoice } from '@/hooks/useSimpleVoice';
import { useRouter } from 'next/navigation';

interface Document {
  id: string;
  name: string;
  type: string;
  size: string;
  uploadedAt: Date;
  content?: string;
}

interface ExtractedData {
  customerName?: string;
  phoneNumber?: string;
  address?: string;
  issue?: string;
  urgency?: 'emergency' | 'urgent' | 'routine';
  estimatedCost?: string;
}

export default function VoiceDemoPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingDocument, setViewingDocument] = useState<Document | null>(null);

  const voice = useSimpleVoice({
    onTranscriptChange: (transcript) => {
      console.log('Transcript updated:', transcript);
    },
    onResponse: (response) => {
      console.log('AI Response:', response);
      // Simulate data extraction from AI response
      setTimeout(() => {
        if (response.toLowerCase().includes('dental') || response.toLowerCase().includes('cleaning') || response.toLowerCase().includes('appointment')) {
          setExtractedData({
            customerName: "Sarah Johnson",
            phoneNumber: "(813) 555-0123",
            address: "4521 Westshore Boulevard, Tampa, FL",
            issue: "Dental cleaning appointment request",
            urgency: "routine",
            estimatedCost: "$150-$200"
          });
        } else if (response.toLowerCase().includes('car') || response.toLowerCase().includes('auto') || response.toLowerCase().includes('brake')) {
          setExtractedData({
            customerName: "Mike Rodriguez", 
            phoneNumber: "(813) 555-0456",
            address: "789 Hyde Park Avenue, Tampa, FL",
            issue: "Auto brake inspection needed",
            urgency: "urgent",
            estimatedCost: "$150-$300"
          });
        } else {
          setExtractedData({
            customerName: "Lisa Chen", 
            phoneNumber: "(813) 555-0789",
            address: "123 Main Street, Tampa, FL",
            issue: "General customer inquiry",
            urgency: "routine",
            estimatedCost: "Consultation"
          });
        }
      }, 1000);
    },
    onError: (error) => {
      console.error('Voice Error:', error);
    }
  });

  // Demo documents
  useEffect(() => {
    const demoDocuments: Document[] = [
      {
        id: '1',
        name: 'BrightSmile Dental - Services & Pricing.pdf',
        type: 'PDF',
        size: '1.8 MB',
        uploadedAt: new Date(),
        content: `BRIGHTSMILE DENTAL CLINIC - COMPREHENSIVE SERVICES

PREVENTIVE CARE:
- Routine cleanings and exams: $150-$200 (every 6 months)
- Fluoride treatments: $50-$75
- Digital X-rays: $100-$150
- Oral cancer screenings: Included in exam
- Dental sealants: $40-$60 per tooth

RESTORATIVE DENTISTRY:
- Tooth-colored fillings: $150-$300
- Dental crowns: $1200-$1500
- Root canal therapy: $800-$1200
- Tooth extractions: $150-$400
- Bridges and dentures: $800-$3000

COSMETIC SERVICES:
- Professional teeth whitening: $400-$600
- Porcelain veneers: $1200-$2000 per tooth
- Invisalign treatment: $3000-$6000
- Smile makeovers: Consultation required

INSURANCE & PAYMENT:
- Most major dental insurance accepted
- CareCredit financing available
- Payment plans for treatments over $500`
      },
      {
        id: '2', 
        name: 'ProFix Auto Repair - Service Menu.txt',
        type: 'TXT',
        size: '156 KB',
        uploadedAt: new Date(),
        content: `PROFIX AUTO REPAIR - COMPREHENSIVE AUTOMOTIVE SERVICES

ROUTINE MAINTENANCE:
- Oil changes: $35-$85 (depending on oil type)
- Brake inspection and pads: $150-$300 per axle
- Battery testing and replacement: $120-$200
- Tire rotation and balancing: $50-$80
- Transmission service: $200-$300
- Tune-ups and diagnostics: $125-$250

MAJOR REPAIRS:
- Engine rebuilds: $2500-$5000
- Transmission replacement: $2000-$4000
- AC system repair: $300-$800
- Suspension work: $400-$1200
- Exhaust system: $200-$600

WARRANTY & PRICING:
- 12 months/12,000 miles warranty on all repairs
- Labor rate: $125 per hour
- Free estimates for repairs over $200
- Senior discount: 10% on labor
- Military discount: 15% on labor
- Payment plans available for repairs over $500`
      },
      {
        id: '3',
        name: 'FitZone Gym - Membership & Classes.docx',
        type: 'DOCX', 
        size: '89 KB',
        uploadedAt: new Date(),
        content: `FITZONE GYM - MEMBERSHIP OPTIONS & FITNESS PROGRAMS

MEMBERSHIP PLANS:
- Basic Membership: $29/month (gym access during staffed hours)
- Unlimited Membership: $49/month (24/7 access + unlimited classes)
- Premium Membership: $79/month (includes 2 personal training sessions)
- Student discount: 20% off with valid ID
- Senior discount (65+): 15% off all memberships
- Family plans: Second member 50% off

GROUP FITNESS CLASSES:
- HIIT Training: Monday, Wednesday, Friday 6 AM & 6 PM
- Yoga (multiple styles): Daily classes at various times
- Spin/Cycling: Tuesday, Thursday, Saturday 7 AM & 5 PM
- Pilates: Monday through Friday
- Zumba: Wednesday, Friday 7 PM
- Senior fitness (55+): Monday, Wednesday 10 AM

FACILITIES & AMENITIES:
- Full cardio and strength equipment
- Olympic lifting platform
- Separate women's workout area
- Locker rooms with showers
- Sauna and massage chairs (Premium members)
- Nutrition coaching available`
      },
      {
        id: '4',
        name: 'VoiceSmart Multi-Industry Demo.pdf',
        type: 'PDF', 
        size: '1.8 MB',
        uploadedAt: new Date(),
        content: `VOICESMART AI ASSISTANT - MULTI-INDUSTRY CAPABILITIES

HEALTHCARE & DENTAL:
- Appointment scheduling and reminders
- Insurance verification and billing inquiries
- Prescription refill requests
- Emergency triage and routing
- Patient intake and form completion
- Follow-up care coordination

AUTOMOTIVE SERVICES:
- Service appointment booking
- Warranty and repair cost estimates
- Parts availability and ordering
- Vehicle diagnostic support
- Insurance claim assistance
- Loaner car coordination

FITNESS & WELLNESS:
- Class reservations and cancellations
- Membership inquiries and upgrades
- Personal training scheduling
- Facility hours and amenities info
- Billing and payment processing
- Guest pass management

GENERAL BUSINESS SUPPORT:
- Customer service inquiries
- Product information and recommendations
- Order status and tracking
- Returns and exchanges
- Technical support routing
- Feedback collection and analysis

VOICESMART FEATURES:
- Natural language understanding
- Multi-language support
- CRM integration
- Analytics and reporting
- 99.9% uptime guarantee`
      }
    ];
    setDocuments(demoDocuments);
    setSelectedDocument(demoDocuments[0].id);
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsUploading(true);
    
    for (const file of Array.from(files)) {
      const newDoc: Document = {
        id: Date.now().toString() + Math.random().toString(36).substring(7),
        name: file.name,
        type: file.type || 'Unknown',
        size: `${(file.size / 1024).toFixed(1)} KB`,
        uploadedAt: new Date(),
        content: 'User uploaded document - content would be extracted here'
      };
      
      setDocuments(prev => [...prev, newDoc]);
    }
    
    setIsUploading(false);
  };

  const handleBookCall = () => {
    alert('VoiceSmart Beta signup would open here - join our early access program!');
  };

  const initializeVoice = async () => {
    await voice.initialize();
  };

  useEffect(() => {
    initializeVoice();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => router.push('/contractor-demo')}
              className="border-slate-600 text-gray-300 hover:bg-slate-700"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Demo
            </Button>
            <div className="flex items-center gap-3">
              <Image 
                src="/voicesmart_logo.png" 
                alt="VoiceSmart Logo" 
                width={48} 
                height={48} 
                className="rounded-lg"
              />
              <div>
                <h1 className="text-3xl font-bold text-white">VoiceSmart Demo Lab</h1>
                <p className="text-gray-400">Experience AI-powered voice assistance</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDebug(!showDebug)}
              className="border-slate-600 text-gray-300 hover:bg-slate-700"
            >
              <Settings className="w-4 h-4 mr-1" />
              Debug
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowInstructions(!showInstructions)}
              className="border-slate-600 text-gray-300 hover:bg-slate-700"
            >
              <HelpCircle className="w-4 h-4 mr-1" />
              Help
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Documents & Instructions */}
          <div className="space-y-6">
            {/* Instructions Panel */}
            {showInstructions && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <HelpCircle className="w-5 h-5 text-purple-400" />
                    How to Use
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-gray-300 text-sm space-y-3">
                  <div>
                    <strong className="text-white">1. Documents:</strong> Use demo docs or upload your own business documents
                  </div>
                  <div>
                    <strong className="text-white">2. Voice Test:</strong> Click the microphone and speak naturally about any business inquiry
                  </div>
                  <div>
                    <strong className="text-white">3. AI Response:</strong> See how VoiceSmart extracts customer info and handles requests
                  </div>
                  <div>
                    <strong className="text-white">4. Join Beta:</strong> Get early access to shape the future of AI customer interaction
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Document Management */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-400" />
                  Business Documents
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Multi-industry demo docs loaded. Upload your own for real-world testing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Upload Area */}
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm mb-2">
                    Drag & drop files or click to upload
                  </p>
                  <input
                    type="file"
                    multiple
                    accept=".pdf,.txt,.doc,.docx"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload">
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-slate-600 text-gray-300 hover:bg-slate-700"
                      disabled={isUploading}
                    >
                      {isUploading ? 'Uploading...' : 'Choose Files'}
                    </Button>
                  </label>
                </div>

                {/* Document List */}
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        selectedDocument === doc.id
                          ? 'border-purple-500 bg-purple-950'
                          : 'border-slate-600 bg-slate-700 hover:bg-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div 
                          className="flex-1 cursor-pointer"
                          onClick={() => setSelectedDocument(doc.id)}
                        >
                          <p className="text-white text-sm font-medium">{doc.name}</p>
                          <p className="text-gray-400 text-xs">{doc.type} • {doc.size}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewingDocument(doc)}
                            className="p-1 rounded text-gray-400 hover:text-purple-400 hover:bg-slate-600 transition-colors"
                            title="View document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {selectedDocument === doc.id && (
                            <Badge className="bg-purple-600 text-white">Active</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Middle Column - Voice Interface */}
          <div className="space-y-6">
            {/* Voice Controls */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader className="text-center">
                <CardTitle className="text-white flex items-center justify-center gap-2">
                  <Mic className="w-6 h-6 text-purple-400" />
                  VoiceSmart Interface
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Speak naturally about any business inquiry or customer service need
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center space-y-6">
                {/* Main Voice Button */}
                <div className="relative">
                  {voice.isListening ? (
                    <div className="relative">
                      <div className="w-32 h-32 bg-red-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Mic className="w-16 h-16 text-white" />
                      </div>
                      <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping"></div>
                      <p className="text-red-400 mt-4 font-semibold">Listening...</p>
                    </div>
                  ) : voice.isProcessing ? (
                    <div className="relative">
                      <div className="w-32 h-32 bg-purple-600 rounded-full flex items-center justify-center mx-auto animate-spin">
                        <Activity className="w-16 h-16 text-white" />
                      </div>
                      <p className="text-purple-400 mt-4 font-semibold">Processing...</p>
                    </div>
                  ) : voice.isSpeaking ? (
                    <div className="relative">
                      <div className="w-32 h-32 bg-green-600 rounded-full flex items-center justify-center mx-auto animate-pulse">
                        <Play className="w-16 h-16 text-white" />
                      </div>
                      <p className="text-green-400 mt-4 font-semibold">Speaking...</p>
                    </div>
                  ) : (
                    <div>
                      <Button
                        onClick={voice.handleVoiceInteraction}
                        disabled={!voice.isSupported || !voice.hasPermission}
                        className="w-32 h-32 rounded-full bg-slate-700 hover:bg-slate-600 border-2 border-slate-600"
                      >
                        <Mic className="w-16 h-16 text-gray-300" />
                      </Button>
                      <p className="text-gray-400 mt-4">
                        {!voice.hasPermission ? 'Click to enable microphone' : 'Click to speak'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Voice Controls */}
                <div className="flex justify-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={voice.stopListening}
                    disabled={!voice.isListening}
                    className="border-slate-600 text-gray-300 hover:bg-slate-700"
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Stop
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={voice.stopSpeaking}
                    disabled={!voice.isSpeaking}
                    className="border-slate-600 text-gray-300 hover:bg-slate-700"
                  >
                    <Pause className="w-4 h-4 mr-1" />
                    Pause
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={voice.reset}
                    className="border-slate-600 text-gray-300 hover:bg-slate-700"
                  >
                    Reset
                  </Button>
                </div>

                {/* Status Messages */}
                {voice.error && (
                  <div className="bg-red-900 p-4 rounded-lg">
                    <p className="text-red-200 text-sm">{voice.error}</p>
                  </div>
                )}

                {!voice.isSupported && (
                  <div className="bg-yellow-900 p-4 rounded-lg">
                    <p className="text-yellow-200 text-sm">
                      Voice features not supported in this browser. Try Chrome or Edge.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transcript Display */}
            {voice.transcript && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">What you said:</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-300">{voice.transcript}</p>
                </CardContent>
              </Card>
            )}

            {/* AI Response */}
            {voice.response && (
              <Card className="bg-purple-900 border-purple-700">
                <CardHeader>
                  <CardTitle className="text-white text-lg">VoiceSmart Response:</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-purple-200">{voice.response}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Results & Actions */}
          <div className="space-y-6">
            {/* Extracted Data */}
            {extractedData && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-green-400" />
                    Extracted Customer Data
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-gray-400 text-sm">Customer:</label>
                    <p className="text-white">{extractedData.customerName}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Phone:</label>
                    <p className="text-white">{extractedData.phoneNumber}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Address:</label>
                    <p className="text-white">{extractedData.address}</p>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Issue:</label>
                    <p className="text-white">{extractedData.issue}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-gray-400 text-sm">Urgency:</label>
                    <Badge className={extractedData.urgency === 'emergency' ? 'bg-red-600' : 'bg-yellow-600'}>
                      {extractedData.urgency}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-gray-400 text-sm">Estimated Cost:</label>
                    <p className="text-white font-semibold">{extractedData.estimatedCost}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Agent Booking */}
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-400" />
                  Book Agent Call
                </CardTitle>
                <CardDescription className="text-gray-400">
                  Ready to implement this for your business?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-white">15min</div>
                    <div className="text-xs text-gray-400">Setup Call</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">Free</div>
                    <div className="text-xs text-gray-400">Beta Access</div>
                  </div>
                </div>
                <Button 
                  onClick={handleBookCall}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Join VoiceSmart Beta
                </Button>
                <p className="text-xs text-gray-500 text-center">
                  Free beta access • Shape the future of AI
                </p>
              </CardContent>
            </Card>

            {/* Debug Panel */}
            {showDebug && (
              <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4 text-orange-400" />
                    Debug Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1 text-gray-300">
                  <div><strong>Voice State:</strong> {voice.isListening ? 'Listening' : voice.isProcessing ? 'Processing' : voice.isSpeaking ? 'Speaking' : 'Idle'}</div>
                  <div><strong>Supported:</strong> {voice.isSupported ? '✅' : '❌'}</div>
                  <div><strong>Permission:</strong> {voice.hasPermission ? '✅' : '❌'}</div>
                  <div><strong>Documents:</strong> {documents.length}</div>
                  <div><strong>Selected:</strong> {selectedDocument || 'None'}</div>
                  <div><strong>Browser:</strong> {typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 30) + '...' : 'N/A'}</div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Document Viewer Modal */}
        {viewingDocument && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
              <div className="flex items-center justify-between p-4 border-b border-slate-700">
                <div>
                  <h3 className="text-lg font-semibold text-white">{viewingDocument.name}</h3>
                  <p className="text-gray-400 text-sm">{viewingDocument.type} • {viewingDocument.size}</p>
                </div>
                <button
                  onClick={() => setViewingDocument(null)}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-slate-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <div className="bg-slate-900 rounded-lg p-4 text-gray-300 whitespace-pre-wrap font-mono text-sm">
                  {viewingDocument.content || 'No content available for this document.'}
                </div>
              </div>
              <div className="p-4 border-t border-slate-700">
                <div className="flex justify-between items-center">
                  <button
                    onClick={() => setSelectedDocument(viewingDocument.id)}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
                  >
                    Use as Active Document
                  </button>
                  <button
                    onClick={() => setViewingDocument(null)}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}