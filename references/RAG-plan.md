RAG-Based Voice Bot Demo Plan
This document outlines the plan for building a portfolio-ready, full-duplex RAG-based voice bot demo featuring
three selectable small business personas: BrightSmile Dental Clinic, ProFix Auto Repair, and PulsePoint Fitness
Gym. The bot uses professional-tone interactions, SOP/SLA PDFs for retrieval, and sends confirmation emails
via Resend after appointment scheduling.
1. Persona Selector
Users choose one of three personas: 1. BrightSmile Dental Clinic – Book cleanings, insurance info, post-care. 2.
ProFix Auto Repair – Schedule repairs, ask warranty/service timelines. 3. PulsePoint Fitness Gym – Reserve
classes, ask membership/training policies.
2. SOP/SLA Documents
Each persona will have a 3–5 page professionally-styled SOP and SLA document with: - Title page, version/date -
Section headings (Scope, Definitions, Procedures, Service Commitments) - Bullet points, tables, procedural tone -
SLA metrics table (response times, guarantees) - Footer: Confidential – Internal Use Only
3. Scheduling Flow with Email Confirmation
After confirming an appointment, the bot sends a branded email via Resend containing: - Business logo/name -
Appointment details - Relevant policy link - Call-to-action for confirmation or reschedule
4. Conversation Sample (Dental)
Bot: "Hello, this is BrightSmile Dental’s virtual assistant. How can I help you today?" User: "I need to book a
cleaning next Tuesday afternoon." Bot: "We have openings at 2:30 PM and 4:00 PM. Which works best?" User:
"Let’s do 4 PM." Bot: "I’ve booked you for Tuesday, August 13 at 4:00 PM. A confirmation email will arrive
shortly."
5. Technical Adjustments
- Prompt injection per persona: restrict answers to SOP/SLA content. - Store persona_id, businessName,
schedulingRules, resendFromAddress in session state. - Trigger Resend email on scheduling action.create_event.
- Dynamic frontend branding per persona.
6. Portfolio Polish
- Citations pane with document/page for each answer. - Branding swap per persona. - Evaluation sheet: 5
gold-standard Q&A; per persona. - Demo video flow: persona selection → barge-in test → email confirmation
preview.