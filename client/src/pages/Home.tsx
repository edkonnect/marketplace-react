import React from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import Navigation from "@/components/Navigation";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import {
  GraduationCap,
  Calendar,
  MessageSquare,
  CreditCard,
  Star,
  Users,
  BookOpen,
  TrendingUp,
  Calculator,
  Shapes,
  Code,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import { StatNumber } from "@/components/motion-primitives/StatNumber";
import { AnimatedTestimonials } from "@/components/ui/animated-testimonials";

// Icon mapping for featured courses
const iconMap: Record<string, React.ComponentType<any>> = {
  TrendingUp,
  Calculator,
  Shapes,
  Code,
};

const features = [
  {
    icon: Users,
    title: "Find Perfect Matches",
    description:
      "Search and filter through qualified tutors by subject, grade level, availability, and pricing to find the perfect fit for your child's needs.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    description:
      "Book tutoring sessions with an intuitive calendar interface. View availability, schedule recurring sessions, and receive automatic reminders.",
  },
  {
    icon: MessageSquare,
    title: "In-App Messaging",
    description:
      "Communicate directly with tutors through our secure messaging platform. Discuss progress, share resources, and coordinate schedules.",
  },
  {
    icon: CreditCard,
    title: "Secure Payments",
    description:
      "Subscribe to courses or pay per session with confidence. Integrated Stripe payment processing ensures secure transactions.",
  },
  {
    icon: BookOpen,
    title: "Progress Tracking",
    description:
      "Monitor learning progress with session history, tutor feedback, and performance notes. Stay informed about your child's development.",
  },
  {
    icon: Star,
    title: "Ratings & Reviews",
    description:
      "Make informed decisions with tutor ratings and reviews from other parents. Share your own experiences to help the community.",
  },
];

const scrollReveal = {
  initial: { opacity: 0, y: 30, scale: 0.98 },
  whileInView: { opacity: 1, y: 0, scale: 1 },
  viewport: { once: false, amount: 0.2 },
  transition: { duration: 0.6, delay: 0.2, ease: [0.33, 1, 0.68, 1] },
} as const;

const listItemReveal: Variants = {
  hidden: { opacity: 0, x: -28 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, delay: i * 0.16, ease: [0.33, 1, 0.68, 1] as const },
  }),
};

export default function Home() {
  const { isAuthenticated, user } = useAuth();

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: "start", dragFree: true });

  React.useEffect(() => {
    if (!emblaApi) return;
    const id = setInterval(() => emblaApi.scrollNext(), 3000);
    return () => clearInterval(id);
  }, [emblaApi]);

  const scrollPrev = React.useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = React.useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // Fetch home page data from database
  const { data: stats = [] } = trpc.home.stats.useQuery();
  const { data: featuredCoursesData = [] } = trpc.home.featuredCourses.useQuery();
  const { data: testimonialsData = [] } = trpc.home.testimonials.useQuery();
  const { data: faqsData = [] } = trpc.home.faqs.useQuery();
  const { data: blogPostsData = [], isLoading: blogPostsLoading } = trpc.home.blogPosts.useQuery({ limit: 3 });

  const learningFeatures = [
    {
      icon: Users,
      title: "Easy Enrollment",
      description:
        "Sign up in minutes and start browsing qualified tutors. Simple course enrollment with secure Stripe payment processing makes getting started effortless.",
    },
    {
      icon: Users,
      title: "Multi-Student Management",
      description:
        "Manage courses and sessions for multiple children from a single parent account. Track each student's progress individually with dedicated dashboards.",
    },
    {
      icon: LayoutDashboard,
      title: "Comprehensive Dashboard",
      description:
        "Intuitive dashboard to manage all your courses, view upcoming sessions, schedule new tutoring sessions, and communicate with tutors through in-app messaging.",
    },
    {
      icon: TrendingUp,
      title: "Progress Tracking & Reports",
      description:
        "Monitor learning progress with detailed session history, tutor feedback, and performance metrics. Stay informed about your child's academic development.",
    },
  ];

  const animatedTestimonials = (testimonialsData ?? []).map((t) => ({
    quote: t.content,
    name: t.parentName,
    designation: t.parentRole ?? "Parent",
    initials: t.parentInitials,
    rating: t.rating ?? 5,
  }));

  const getDashboardLink = () => {
    if (user?.role === "admin") return "/admin/dashboard";
    if (user?.role === "tutor") return "/tutor/dashboard";
    if (user?.role === "parent") return "/parent/dashboard";
    return "/role-selection";
  };
  const phrases = [
    "Personalized Learning",
    "Elite Mentorship",
    "Academic Excellence",
  ];
    const [index, setIndex] = useState(0);
  
    useEffect(() => {
      const interval = setInterval(() => {
        setIndex((prev) => (prev + 1) % phrases.length);
      }, 3000); // change every 3 seconds
  
      return () => clearInterval(interval);
    }, []);  

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navigation />

      {/* Hero Section */}
      <motion.section className="relative py-20 lg:py-32 overflow-hidden" {...scrollReveal}>
        {/* Background image */}
        <div
    className="absolute inset-0 z-0 bg-center bg-cover bg-no-repeat"
    style={{ backgroundImage: "url(/images/connect_img.png)", backgroundPosition: "center 65%" }}
  />
       
        {/* Contrast overlay */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/70 via-black/55 to-black/35" />
        <div className="absolute inset-0 z-20 backdrop-blur-[2px] saturate-90" />

        <div className="container relative z-30">
          <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-3xl sm:text-4xl lg:text-6xl font-bold mb-6 tracking-tight text-white text-center">
  
  {/* Line 1 */}
  <span className="block">
    Connect with Expert Tutors
  </span>

  {/* Line 2 */}
  <span className="block whitespace-nowrap">
    for{" "}
    <span className="inline-block min-w-[1ch] align-baseline">
      <AnimatePresence mode="wait">
        <motion.span
          key={phrases[index]}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="inline-block"
        >
          {phrases[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  </span>

</h1>

            <p className="text-lg lg:text-xl text-white/80 mb-8 leading-relaxed">
              EdKonnect Academy brings together dedicated parents and qualified tutors to create meaningful one-on-one learning
              experiences. Schedule sessions, track progress, and communicate seamlessly—all in one platform.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Button asChild size="lg" className="text-lg px-8">
                  <Link href={getDashboardLink()}>Go to Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="text-lg px-8">
                    <Link href="/signup">Sign Up</Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="text-lg px-8 border-white/50 text-white hover:bg-white/10"
                  >
                    <Link href="/tutors">Browse Tutors</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section className="py-20 bg-muted/30" {...scrollReveal}>
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Everything You Need for Successful Tutoring</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              A comprehensive platform designed to make tutoring simple, effective, and enjoyable for both parents and tutors.
            </p>
          </div>

          <div className="relative">
            <div className="flex justify-end gap-3 mb-4">
              <Button variant="outline" size="icon" onClick={scrollPrev} aria-label="Previous feature">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={scrollNext} aria-label="Next feature">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex -mx-3">
                {features.map((feature, index) => {
                  const Icon = feature.icon;
                  const isAccent = index % 2 === 1;

                  return (
                    <div
                      key={feature.title}
                      className="px-3 flex-[0_0_100%] sm:flex-[0_0_50%] lg:flex-[0_0_33.333%]"
                    >
                      <Card className="border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-elegant h-full">
                        <CardContent className="pt-6 h-full flex flex-col">
                          <div
                            className={`w-12 h-12 rounded-lg ${
                              isAccent ? "bg-accent/10 text-accent" : "bg-primary/10 text-primary"
                            } flex items-center justify-center mb-4`}
                          >
                            <Icon className="w-6 h-6" />
                          </div>
                          <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                          <p className="text-muted-foreground flex-1">{feature.description}</p>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* Traction Statistics Section (animated numbers + keep new description field) */}
      <motion.section className="py-20" {...scrollReveal}>
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Trusted by Thousands</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Join a thriving community of learners and educators achieving remarkable results.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {stats.map((stat) => (
              <Card
                key={stat.id}
                className="text-center p-8 hover:shadow-elegant transition-all duration-600 border-border/50"
              >
                <CardContent className="p-0">
                  <StatNumber value={stat.value} />
                  <div className="text-sm lg:text-base text-muted-foreground font-medium">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </motion.section>

      {/* Popular Courses Section */}
      <motion.section className="py-20 bg-muted/30" {...scrollReveal}>
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Popular Courses</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Explore our most sought-after courses with expert tutors ready to help you succeed.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredCoursesData.map((course, index) => {
              const IconComponent = course.icon ? iconMap[course.icon] : TrendingUp;
              const isAccent = index % 2 === 1;

              return (
                <Card
                  key={course.id}
                  className="border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-elegant group"
                >
                  <CardContent className="pt-6">
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${
                        isAccent ? "from-accent/20 to-accent/10" : "from-primary/20 to-primary/10"
                      } flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                    >
                      <IconComponent className={`w-7 h-7 ${isAccent ? "text-accent" : "text-primary"}`} />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{course.title}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{course.description}</p>
                    <div className="flex items-center justify-between pt-4 border-t border-border">
                      <span className="text-sm text-muted-foreground">From</span>
                      <span className="text-lg font-bold text-primary">${course.priceFrom}/hr</span>
                    </div>
                    <Button asChild className="w-full mt-4" variant="outline">
                      <Link href="/courses">View Courses</Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* Testimonials Section (animated testimonials + keep new data source) */}
      <motion.section className="py-20" {...scrollReveal}>
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">What Parents Are Saying</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Hear from families who have transformed their children's learning experience with EdKonnect Academy.
            </p>
          </div>

          {animatedTestimonials.length > 0 ? (
            <AnimatedTestimonials testimonials={animatedTestimonials} />
          ) : (
            <div className="text-center text-muted-foreground">No testimonials yet.</div>
          )}
        </div>
      </motion.section>

      {/* Features Section */}
      <motion.section className="py-20 bg-gradient-to-br from-primary/5 via-accent/5 to-background" {...scrollReveal}>
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Powerful Features for Modern Learning</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage tutoring sessions, track progress, and achieve academic success—all in one platform.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Features List */}
            <div className="space-y-8">
              {learningFeatures.map((item, index) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    className="flex gap-4"
                    custom={index}
                    variants={listItemReveal}
                    initial="hidden"
                    whileInView="visible"
                    viewport={{ once: true, amount: 0.35 }}
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                      <p className="text-muted-foreground">{item.description}</p>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Mobile Mockup */}
            <div className="flex justify-center lg:justify-end">
              <img
                src="/images/mobile-mockup.png"
                alt="EdKonnect Academy Mobile App Dashboard"
                className="w-full max-w-md drop-shadow-2xl"
              />
            </div>
          </div>
        </div>
      </motion.section>

      {/* FAQ Section */}
      <motion.section className="py-20" {...scrollReveal}>
        <div className="container max-w-6xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto">
              Quick answers about enrollment, scheduling, pricing, and working with tutors—plus ways to reach a human if you need more help.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2 space-y-4">
              <Accordion type="single" collapsible>
                {faqsData.map((faq, index) => (
                  <AccordionItem
                    key={faq.id}
                    value={`item-${index + 1}`}
                    className="border border-border/60 rounded-xl px-6 bg-card/80 backdrop-blur"
                  >
                    <AccordionTrigger className="text-left hover:no-underline">
                      <span className="font-semibold text-base lg:text-lg">{faq.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground leading-relaxed">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <Card className="border-border/60 sticky top-24 shadow-sm">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Still need help?</h3>
                    <p className="text-sm text-muted-foreground">
                      Talk with our team for enrollment questions or to match with a tutor faster.
                    </p>
                  </div>
                </div>

                <div className="rounded-lg bg-muted/40 border border-border/60 p-4 space-y-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Live chat</span>
                    <span className="text-primary font-semibold">Weekdays 9a–6p</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Email</span>
                    <span className="font-semibold">support@edkonnect.com</span>
                  </div>
                </div>

                <Button asChild className="w-full">
                  <Link href="/contact">Contact Support</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/tutors">Find a Tutor</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.section>

      {/* Blog Section */}
      <motion.section className="py-20 bg-muted/30" {...scrollReveal}>
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold mb-4">Latest from Our Blog</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Insights, strategies, and tips to help you achieve academic excellence.
            </p>
          </div>

          {blogPostsLoading ? (
            <div className="grid md:grid-cols-3 gap-8">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="h-48 bg-muted animate-pulse" />
                  <CardContent className="p-6">
                    <div className="h-4 bg-muted rounded animate-pulse mb-4" />
                    <div className="h-6 bg-muted rounded animate-pulse mb-3" />
                    <div className="h-4 bg-muted rounded animate-pulse" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : blogPostsData.length > 0 ? (
            <div className="relative overflow-hidden">
              <style>
                {`
                  @keyframes blog-marquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                  }
                `}
              </style>

              {/* Edge fade masks for a smoother entrance/exit */}
              <div className="pointer-events-none absolute left-0 top-0 h-full w-16 bg-gradient-to-r from-muted/30 via-muted/10 to-transparent z-10" />
              <div className="pointer-events-none absolute right-0 top-0 h-full w-16 bg-gradient-to-l from-muted/30 via-muted/10 to-transparent z-10" />

              {/* Continuous marquee track */}
              <div
                className="flex gap-6 w-max"
                style={{ animation: "blog-marquee 28s linear infinite" }}
              >
                {[...blogPostsData, ...blogPostsData].map((post, idx) => (
                  <Card
                    key={`${post.id}-${idx}`}
                    className="overflow-hidden hover:shadow-lg transition-shadow group min-w-[260px] md:min-w-[300px] lg:min-w-[320px] max-w-[320px]"
                  >
                    {post.coverImageUrl && (
                      <div className="h-48 overflow-hidden">
                        <img
                          src={post.coverImageUrl}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    )}
                    <CardContent className="p-6">
                      {post.category && (
                        <span className="inline-block px-3 py-1 text-xs font-semibold text-primary bg-primary/10 rounded-full mb-3">
                          {post.category}
                        </span>
                      )}
                      <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{post.title}</h3>
                      <p className="text-muted-foreground mb-4 line-clamp-3">{post.excerpt}</p>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        {post.readTime && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-4 h-4" />
                            {post.readTime} min read
                          </span>
                        )}
                        {post.publishedAt && (
                          <span>
                            {new Date(post.publishedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No blog posts available at the moment.</p>
            </div>
          )}

          {blogPostsData.length === 0 && !blogPostsLoading && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No blog posts available at the moment.</p>
            </div>
          )}
        </div>
      </motion.section>

      {/* CTA Section */}
      <motion.section className="py-20 bg-gradient-to-br from-primary/10 via-accent/10 to-background" {...scrollReveal}>
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl lg:text-4xl font-bold mb-6">Ready to Get Started?</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join EdKonnect Academy today and discover the perfect tutor for your child's learning journey.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isAuthenticated ? (
                <Button asChild size="lg" className="text-lg px-8">
                  <Link href={getDashboardLink()}>Go to Dashboard</Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="lg" className="text-lg px-8">
                    <Link href="/signup">Sign Up Free</Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="text-lg px-8">
                    <Link href="/tutors">Browse Tutors</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 bg-muted/30">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <GraduationCap className="w-6 h-6 text-primary" />
                <span className="font-bold text-lg">EdKonnect Academy</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Connecting parents and tutors for personalized learning experiences.
              </p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">For Parents</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/tutors" className="hover:text-primary transition-colors">
                    Find Tutors
                  </Link>
                </li>
                <li>
                  <Link href="/courses" className="hover:text-primary transition-colors">
                    Browse Courses
                  </Link>
                </li>
                <li>
                  <Link href="/signup" className="hover:text-primary transition-colors">
                    Sign Up
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">For Tutors</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/signup" className="hover:text-primary transition-colors">
                    Become a Tutor
                  </Link>
                </li>
                <li>
                  <Link href="/tutor/dashboard" className="hover:text-primary transition-colors">
                    Tutor Dashboard
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <Link href="/" className="hover:text-primary transition-colors">
                    About Us
                  </Link>
                </li>
                <li>
                  <Link href="/" className="hover:text-primary transition-colors">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/" className="hover:text-primary transition-colors">
                    Privacy Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/50 mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>© 2026 EdKonnect Academy. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
