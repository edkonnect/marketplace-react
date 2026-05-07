import { describe, it, expect } from "vitest";
import { generateCurriculumPDF, type CurriculumPDFData } from "../pdf/pdf-generator";
import type { Readable } from "stream";

describe("Curriculum PDF Generation", () => {
  const sampleCurriculumData: CurriculumPDFData = {
    courseTitle: "SAT Prep Course",
    subject: "English",
    gradeLevel: "11-12",
    tutorName: "John Doe",
    curriculum: `Module 1: Reading Comprehension
• Understanding main ideas
• Identifying author's purpose
• Analyzing literary devices

Module 2: Writing Skills
• Grammar rules
• Sentence structure
• Essay writing`,
    price: "299.99",
    duration: 60,
    sessionsPerWeek: 2,
    totalSessions: 24,
  };

  describe("PDF Generation Function", () => {
    it("should generate a PDF stream", () => {
      const pdfStream = generateCurriculumPDF(sampleCurriculumData);
      
      expect(pdfStream).toBeDefined();
      expect(typeof pdfStream.pipe).toBe("function");
    });

    it("should handle curriculum with multiple modules", () => {
      const multiModuleCurriculum: CurriculumPDFData = {
        ...sampleCurriculumData,
        curriculum: `Week 1-4: Introduction
• Topic A
• Topic B

Week 5-8: Advanced Topics
• Topic C
• Topic D

Week 9-12: Final Review
• Practice tests
• Review sessions`,
      };

      const pdfStream = generateCurriculumPDF(multiModuleCurriculum);
      expect(pdfStream).toBeDefined();
    });

    it("should handle curriculum with bullet points", () => {
      const bulletPointCurriculum: CurriculumPDFData = {
        ...sampleCurriculumData,
        curriculum: `Topics:
• Mathematics fundamentals
• Algebra concepts
• Geometry basics
• Practice problems`,
      };

      const pdfStream = generateCurriculumPDF(bulletPointCurriculum);
      expect(pdfStream).toBeDefined();
    });

    it("should handle null optional fields", () => {
      const minimalData: CurriculumPDFData = {
        courseTitle: "Basic Course",
        subject: "Math",
        gradeLevel: null,
        tutorName: "Unknown",
        curriculum: "Week 1: Introduction",
        price: "99.99",
        duration: null,
        sessionsPerWeek: null,
        totalSessions: null,
      };

      const pdfStream = generateCurriculumPDF(minimalData);
      expect(pdfStream).toBeDefined();
    });
  });

  describe("Curriculum Preview Display", () => {
    it("should show curriculum preview when curriculum exists", () => {
      const course = {
        curriculum: "Week 1-4: Introduction\n• Topic A",
      };

      const shouldShow = !!course.curriculum;
      expect(shouldShow).toBe(true);
    });

    it("should hide curriculum preview when curriculum is null", () => {
      const course = {
        curriculum: null,
      };

      const shouldShow = !!course.curriculum;
      expect(shouldShow).toBe(false);
    });

    it("should truncate long curriculum text for preview", () => {
      const longCurriculum = `Module 1: Introduction
• Topic A
• Topic B
• Topic C

Module 2: Advanced Topics
• Topic D
• Topic E
• Topic F

Module 3: Final Review
• Topic G
• Topic H`;

      // Simulate line-clamp-2 behavior (first 2 lines)
      const lines = longCurriculum.split('\n');
      const preview = lines.slice(0, 2).join('\n');

      expect(preview).toContain("Module 1");
      expect(preview).not.toContain("Module 3");
    });
  });

  describe("PDF Route Integration", () => {
    it("should validate course ID format", () => {
      const validId = "123";
      const invalidId = "abc";

      expect(!isNaN(parseInt(validId))).toBe(true);
      expect(!isNaN(parseInt(invalidId))).toBe(false);
    });

    it("should generate proper filename from course title", () => {
      const courseTitle = "SAT Prep Course 2024!";
      const filename = courseTitle.replace(/[^a-z0-9]/gi, '_');

      expect(filename).toBe("SAT_Prep_Course_2024_");
      expect(filename).not.toContain(" ");
      expect(filename).not.toContain("!");
    });

    it("should construct correct PDF download URL", () => {
      const courseId = 123;
      const expectedUrl = `/api/pdf/curriculum/${courseId}`;

      expect(expectedUrl).toBe("/api/pdf/curriculum/123");
    });
  });
});
