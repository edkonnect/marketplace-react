import { describe, it, expect } from 'vitest';
import * as db from '../db';

describe('Home Page Data API', () => {
  describe('Platform Stats', () => {
    it('should return an array from getPlatformStats', async () => {
      const stats = await db.getPlatformStats();
      expect(Array.isArray(stats)).toBe(true);
    });

    it('should return stats in correct display order when data exists', async () => {
      const stats = await db.getPlatformStats();
      for (let i = 1; i < stats.length; i++) {
        expect(stats[i].displayOrder).toBeGreaterThanOrEqual(stats[i - 1].displayOrder);
      }
    });

    it('should only return active stats', async () => {
      const stats = await db.getPlatformStats();
      stats.forEach(stat => {
        expect(stat.isActive).toBe(true);
      });
    });
  });

  describe('Featured Courses', () => {
    it('should return an array from getFeaturedCourses', async () => {
      const courses = await db.getFeaturedCourses();
      expect(Array.isArray(courses)).toBe(true);
    });

    it('should return courses in correct display order when data exists', async () => {
      const courses = await db.getFeaturedCourses();
      for (let i = 1; i < courses.length; i++) {
        expect(courses[i].displayOrder).toBeGreaterThanOrEqual(courses[i - 1].displayOrder);
      }
    });

    it('should only return active courses', async () => {
      const courses = await db.getFeaturedCourses();
      courses.forEach(course => {
        expect(course.isActive).toBe(true);
      });
    });
  });

  describe('Testimonials', () => {
    it('should return an array from getTestimonials', async () => {
      const testimonials = await db.getTestimonials();
      expect(Array.isArray(testimonials)).toBe(true);
    });

    it('should return testimonials in correct display order when data exists', async () => {
      const testimonials = await db.getTestimonials();
      for (let i = 1; i < testimonials.length; i++) {
        expect(testimonials[i].displayOrder).toBeGreaterThanOrEqual(testimonials[i - 1].displayOrder);
      }
    });

    it('should only return active testimonials', async () => {
      const testimonials = await db.getTestimonials();
      testimonials.forEach(testimonial => {
        expect(testimonial.isActive).toBe(true);
      });
    });
  });

  describe('FAQs', () => {
    it('should return an array from getFaqs', async () => {
      const faqs = await db.getFaqs();
      expect(Array.isArray(faqs)).toBe(true);
    });

    it('should return FAQs in correct display order when data exists', async () => {
      const faqs = await db.getFaqs();
      for (let i = 1; i < faqs.length; i++) {
        expect(faqs[i].displayOrder).toBeGreaterThanOrEqual(faqs[i - 1].displayOrder);
      }
    });

    it('should only return active FAQs', async () => {
      const faqs = await db.getFaqs();
      faqs.forEach(faq => {
        expect(faq.isActive).toBe(true);
      });
    });
  });

  describe('Data Structure', () => {
    it('should return stats with expected properties when data exists', async () => {
      const stats = await db.getPlatformStats();
      if (stats.length > 0) {
        const stat = stats[0];
        expect(stat).toHaveProperty('id');
        expect(stat).toHaveProperty('label');
        expect(stat).toHaveProperty('value');
        expect(stat).toHaveProperty('isActive');
      }
    });

    it('should return courses with expected properties when data exists', async () => {
      const courses = await db.getFeaturedCourses();
      if (courses.length > 0) {
        const course = courses[0];
        expect(course).toHaveProperty('id');
        expect(course).toHaveProperty('title');
        expect(course).toHaveProperty('isActive');
      }
    });

    it('should return testimonials with expected properties when data exists', async () => {
      const testimonials = await db.getTestimonials();
      if (testimonials.length > 0) {
        const t = testimonials[0];
        expect(t).toHaveProperty('id');
        expect(t).toHaveProperty('parentName');
        expect(t).toHaveProperty('content');
        expect(t).toHaveProperty('rating');
        expect(t).toHaveProperty('isActive');
      }
    });

    it('should return FAQs with expected properties when data exists', async () => {
      const faqs = await db.getFaqs();
      if (faqs.length > 0) {
        const faq = faqs[0];
        expect(faq).toHaveProperty('id');
        expect(faq).toHaveProperty('question');
        expect(faq).toHaveProperty('answer');
        expect(faq).toHaveProperty('isActive');
      }
    });
  });
});
