import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client if API key is available
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// Contractor-specific system prompt
const contractorSystemPrompt = `You are a professional intake assistant for Tampa Bay Plumbing, a trusted plumbing contractor in Tampa, Florida. Your job is to collect essential information from customers calling about plumbing issues and convert their needs into structured data for appointment scheduling.

SERVICES & PRICING:
- Emergency repairs (leaks, bursts): $150-$500
- Drain cleaning: $100-$200  
- Water heater service/replacement: $200-$800
- Fixture installation: $100-$300
- Routine maintenance: $80-$150

SCHEDULING:
- Emergency calls: Same day service available
- Routine repairs: Usually next business day
- Installations: 2-3 day lead time
- Hours: Monday-Friday 7AM-6PM, Emergency weekends

RESPONSE STYLE:
Be professional, empathetic, and efficient. Ask clarifying questions to understand:
1. Customer name and phone number
2. Property address in Tampa Bay area
3. Specific plumbing issue and urgency level
4. Preferred timing for service
5. Any relevant details (water damage, tenant/owner, etc.)

Always reassure customers that Tampa Bay Plumbing will resolve their issue promptly and professionally. For emergencies, emphasize quick response time.`;

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();
    
    // Check if OpenAI is configured
    if (!openai) {
      return NextResponse.json(
        { 
          reply: "I apologize, but our AI service is currently unavailable. Please call Tampa Bay Plumbing directly at (813) 555-PIPE for immediate assistance.",
          error: "OpenAI API key not configured" 
        },
        { status: 500 }
      );
    }

    // Make the API call to OpenAI
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: contractorSystemPrompt
        },
        {
          role: "user", 
          content: message
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || 
      "I apologize, but I'm having trouble processing your request right now. Please call Tampa Bay Plumbing directly at (813) 555-PIPE.";

    return NextResponse.json({ reply });

  } catch (error) {
    console.error('Voice API Error:', error);
    
    return NextResponse.json(
      { 
        reply: "I'm experiencing technical difficulties. For immediate plumbing assistance, please call Tampa Bay Plumbing at (813) 555-PIPE.",
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}