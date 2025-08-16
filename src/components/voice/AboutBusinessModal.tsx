'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useVoiceStore } from '@/stores/voiceStore';
import { Info, Clock, Phone, Activity, Building2 } from 'lucide-react';

export function AboutBusinessModal() {
  const { business } = useVoiceStore();

  if (!business) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          About Business
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              {business.icon}
              <div>
                <h2 className="text-xl font-semibold">{business.name}</h2>
                <p className="text-sm text-muted-foreground font-normal">{business.type}</p>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Business Description */}
          <div>
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              About Our Business
            </h3>
            <p className="text-muted-foreground leading-relaxed">
              {business.description}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Services */}
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Our Services
              </h3>
              <div className="space-y-2">
                {business.services.map((service, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0"></div>
                    <span>{service}</span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Contact Information */}
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Business Hours
                </h3>
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded">
                  {business.hours}
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Contact Information
                </h3>
                <p className="text-sm text-muted-foreground bg-muted p-2 rounded font-mono">
                  {business.phone}
                </p>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💬 Ready to Chat?</h4>
            <p className="text-sm text-blue-800 dark:text-blue-200 mb-3">
              Use the voice assistant to ask questions about our services, hours, pricing, or to schedule an appointment. 
              Our AI assistant has detailed knowledge about {business.name} and can help with your inquiries.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                Ask about services
              </span>
              <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                Check availability
              </span>
              <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                Get pricing info
              </span>
              <span className="text-xs bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full">
                Schedule appointment
              </span>
            </div>
          </div>

          {/* Business Type Specific Info */}
          {business.id === 'dental' && (
            <div className="bg-cyan-50 dark:bg-cyan-950 rounded-lg p-4 border border-cyan-200 dark:border-cyan-800">
              <h4 className="font-semibold text-cyan-900 dark:text-cyan-100 mb-2">🦷 Dental Care Excellence</h4>
              <p className="text-sm text-cyan-800 dark:text-cyan-200">
                We provide comprehensive dental care with state-of-the-art equipment and experienced professionals. 
                From routine cleanings to complex procedures, we're here to keep your smile healthy and bright.
              </p>
            </div>
          )}

          {business.id === 'auto' && (
            <div className="bg-emerald-50 dark:bg-emerald-950 rounded-lg p-4 border border-emerald-200 dark:border-emerald-800">
              <h4 className="font-semibold text-emerald-900 dark:text-emerald-100 mb-2">🚗 Automotive Excellence</h4>
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                Our certified technicians use the latest diagnostic tools and quality parts to keep your vehicle running smoothly. 
                We stand behind our work with comprehensive warranties and honest, transparent service.
              </p>
            </div>
          )}

          {business.id === 'fitness' && (
            <div className="bg-violet-50 dark:bg-violet-950 rounded-lg p-4 border border-violet-200 dark:border-violet-800">
              <h4 className="font-semibold text-violet-900 dark:text-violet-100 mb-2">💪 Fitness & Wellness</h4>
              <p className="text-sm text-violet-800 dark:text-violet-200">
                Our modern facility features top-of-the-line equipment and expert trainers to help you achieve your fitness goals. 
                Whether you're a beginner or an athlete, we have programs tailored to your needs.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}