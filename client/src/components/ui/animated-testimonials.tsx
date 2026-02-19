"use client";

import { IconArrowLeft, IconArrowRight } from "@tabler/icons-react";
import { motion, AnimatePresence } from "motion/react";
import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Testimonial = {
  quote: string;
  name: string;
  designation: string;
  initials: string; // e.g. "SB"
  rating: number; // 1-5
};

export const AnimatedTestimonials = ({
  testimonials,
  autoplay = false,
}: {
  testimonials: Testimonial[];
  autoplay?: boolean;
}) => {
  // ✅ Guard: never let this component crash on empty input
  const safeTestimonials = useMemo(
    () => (Array.isArray(testimonials) ? testimonials.filter(Boolean) : []),
    [testimonials]
  );

  const [active, setActive] = useState(0);

  // ✅ Keep active index valid if data length changes
  useEffect(() => {
    if (!safeTestimonials.length) return;
    if (active > safeTestimonials.length - 1) setActive(0);
  }, [safeTestimonials.length, active]);

  const handleNext = () => {
    if (!safeTestimonials.length) return;
    setActive(prev => (prev + 1) % safeTestimonials.length);
  };

  const handlePrev = () => {
    if (!safeTestimonials.length) return;
    setActive(
      prev => (prev - 1 + safeTestimonials.length) % safeTestimonials.length
    );
  };

  const isActive = (index: number) => index === active;

  useEffect(() => {
    if (!autoplay || !safeTestimonials.length) return;
    const interval = setInterval(handleNext, 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, safeTestimonials.length]);

  const randomRotateY = () => Math.floor(Math.random() * 21) - 10;

  if (!safeTestimonials.length) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center text-muted-foreground">
        No testimonials yet.
      </div>
    );
  }

  const current = safeTestimonials[active];
  const clampedRating = Math.max(0, Math.min(5, Number(current.rating ?? 0)));

  return (
    <div className="mx-auto max-w-sm px-4 py-6 font-sans antialiased md:max-w-4xl md:px-8 lg:px-12">
      <div className="relative grid grid-cols-1 gap-10 md:grid-cols-2 md:gap-14">
        {/* Left: Animated initials "cards" stack */}
        <div>
          <div className="relative h-56 w-full">
            <AnimatePresence>
              {safeTestimonials.map((t, index) => (
                <motion.div
                  key={`${t.initials}-${index}`}
                  initial={{
                    opacity: 0,
                    scale: 0.9,
                    z: -100,
                    rotate: randomRotateY(),
                  }}
                  animate={{
                    opacity: isActive(index) ? 1 : 0.6,
                    scale: isActive(index) ? 1 : 0.95,
                    z: isActive(index) ? 0 : -100,
                    rotate: isActive(index) ? 0 : randomRotateY(),
                    zIndex: isActive(index)
                      ? 40
                      : safeTestimonials.length + 2 - index,
                    y: isActive(index) ? [0, -18, 0] : 0, // toned down (your -80 is too jumpy)
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0.9,
                    z: 100,
                    rotate: randomRotateY(),
                  }}
                  transition={{
                    duration: 0.4,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 origin-bottom"
                >
                  {/* ✅ Replace img with initials avatar card */}
                  <div
                    className="
  h-full w-full rounded-3xl
  bg-card
  border border-border
  shadow-xl
  ring-1 ring-black/5
  dark:ring-white/10
  flex items-center justify-center
"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <div className="h-30 w-40 rounded-full bg-primary/10 text-primary flex items-center justify-center text-4xl font-bold tracking-tight">
                        {t.initials || "U"}
                      </div>
                      <div className="text-center">
                        <div className="font-semibold text-foreground">
                          {t.name}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Right: Quote + rating + controls */}
        <div className="flex flex-col justify-between py-1">
          <motion.div
            key={active}
            initial={{ y: 18, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -18, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
          >
            <h3 className="text-2xl font-bold text-white">
              {current.name}
            </h3>
            <p className="text-sm text-white/70">
              {current.designation}
            </p>

            <motion.p className="mt-4 text-lg text-white/90">
              {current.quote.split(" ").map((word, index) => (
                <motion.span
                  key={`${word}-${index}`}
                  initial={{ filter: "blur(10px)", opacity: 0, y: 6 }}
                  animate={{ filter: "blur(0px)", opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.22,
                    ease: "easeInOut",
                    delay: 0.02 * index,
                  }}
                  className="inline-block"
                >
                  {word}&nbsp;
                </motion.span>
              ))}
            </motion.p>

            {/* ✅ Stars under quote */}
            <div className="mt-4 mb-2 flex items-center gap-1">
              {Array.from({ length: clampedRating }).map((_, i) => (
                <Star
                  key={i}
                  className="h-4 w-4 fill-yellow-400 text-yellow-400"
                />
              ))}
              {clampedRating < 5 &&
                Array.from({ length: 5 - clampedRating }).map((_, i) => (
                  <Star
                    key={`e-${i}`}
                    className="h-4 w-4 text-white/30"
                  />
                ))}
            </div>
          </motion.div>

          <div className="flex gap-4 mt-6">
            <button
              onClick={handlePrev}
              aria-label="Previous testimonial"
              className="group/button flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm hover:bg-white/20 transition"
            >
              <IconArrowLeft className="h-5 w-5 duration-300 group-hover/button:rotate-12" />
            </button>

            <button
              onClick={handleNext}
              aria-label="Next testimonial"
              className="group/button flex h-9 w-9 items-center justify-center rounded-full border border-white/30 bg-white/10 backdrop-blur-sm hover:bg-white/20 transition"
            >
              <IconArrowRight className="h-5 w-5 text-foreground/80 transition-transform duration-300 group-hover/button:-rotate-12" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
