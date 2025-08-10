import React from 'react';

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

export interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  isVoice?: boolean;
  ragSources?: string[];
}

export interface AppointmentData {
  name: string;
  phone: string;
  email: string;
  service: string;
  date: string;
  time: string;
}