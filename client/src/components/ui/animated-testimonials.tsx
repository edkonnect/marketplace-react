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
  src?: string; // optional photo URL
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
  const [modalOpen, setModalOpen] = useState(false);

  const WORD_LIMIT = 40;

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
                  {/* Photo if available, else initials */}
                  <div
                    className="
  h-full w-full rounded-3xl
  bg-card
  border border-border
  shadow-xl
  ring-1 ring-black/5
  dark:ring-white/10
  flex items-center justify-center
  overflow-hidden
"
                  >
                    {t.src ? (
                      <img
                        src={t.src}
                        alt={t.name}
                        className="h-full w-full object-cover object-center rounded-3xl"
                      />
                    ) : (
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
                    )}
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

            {(() => {
              const words = current.quote.split(" ");
              const isTruncatable = words.length > WORD_LIMIT;
              const visibleWords = isTruncatable ? words.slice(0, WORD_LIMIT) : words;
              return (
                <div className="mt-4">
                  <motion.p className="text-lg text-white/90">
                    {visibleWords.map((word, index) => (
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
                    {isTruncatable && (
                      <span className="inline-block text-white/50">…</span>
                    )}
                  </motion.p>
                  {isTruncatable && (
                    <button
                      onClick={() => setModalOpen(true)}
                      className="mt-2 text-sm font-medium text-white/60 hover:text-white/90 transition-colors underline underline-offset-2"
                    >
                      Show more
                    </button>
                  )}
                </div>
              );
            })()}

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
      {/* Full review modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setModalOpen(false)}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            >
              ✕
            </button>
            <div className="mb-4 flex items-center gap-3">
              {current.src ? (
                <img src={current.src} alt={current.name} className="h-12 w-12 rounded-full object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center text-lg font-bold">
                  {current.initials || "U"}
                </div>
              )}
              <div>
                <p className="font-semibold text-slate-900">{current.name}</p>
                <p className="text-sm text-slate-500">{current.designation}</p>
              </div>
            </div>
            <p className="text-base leading-7 text-slate-700">"{current.quote}"</p>
            <div className="mt-4 flex items-center gap-1">
              {Array.from({ length: clampedRating }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              ))}
              {clampedRating < 5 && Array.from({ length: 5 - clampedRating }).map((_, i) => (
                <Star key={`e-${i}`} className="h-4 w-4 text-slate-200" />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
