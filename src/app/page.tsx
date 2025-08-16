'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { VoiceContainer } from '@/components/voice/VoiceContainer';
import { ArrowLeft, Phone, Car, Dumbbell, Activity, Clock } from 'lucide-react';
import { BusinessPersona } from '@/types';

const businessPersonas: BusinessPersona[] = [
  {
    id: 'dental',
    name: 'BrightSmile Dental Clinic',
    type: 'Dental Practice',
    description: 'Professional dental care with comprehensive services from routine cleanings to advanced procedures.',
    color: 'bg-gradient-to-br from-slate-50 to-cyan-50/30 border-slate-200 hover:from-slate-100 hover:to-cyan-50 shadow-sm hover:shadow-md',
    icon: <Activity className="w-8 h-8 text-cyan-600" />,
    services: ['Routine Cleanings', 'Fillings', 'Root Canals', 'Cosmetic Dentistry', 'Emergency Care'],
    hours: 'Mon-Fri: 8AM-6PM, Sat: 9AM-3PM',
    phone: '(555) 123-SMILE'
  },
  {
    id: 'auto',
    name: 'ProFix Auto Repair',
    type: 'Auto Repair Shop',
    description: 'Expert automotive repair and maintenance services with certified technicians and quality parts.',
    color: 'bg-gradient-to-br from-slate-50 to-emerald-50/30 border-slate-200 hover:from-slate-100 hover:to-emerald-50 shadow-sm hover:shadow-md',
    icon: <Car className="w-8 h-8 text-emerald-600" />,
    services: ['Oil Changes', 'Brake Repair', 'Engine Diagnostics', 'Tire Service', 'Transmission Repair'],
    hours: 'Mon-Fri: 7AM-7PM, Sat: 8AM-4PM',
    phone: '(555) 456-AUTO'
  },
  {
    id: 'fitness',
    name: 'PulsePoint Fitness Gym',
    type: 'Fitness Center',
    description: 'Modern fitness facility with personal training, group classes, and state-of-the-art equipment.',
    color: 'bg-gradient-to-br from-slate-50 to-violet-50/30 border-slate-200 hover:from-slate-100 hover:to-violet-50 shadow-sm hover:shadow-md',
    icon: <Dumbbell className="w-8 h-8 text-violet-600" />,
    services: ['Personal Training', 'Group Classes', 'Cardio Equipment', 'Weight Training', 'Nutrition Counseling'],
    hours: 'Mon-Fri: 5AM-11PM, Weekends: 6AM-10PM',
    phone: '(555) 789-PULSE'
  }
];

export default function Home() {
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
          
          {/* Voice Interface */}
          <VoiceContainer business={selectedBusiness} />
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
            <h1 className="text-3xl font-bold">Voice Assistant Demo</h1>
          </div>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Experience AI-powered voice assistants for small businesses. 
            Select a business to start a voice conversation with their intelligent assistant.
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
                    <CardTitle className="text-lg text-gray-900 dark:text-gray-100 font-semibold">{business.name}</CardTitle>
                    <CardDescription className="text-sm text-gray-700 dark:text-gray-300">{business.type}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-black dark:text-white mb-4 font-medium">
                  {business.description}
                </p>
                
                <div className="space-y-3">
                  <div>
                    <h4 className="text-sm font-medium mb-1 text-gray-800 dark:text-gray-200">Services:</h4>
                    <div className="flex flex-wrap gap-1">
                      {business.services.slice(0, 3).map((service) => (
                        <span 
                          key={service}
                          className="text-xs bg-white/80 text-gray-700 px-2 py-1 rounded-full shadow-sm"
                        >
                          {service}
                        </span>
                      ))}
                      {business.services.length > 3 && (
                        <span className="text-xs text-gray-600 dark:text-gray-400">
                          +{business.services.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    <p>{business.hours}</p>
                    <p>{business.phone}</p>
                  </div>
                </div>

                <Button className="w-full mt-4" variant="outline">
                  Start Voice Call
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
              <h3 className="font-medium">Voice Recognition</h3>
              <p className="text-sm text-muted-foreground">
                Natural speech-to-text processing with real-time conversation
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-medium">AI Responses</h3>
              <p className="text-sm text-muted-foreground">
                Business-specific AI trained on services, hours, and policies
              </p>
            </div>
            <div className="space-y-2">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                <Clock className="w-6 h-6 text-purple-600" />
              </div>
              <h3 className="font-medium">Voice Output</h3>
              <p className="text-sm text-muted-foreground">
                Text-to-speech responses for natural conversation flow
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
