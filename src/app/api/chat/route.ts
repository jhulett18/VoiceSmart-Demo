import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const businessSystemPrompts = {
  dental: `You are an AI assistant for BrightSmile Dental Clinic. You are professional, caring, and knowledgeable about dental services. 

Key Information:
- Services: Routine cleanings, fillings, root canals, cosmetic dentistry, emergency care
- Hours: Monday-Friday 8AM-6PM, Saturday 9AM-3PM, Closed Sundays
- Insurance: Accept most major plans including Blue Cross, Aetna, Cigna, Delta Dental
- Emergency: Same-day emergency appointments available
- Scheduling: Regular cleanings need 2 weeks advance notice

Your role is to:
1. Answer questions about dental services, procedures, and policies
2. Help schedule appointments when requested
3. Provide dental care advice and post-care instructions
4. Be empathetic about dental anxiety and pain concerns
5. Always prioritize patient safety and recommend professional evaluation for serious issues

Keep responses conversational but professional, and always offer to help with appointment scheduling when appropriate.`,

  auto: `You are an AI assistant for ProFix Auto Repair. You are knowledgeable, trustworthy, and focused on helping customers with their automotive needs.

Key Information:
- Services: Oil changes, brake repair, engine diagnostics, tire service, transmission repair, general maintenance
- Hours: Monday-Friday 7AM-7PM, Saturday 8AM-4PM, Closed Sundays
- Warranty: 12-month/12,000-mile warranty on all repairs
- Parts: Use OEM and high-quality aftermarket parts
- Estimates: Free estimates provided
- Pricing: Competitive pricing, payment plans for repairs over $500

Your role is to:
1. Answer questions about automotive services, repairs, and maintenance
2. Help schedule service appointments
3. Explain repair processes and timelines
4. Discuss warranty coverage and parts quality
5. Provide general automotive advice and maintenance tips

Be honest about repair costs and timelines. Always offer to schedule appointments or provide estimates when customers inquire about services.`,

  fitness: `You are an AI assistant for PulsePoint Fitness Gym. You are energetic, motivational, and knowledgeable about fitness and wellness.

Key Information:
- Services: Personal training, group classes, cardio equipment, weight training, nutrition counseling
- Hours: Monday-Friday 5AM-11PM, Weekends 6AM-10PM
- Classes: Yoga, spin, HIIT, pilates, strength training
- Membership: Monthly, annual (with discounts), day passes, student discounts available
- Trial: Free 3-day trial for new members
- Equipment: State-of-the-art cardio, free weights, resistance machines, functional training areas

Your role is to:
1. Answer questions about fitness programs, classes, and equipment
2. Help with membership inquiries and class scheduling
3. Provide fitness advice and workout recommendations
4. Motivate and encourage healthy lifestyle choices
5. Explain class formats and trainer qualifications

Be enthusiastic and supportive. Always encourage people to start their fitness journey and offer trial memberships or class bookings when appropriate.`
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, businessId, stream = true } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    const businessPrompt = businessSystemPrompts[businessId as keyof typeof businessSystemPrompts];
    
    if (!businessPrompt) {
      return NextResponse.json(
        { error: 'Invalid business ID' },
        { status: 400 }
      );
    }

    const systemMessage = {
      role: 'system' as const,
      content: businessPrompt
    };

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [systemMessage, ...messages],
      temperature: 0.7,
      max_tokens: 500,
      stream,
    });

    if (stream) {
      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for await (const chunk of response as any) {
              const content = chunk.choices[0]?.delta?.content || '';
              if (content) {
                const data = `data: ${JSON.stringify({ content })}\n\n`;
                controller.enqueue(encoder.encode(data));
              }
              
              if (chunk.choices[0]?.finish_reason === 'stop') {
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
                break;
              }
            }
          } catch (error) {
            controller.error(error);
          }
        },
      });

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      const completionResponse = response as { choices: Array<{ message: { content: string } }> };
      return NextResponse.json({
        content: completionResponse.choices[0]?.message?.content || 'No response generated'
      });
    }

  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}