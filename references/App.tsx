import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { VoiceBotInterface } from './components/VoiceBotInterface';
import { ArrowLeft, Phone, Car, Dumbbell, Activity } from 'lucide-react';

export interface BusinessPersona {
  id: string;
  name: string;
  type: string;
  description: string;
  color: string;
  icon: React.ReactNode;
  services: string[];
  hours: string;
  phone: string;
}

const businessPersonas: BusinessPersona[] = [
  {
    id: 'dental',
    name: 'BrightSmile Dental Clinic',
    type: 'Dental Practice',
    description: 'Professional dental care with comprehensive services from routine cleanings to advanced procedures.',
    color: 'bg-blue-50 border-blue-200 hover:bg-blue-100',
    icon: <Activity className="w-8 h-8 text-blue-600" />,
    services: ['Routine Cleanings', 'Fillings', 'Root Canals', 'Cosmetic Dentistry', 'Emergency Care'],
    hours: 'Mon-Fri: 8AM-6PM, Sat: 9AM-3PM',
    phone: '(555) 123-SMILE'
  },
  {
    id: 'auto',
    name: 'ProFix Auto Repair',
    type: 'Auto Repair Shop',
    description: 'Expert automotive repair and maintenance services with certified technicians and quality parts.',
    color: 'bg-green-50 border-green-200 hover:bg-green-100',
    icon: <Car className="w-8 h-8 text-green-600" />,
    services: ['Oil Changes', 'Brake Repair', 'Engine Diagnostics', 'Tire Service', 'Transmission Repair'],
    hours: 'Mon-Fri: 7AM-7PM, Sat: 8AM-4PM',
    phone: '(555) 456-AUTO'
  },
  {
    id: 'fitness',
    name: 'PulsePoint Fitness Gym',
    type: 'Fitness Center',
    description: 'Modern fitness facility with personal training, group classes, and state-of-the-art equipment.',
    color: 'bg-purple-50 border-purple-200 hover:bg-purple-100',
    icon: <Dumbbell className="w-8 h-8 text-purple-600" />,
    services: ['Personal Training', 'Group Classes', 'Cardio Equipment', 'Weight Training', 'Nutrition Counseling'],
    hours: 'Mon-Fri: 5AM-11PM, Weekends: 6AM-10PM',
    phone: '(555) 789-PULSE'
  }
];

export default function App() {
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessPersona | null>(null);

  if (selectedBusiness) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="outline"
              onClick={() => setSelectedBusiness(null)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Businesses
            </Button>
            <div className="flex items-center gap-3">
              {selectedBusiness.icon}
              <div>
                <h1 className="text-xl font-semibold">{selectedBusiness.name}</h1>
                <p className="text-sm text-muted-foreground">{selectedBusiness.type}</p>
              </div>
            </div>
          </div>
          <VoiceBotInterface business={selectedBusiness} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Phone className="w-8 h-8 text-primary" />
            <h1 className="text-3xl font-bold">RAG Voice Bot Demo</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience AI-powered voice assistants for small businesses. 
            Select a business to interact with their intelligent voice bot system.
          </p>
        </div>

        {/* Business Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {businessPersonas.map((business) => (
            <Card 
              key={business.id} 
              className={`cursor-pointer transition-all duration-200 ${business.color}`}
              onClick={() => setSelectedBusiness(business)}
            >
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  {business.icon}
                  <div>
                    <CardTitle className="text-lg">{business.name}</CardTitle>
                    <CardDescription className="text-sm">{business.type}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {business.description}
                </p>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-1">Services:</h4>
                    <div className="flex flex-wrap gap-1">
                      {business.services.slice(0, 3).map((service) => (
                        <span 
                          key={service}
                          className="text-xs bg-white/60 px-2 py-1 rounded-full"
                        >
                          {service}
                        </span>
                      ))}
                      {business.services.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{business.services.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-muted-foreground">
                    <p>{business.hours}</p>
                    <p>{business.phone}</p>
                  </div>
                </div>

                <Button className="w-full mt-4" variant="outline">
                  Start Voice Chat
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Features */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-semibold mb-8">Demo Features</h2>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="space-y-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                <Phone className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-medium">Full-Duplex Voice</h3>
              <p className="text-sm text-muted-foreground">
                Natural conversation flow with real-time voice processing
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <div className="w-6 h-6 bg-green-600 rounded"></div>
              </div>
              <h3 className="font-medium">RAG-Based Knowledge</h3>
              <p className="text-sm text-muted-foreground">
                Retrieval from business SOPs and SLA documents
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <div className="w-6 h-6 bg-purple-600 rounded"></div>
              </div>
              <h3 className="font-medium">Smart Scheduling</h3>
              <p className="text-sm text-muted-foreground">
                Appointment booking with email confirmations
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}