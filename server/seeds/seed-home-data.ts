/**
 * Seed script for home page dynamic data
 * Populates platform statistics, featured courses, testimonials, and FAQs
 */

import { getDb } from '../db';
import { platformStats, featuredCourses, testimonials, faqs } from '../../drizzle/schema';

async function seedHomeData() {
  const db = await getDb();
  if (!db) {
    console.error('[Seed] Database not available');
    process.exit(1);
  }

  console.log('[Seed] Starting home page data seeding...');

  try {
    // Clear existing data
    await db.delete(platformStats);
    await db.delete(featuredCourses);
    await db.delete(testimonials);
    await db.delete(faqs);
    console.log('[Seed] Cleared existing home page data');

    // Seed platform statistics
    const stats = [
      {
        label: 'Hours Learned',
        value: '100K+',
        description: 'Hours Learned',
        displayOrder: 1,
        isActive: true,
      },
      {
        label: 'Highest SAT Score',
        value: '1600',
        description: 'Highest SAT Score',
        displayOrder: 2,
        isActive: true,
      },
      {
        label: 'Yearly Savings',
        value: '$2,000',
        description: 'Yearly Savings',
        displayOrder: 3,
        isActive: true,
      },
      {
        label: 'Expert Tutors',
        value: '250+',
        description: 'Expert Tutors',
        displayOrder: 4,
        isActive: true,
      },
    ];

    for (const stat of stats) {
      await db.insert(platformStats).values(stat);
    }
    console.log(`[Seed] Created ${stats.length} platform statistics`);

    // Seed featured courses
    const courses = [
      {
        title: 'SAT Tutoring',
        description: 'Comprehensive SAT prep with proven strategies to boost your scores and college admission chances.',
        icon: 'TrendingUp',
        priceFrom: '65.00',
        displayOrder: 1,
        isActive: true,
      },
      {
        title: 'AP Calculus',
        description: 'Master calculus concepts and ace your AP exam with personalized instruction from experienced tutors.',
        icon: 'Calculator',
        priceFrom: '70.00',
        displayOrder: 2,
        isActive: true,
      },
      {
        title: 'Geometry',
        description: 'Build strong foundations in geometry with engaging lessons tailored for middle school students.',
        icon: 'Shapes',
        priceFrom: '50.00',
        displayOrder: 3,
        isActive: true,
      },
      {
        title: 'Python Coding',
        description: 'Learn programming fundamentals and build real projects with hands-on Python coding instruction.',
        icon: 'Code',
        priceFrom: '60.00',
        displayOrder: 4,
        isActive: true,
      },
    ];

    for (const course of courses) {
      await db.insert(featuredCourses).values(course);
    }
    console.log(`[Seed] Created ${courses.length} featured courses`);

    // Seed testimonials
    const testimonialData = [
      {
        parentName: 'Jennifer Martinez',
        parentInitials: 'JM',
        parentRole: 'Parent of 8th grader',
        content: 'EdKonnect Academy has been a game-changer for our family. My daughter\'s math grades improved dramatically after just two months with her tutor. The scheduling system makes it so easy to manage sessions!',
        rating: 5,
        displayOrder: 1,
        isActive: true,
      },
      {
        parentName: 'Robert Patel',
        parentInitials: 'RP',
        parentRole: 'Parent of 10th grader',
        content: 'Finding a qualified science tutor was always challenging until we discovered EdKonnect Academy. The platform is intuitive, and the messaging feature helps us stay in touch with our tutor between sessions.',
        rating: 5,
        displayOrder: 2,
        isActive: true,
      },
      {
        parentName: 'Lisa Chen',
        parentInitials: 'LC',
        parentRole: 'Parent of 6th grader',
        content: 'As a working parent, the ability to schedule and pay for sessions online is invaluable. My son loves his English tutor, and I can see his confidence growing with each session. Highly recommend!',
        rating: 5,
        displayOrder: 3,
        isActive: true,
      },
    ];

    for (const testimonial of testimonialData) {
      await db.insert(testimonials).values(testimonial);
    }
    console.log(`[Seed] Created ${testimonialData.length} testimonials`);

    // Seed FAQs
    const faqData = [
      {
        question: 'How does pricing work?',
        answer: 'Tutors set their own hourly rates based on their experience and expertise. You can filter tutors by your budget and see transparent pricing before booking. Most sessions range from $30-$80 per hour. There are no hidden fees or subscription costs—you only pay for the sessions you book.',
        displayOrder: 1,
        isActive: true,
      },
      {
        question: 'What is your cancellation policy?',
        answer: 'You can cancel or reschedule sessions up to 24 hours before the scheduled time for a full refund. Cancellations made less than 24 hours in advance may be subject to a cancellation fee at the tutor\'s discretion. We recommend communicating with your tutor directly if you need to make last-minute changes.',
        displayOrder: 2,
        isActive: true,
      },
      {
        question: 'How are tutors vetted and qualified?',
        answer: 'All tutors on EdKonnect Academy undergo a thorough verification process including background checks, credential verification, and subject expertise assessment. We review their educational background, teaching experience, and require professional references. Parents can also view ratings, reviews, and detailed profiles before selecting a tutor.',
        displayOrder: 3,
        isActive: true,
      },
      {
        question: 'Is my payment information secure?',
        answer: 'Absolutely. We use Stripe, a leading payment processor trusted by millions of businesses worldwide. Your payment information is encrypted and never stored on our servers. All transactions are PCI-DSS compliant, ensuring bank-level security for your financial data.',
        displayOrder: 4,
        isActive: true,
      },
      {
        question: 'Can I try a session before committing?',
        answer: 'Yes! Many tutors offer a discounted first session or a free consultation call to ensure it\'s a good fit. You can discuss this directly with the tutor through our messaging platform before booking your first session. There\'s no long-term commitment required.',
        displayOrder: 5,
        isActive: true,
      },
      {
        question: 'What subjects and grade levels do you cover?',
        answer: 'EdKonnect Academy covers a wide range of subjects from elementary to college level, including Math, Science, English, Foreign Languages, Test Prep (SAT, ACT, AP), Computer Science, and more. Use our search and filter tools to find tutors specializing in your specific needs.',
        displayOrder: 6,
        isActive: true,
      },
    ];

    for (const faq of faqData) {
      await db.insert(faqs).values(faq);
    }
    console.log(`[Seed] Created ${faqData.length} FAQs`);

    console.log('[Seed] ✅ Home page data seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed] Error seeding data:', error);
    process.exit(1);
  }
}

// Run the seed function
seedHomeData();
