// Sample business documents for demo purposes
// These will be ingested into the RAG system for each tenant

export const businessDocuments = {
  dental: [
    {
      title: "Dental Services and Procedures",
      content: `At BrightSmile Dental Clinic, we offer comprehensive dental care for the whole family. Our services include:

PREVENTIVE CARE:
- Routine dental cleanings and exams (recommended every 6 months)
- Fluoride treatments for cavity prevention
- Dental sealants for children and adults
- Oral cancer screenings
- Digital X-rays with minimal radiation exposure

RESTORATIVE DENTISTRY:
- Tooth-colored fillings using composite materials
- Dental crowns and bridges for damaged or missing teeth
- Root canal therapy to save infected teeth
- Tooth extractions when necessary
- Partial and complete dentures

COSMETIC DENTISTRY:
- Professional teeth whitening (in-office and take-home options)
- Porcelain veneers for smile makeovers
- Invisalign clear aligners for orthodontic treatment
- Smile design consultations

EMERGENCY DENTAL CARE:
- Same-day appointments for dental emergencies
- Treatment for severe tooth pain, broken teeth, or dental trauma
- After-hours emergency contact available
- Pain management and temporary repairs

All procedures are performed using the latest dental technology and techniques. We prioritize patient comfort and use local anesthesia, nitrous oxide, or sedation options as needed.`,
      documentType: "services",
      sourceUrl: "https://brightsmile.example.com/services"
    },
    {
      title: "Insurance and Payment Information",
      content: `BrightSmile Dental Clinic accepts most major dental insurance plans and offers flexible payment options:

ACCEPTED INSURANCE PLANS:
- Blue Cross Blue Shield (all plans)
- Aetna Dental
- Cigna Dental
- Delta Dental (PPO and Premier)
- MetLife Dental
- Guardian Dental
- United Healthcare Dental
- Humana Dental

PAYMENT OPTIONS:
- Cash, check, or credit/debit cards accepted
- CareCredit financing available (0% interest for qualified patients)
- Payment plans for treatments over $500
- Family discount available for multiple family members

INSURANCE VERIFICATION:
- We verify your insurance benefits before treatment
- Pre-treatment estimates provided for major procedures
- We file insurance claims electronically for faster processing
- Maximum insurance benefits tracking throughout the year

COSTS AND FEES:
- Cleaning and exam: $150-200 (covered 100% by most insurance)
- Fillings: $150-300 depending on size and location
- Crowns: $1,200-1,500 (typically 50% covered by insurance)
- Root canals: $800-1,200 (typically 50-80% covered)
- Teeth whitening: $400-600 (cosmetic, not covered by insurance)

Payment is due at the time of service unless other arrangements have been made. We offer a 5% discount for payment in full at the time of treatment.`,
      documentType: "billing",
      sourceUrl: "https://brightsmile.example.com/insurance"
    },
    {
      title: "Scheduling and Office Policies",
      content: `OFFICE HOURS:
Monday - Friday: 8:00 AM - 6:00 PM
Saturday: 9:00 AM - 3:00 PM
Sunday: Closed

SCHEDULING APPOINTMENTS:
- Routine cleanings should be scheduled 2-3 weeks in advance
- Emergency appointments available same day
- New patient appointments require 1 hour for comprehensive exam
- Online scheduling available through our patient portal
- Text and email appointment reminders sent 24 hours prior

APPOINTMENT POLICIES:
- Please arrive 15 minutes early for check-in
- Bring your insurance card and photo ID to every appointment
- 24-hour notice required for cancellations
- Missed appointments without notice may incur a $50 fee
- Children under 16 must be accompanied by a parent or guardian

NEW PATIENT PROCESS:
- Complete health history forms (available online)
- Comprehensive oral exam including cancer screening
- Digital X-rays as needed
- Treatment plan discussion and cost estimates
- Next appointment scheduled before leaving

OFFICE POLICIES:
- We maintain strict sterilization and infection control protocols
- All equipment is sanitized between patients
- We follow OSHA and CDC guidelines for patient safety
- Patient privacy protected under HIPAA regulations
- Medication and allergy information kept current in patient records

EMERGENCY CONTACT:
For after-hours dental emergencies, call our main number (555) 123-SMILE. The answering service will contact Dr. Johnson or Dr. Smith for urgent matters.`,
      documentType: "policies",
      sourceUrl: "https://brightsmile.example.com/policies"
    }
  ],

  auto: [
    {
      title: "Automotive Services and Repairs",
      content: `ProFix Auto Repair provides comprehensive automotive services for all makes and models of vehicles:

ROUTINE MAINTENANCE:
- Oil changes (conventional, full synthetic, high-mileage)
- Tire rotation and balancing
- Brake inspection and pad replacement
- Battery testing and replacement
- Air filter and cabin filter replacement
- Transmission fluid service
- Coolant system flush and fill
- Tune-ups and spark plug replacement

DIAGNOSTIC SERVICES:
- Computer diagnostic scanning (OBD-II)
- Engine performance diagnostics
- Electrical system troubleshooting
- AC and heating system diagnosis
- Check engine light diagnosis
- Pre-purchase vehicle inspections
- State inspection and emissions testing

MAJOR REPAIRS:
- Engine rebuilds and replacement
- Transmission repair and replacement
- Brake system overhauls
- Suspension and steering repairs
- Exhaust system replacement
- Timing belt and water pump replacement
- Clutch replacement (manual transmissions)

SPECIALIZED SERVICES:
- Fleet vehicle maintenance
- Classic car restoration services
- Performance modifications
- Diesel engine service
- Hybrid vehicle service
- European import specialists

All repairs come with our 12-month/12,000-mile warranty. We use OEM and high-quality aftermarket parts. Free estimates provided for all major repairs.`,
      documentType: "services",
      sourceUrl: "https://profixauto.example.com/services"
    },
    {
      title: "Warranty and Pricing Information",
      content: `WARRANTY COVERAGE:
ProFix Auto Repair stands behind our work with comprehensive warranty coverage:

- 12 months OR 12,000 miles warranty on all repairs (whichever comes first)
- Parts and labor coverage included
- Nationwide warranty honored at participating shops
- Warranty transferable if vehicle is sold
- Free re-inspection if warranty issues arise

PRICING STRUCTURE:
- Labor rate: $125 per hour (competitive market rate)
- Free estimates for repairs over $200
- Price matching available for competitive written estimates
- Senior citizen discount: 10% on labor
- Military discount: 15% on labor with valid ID

PAYMENT OPTIONS:
- Cash, check, and all major credit cards accepted
- Payment plans available for repairs over $500
- 90 days same as cash financing available
- We work with insurance companies for covered repairs
- Rental car assistance for major repairs

PARTS POLICY:
- We use OEM (original equipment manufacturer) parts when available
- High-quality aftermarket parts for cost-effective repairs
- Used parts available for older vehicles (with limited warranty)
- Customer can provide their own parts (labor-only warranty applies)

COST ESTIMATES:
- Oil change: $35-85 depending on oil type
- Brake pads: $150-300 per axle
- Battery replacement: $120-200 installed
- Alternator replacement: $400-600
- Transmission service: $200-300
- Engine diagnostics: $125 (applied to repair cost)

All estimates are valid for 30 days. Prices may vary based on vehicle make, model, and year.`,
      documentType: "warranty",
      sourceUrl: "https://profixauto.example.com/warranty"
    },
    {
      title: "Shop Policies and Procedures",
      content: `BUSINESS HOURS:
Monday - Friday: 7:00 AM - 7:00 PM
Saturday: 8:00 AM - 4:00 PM
Sunday: Closed
Emergency roadside assistance available 24/7

SCHEDULING AND APPOINTMENTS:
- Walk-ins welcome for quick services (oil changes, inspections)
- Appointments recommended for major repairs
- Online appointment scheduling available
- Loaner vehicles available for repairs taking more than one day
- Shuttle service provided within 10-mile radius

DROP-OFF PROCEDURES:
- Keys can be left in secure drop-box for early morning drop-off
- Detailed work authorization required for repairs over $100
- We will contact you before exceeding estimated repair costs
- Digital photos of repair areas provided upon request

QUALITY ASSURANCE:
- ASE-certified technicians
- State-of-the-art diagnostic equipment
- Clean, organized shop environment
- Regular equipment calibration and maintenance
- Continuous technician training on new vehicle technologies

CUSTOMER SERVICE POLICIES:
- Courtesy vehicle inspection with every service
- Written estimates provided for all recommendations
- No surprise charges - all additional work requires approval
- Detailed invoices explaining all work performed
- Customer satisfaction survey follow-up

ENVIRONMENTAL COMMITMENT:
- Proper disposal of used oil, filters, and fluids
- Recycling program for old batteries and tires
- EPA-compliant waste management procedures
- Use of environmentally friendly cleaning products

SAFETY PROTOCOLS:
- All vehicles road-tested after repairs
- Safety inspection checklist completed
- Proper torque specifications followed
- Quality control checks before vehicle delivery`,
      documentType: "policies",
      sourceUrl: "https://profixauto.example.com/policies"
    }
  ],

  fitness: [
    {
      title: "Fitness Programs and Classes",
      content: `PulsePoint Fitness Gym offers a wide variety of fitness programs designed for all fitness levels:

GROUP FITNESS CLASSES:
- High-Intensity Interval Training (HIIT) - Monday, Wednesday, Friday 6 AM & 6 PM
- Yoga (Vinyasa, Hatha, Hot Yoga) - Daily classes at various times
- Spin/Cycling classes - Tuesday, Thursday, Saturday 7 AM & 5 PM
- Pilates mat and reformer classes - Monday through Friday
- Strength training bootcamp - Tuesday, Thursday 6:30 PM
- Zumba dance fitness - Wednesday, Friday 7 PM
- Senior fitness (55+) - Monday, Wednesday 10 AM
- Aqua aerobics (seasonal) - Summer months only

PERSONAL TRAINING:
- One-on-one personal training sessions
- Small group training (2-4 people)
- Specialized training: weight loss, muscle building, sports-specific
- Nutrition coaching and meal planning
- Fitness assessments and progress tracking
- Injury rehabilitation support

SPECIALTY PROGRAMS:
- 30-day fitness challenges
- Weight loss programs with nutritionist support
- Marathon and 5K training groups
- Teen fitness programs (ages 13-17)
- Corporate wellness programs
- Prenatal and postnatal fitness classes

EQUIPMENT AND FACILITIES:
- Full range of cardio equipment (treadmills, ellipticals, bikes)
- Complete free weight section with dumbbells up to 150 lbs
- Cable machines and functional trainers
- Olympic lifting platform and squat racks
- Separate women's-only workout area
- Stretching and flexibility zone
- Locker rooms with showers and lockers

All programs include initial fitness consultation and goal-setting session. Class schedules updated monthly and available on our mobile app.`,
      documentType: "programs",
      sourceUrl: "https://pulsepointfitness.example.com/programs"
    },
    {
      title: "Membership Options and Pricing",
      content: `MEMBERSHIP PLANS:
PulsePoint Fitness offers flexible membership options to fit your lifestyle and budget:

BASIC MEMBERSHIP - $29/month:
- Access to gym equipment during staffed hours
- Basic locker room facilities
- One guest pass per month
- Access to mobile app with workout tracking

UNLIMITED MEMBERSHIP - $49/month:
- 24/7 gym access with key fob
- Unlimited group fitness classes
- Guest privileges (up to 4 guests per month)
- Discounted personal training rates
- Free fitness assessment quarterly

PREMIUM MEMBERSHIP - $79/month:
- All unlimited membership benefits
- Two personal training sessions per month included
- Priority class reservations
- Access to premium amenities (sauna, massage chairs)
- Nutrition consultation included
- Free guest passes for friends and family

SPECIAL RATES:
- Student discount: 20% off with valid student ID
- Senior discount (65+): 15% off all memberships
- Military/First responder: 25% off with valid ID
- Family plans: Second family member 50% off
- Corporate memberships: Contact for group rates

ADDITIONAL FEES:
- Enrollment fee: $50 (waived with annual membership)
- Key fob replacement: $25
- Guest day pass: $15
- Towel service: $10/month
- Personal training: $60-80 per session
- Nutrition coaching: $100 per consultation

TRIAL MEMBERSHIPS:
- 3-day free trial for new members
- 7-day trial membership: $25
- No long-term contracts required
- Month-to-month options available
- 30-day money-back guarantee for new members

Payment options include monthly bank draft, credit card, or annual payment with discount.`,
      documentType: "membership",
      sourceUrl: "https://pulsepointfitness.example.com/membership"
    },
    {
      title: "Gym Rules and Safety Guidelines",
      content: `GYM HOURS AND ACCESS:
Monday - Friday: 5:00 AM - 11:00 PM
Saturday - Sunday: 6:00 AM - 10:00 PM
24/7 access available for Unlimited and Premium members

GENERAL GYM RULES:
- Proper athletic attire required (no jeans, sandals, or bare feet)
- Clean, closed-toe athletic shoes mandatory
- Shirts required at all times
- Towels required for equipment use (bring your own or rent)
- 30-minute time limit on cardio equipment during peak hours
- Re-rack all weights after use
- Wipe down equipment after each use

SAFETY GUIDELINES:
- Warm up before intense exercise
- Ask for spotting assistance when lifting heavy weights
- Report any equipment malfunctions immediately
- Follow posted weight limits on all equipment
- Children under 13 not permitted in main workout areas
- Teens 13-17 must complete safety orientation and be supervised

LOCKER ROOM POLICIES:
- Day-use lockers available free of charge
- Overnight storage not permitted (locks will be removed)
- Personal belongings left unattended are at owner's risk
- Monthly locker rental available for $15
- Shower facilities available with complimentary towels for Premium members

CLASS ETIQUETTE:
- Arrive 5 minutes early for setup
- Sign up in advance for popular classes
- Notify instructor of any injuries or limitations
- Stay for entire class duration when possible
- Clean and return all equipment after class

GUEST POLICIES:
- Guests must be accompanied by member at all times
- Guest waiver required before first visit
- Guest day passes available for purchase
- Monthly guest limits apply based on membership type

DISCIPLINARY ACTIONS:
- Verbal warning for first violations
- Temporary suspension for serious or repeated violations
- Membership termination for harassment, unsafe behavior, or damage to property`,
      documentType: "policies",
      sourceUrl: "https://pulsepointfitness.example.com/policies"
    }
  ]
};

// Function to seed documents for a specific tenant
export async function seedDocumentsForTenant(tenantId: string, businessType: 'dental' | 'auto' | 'fitness') {
  const documents = businessDocuments[businessType];
  
  if (!documents) {
    throw new Error(`No documents available for business type: ${businessType}`);
  }

  return documents.map(doc => ({
    ...doc,
    metadata: {
      seeded: true,
      seedDate: new Date().toISOString(),
      businessType
    }
  }));
}

// Default tenants for seeding
export const defaultTenants = [
  {
    id: '550e8400-e29b-41d4-a716-446655440001',
    name: 'BrightSmile Dental Clinic',
    businessType: 'dental' as const
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440002',
    name: 'ProFix Auto Repair',
    businessType: 'auto' as const
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440003',
    name: 'PulsePoint Fitness Gym',
    businessType: 'fitness' as const
  }
];