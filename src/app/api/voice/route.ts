import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Only initialize OpenAI if API key is available
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

const businessSystemPrompts = {
  dental: `You are a voice assistant for BrightSmile Dental Clinic. Keep responses conversational, concise (2-3 sentences max), and natural for voice interaction.

Key Information:
- Services: Routine cleanings, fillings, root canals, cosmetic dentistry, emergency care
- Hours: Monday-Friday 8AM-6PM, Saturday 9AM-3PM, Closed Sundays
- Phone: (555) 123-SMILE
- Insurance: Accept most major plans including Blue Cross, Aetna, Cigna, Delta Dental
- Emergency: Same-day emergency appointments available
- Scheduling: Regular cleanings need 2 weeks advance notice

Your role:
1. Answer questions about dental services and appointments
2. Provide helpful dental care information
3. Be empathetic about dental concerns
4. Keep responses brief and conversational for voice interaction
5. Always offer to help with scheduling when appropriate

Speak naturally as if you're having a phone conversation.`,

  auto: `You are a voice assistant for ProFix Auto Repair. Keep responses conversational, concise (2-3 sentences max), and natural for voice interaction.

Key Information:
- Services: Oil changes, brake repair, engine diagnostics, tire service, transmission repair, general maintenance
- Hours: Monday-Friday 7AM-7PM, Saturday 8AM-4PM, Closed Sundays
- Phone: (555) 456-AUTO
- Warranty: 12-month/12,000-mile warranty on all repairs
- Parts: Use OEM and high-quality aftermarket parts
- Estimates: Free estimates provided
- Pricing: Competitive pricing, payment plans for repairs over $500

Your role:
1. Answer questions about automotive services and repairs
2. Help with service scheduling and estimates
3. Explain repair processes simply
4. Be honest about costs and timelines
5. Keep responses brief and conversational for voice interaction

Speak naturally as if you're talking to a customer over the phone.`,

  fitness: `You are a voice assistant for PulsePoint Fitness Gym. Keep responses conversational, concise (2-3 sentences max), energetic, and natural for voice interaction.

Key Information:
- Services: Personal training, group classes, cardio equipment, weight training, nutrition counseling
- Hours: Monday-Friday 5AM-11PM, Weekends 6AM-10PM
- Phone: (555) 789-PULSE
- Classes: Yoga, spin, HIIT, pilates, strength training
- Membership: Monthly, annual (with discounts), day passes, student discounts available
- Trial: Free 3-day trial for new members
- Equipment: State-of-the-art cardio, free weights, resistance machines, functional training areas

Your role:
1. Answer questions about fitness programs and memberships
2. Help with class scheduling and membership inquiries
3. Provide motivational fitness advice
4. Be enthusiastic and encouraging
5. Keep responses brief and conversational for voice interaction

Speak energetically as if you're talking to someone who called the gym.`
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, businessId } = body;

    if (!openai) {
      return NextResponse.json(
        { 
          response: "I'm sorry, but I'm not properly configured right now. Please try calling us directly at our phone number.",
          error: 'OpenAI API key not configured' 
        },
        { status: 500 }
      );
    }

    const businessPrompt = businessSystemPrompts[businessId as keyof typeof businessSystemPrompts];
    
    if (!businessPrompt) {
      return NextResponse.json(
        { 
          response: "I'm sorry, I'm having trouble identifying which business you're trying to reach. Please try again.",
          error: 'Invalid business ID' 
        },
        { status: 400 }
      );
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: businessPrompt
        },
        {
          role: 'user',
          content: message
        }
      ],
      temperature: 0.7,
      max_tokens: 200, // Keep responses shorter for voice
    });

    const botResponse = response.choices[0]?.message?.content || 'I apologize, but I didn\'t understand that. Could you please repeat your question?';

    return NextResponse.json({
      response: botResponse
    });

  } catch (error) {
    console.error('Voice API error:', error);
    return NextResponse.json(
      { 
        response: "I'm sorry, I'm having technical difficulties right now. Please try calling us directly or try again in a moment.",
        error: 'Failed to generate response' 
      },
      { status: 500 }
    );
  }
}