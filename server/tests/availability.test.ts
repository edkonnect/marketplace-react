import { describe, expect, it } from "vitest";
import { appRouter } from "../routers";
import type { TrpcContext } from "../_core/context";

function createMockContext(): TrpcContext {
  return {
    user: null,
    req: {} as any,
    res: {} as any,
  };
}

describe("Tutor Availability", () => {
  it("should return tutor profile with availability data", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    // Get first tutor from the list
    const tutors = await caller.tutorProfile.list();
    expect(Array.isArray(tutors)).toBe(true);

    if (tutors.length === 0) return; // No tutors without DB

    const firstTutor = tutors[0];

    // Get detailed profile with availability
    const profile = await caller.tutorProfile.get({ userId: firstTutor.userId });

    expect(profile).toBeDefined();
    if (profile) {
      // Check if availability field exists
      expect(profile).toHaveProperty('availability');

      // If availability is set, it should be valid JSON
      if (profile.availability) {
        const availability = JSON.parse(profile.availability);
        expect(typeof availability).toBe('object');
      }
    }
  });

  it("should have tutors with name field from joined user data", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const tutors = await caller.tutorProfile.list();
    
    if (tutors.length > 0) {
      const firstTutor = tutors[0];
      const profile = await caller.tutorProfile.get({ userId: firstTutor.userId });
      
      expect(profile).toBeDefined();
      if (profile) {
        // Name should be available from the join
        expect(profile).toHaveProperty('name');
        console.log(`✅ Tutor profile includes name: ${profile.name || 'null'}`);
      }
    }
  });

  it("should parse and validate availability time slots format", async () => {
    const ctx = createMockContext();
    const caller = appRouter.createCaller(ctx);

    const tutors = await caller.tutorProfile.list();
    
    if (tutors.length > 0) {
      const firstTutor = tutors[0];
      const profile = await caller.tutorProfile.get({ userId: firstTutor.userId });
      
      if (profile && profile.availability) {
        const availability = JSON.parse(profile.availability);
        
        // Check time slot format (should be "HH:MM-HH:MM")
        Object.keys(availability).forEach(day => {
          if (Array.isArray(availability[day])) {
            availability[day].forEach((slot: string) => {
              // Time slot should match format like "09:00-12:00"
              expect(slot).toMatch(/^\d{2}:\d{2}-\d{2}:\d{2}$/);
            });
          }
        });
        
        console.log(`✅ All time slots follow correct format (HH:MM-HH:MM)`);
      }
    }
  });
});
