import express from 'express';
import * as db from '../db';
import { generateCurriculumPDF, generatePaymentReceipt } from './pdf-generator';


export const pdfRouter = express.Router();

pdfRouter.get('/curriculum/:courseId', async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    
    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }
    
    const course = await db.getCourseById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    if (!course.curriculum) {
      return res.status(400).json({ error: 'Course has no curriculum' });
    }
    
    // Get tutor information
    const tutors = await db.getTutorsForCourse(courseId);
    const tutorName = tutors && tutors.length > 0 ? tutors[0].user.name || 'Unknown' : 'Unknown';
    
    // Generate PDF
    const pdfStream = generateCurriculumPDF({
      courseTitle: course.title,
      subject: course.subject,
      gradeLevel: course.gradeLevel,
      tutorName,
      curriculum: course.curriculum,
      price: course.price,
      duration: course.duration,
      sessionsPerWeek: course.sessionsPerWeek,
      totalSessions: course.totalSessions,
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${course.title.replace(/[^a-z0-9]/gi, '_')}_Curriculum.pdf"`);
    
    // Pipe the PDF stream to response
    pdfStream.pipe(res);
  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
});

pdfRouter.get('/receipt/:paymentId', async (req, res) => {
  try {
    const paymentId = parseInt(req.params.paymentId);
    
    if (isNaN(paymentId)) {
      return res.status(400).json({ error: 'Invalid payment ID' });
    }
    
    // Get payment details
    const payment = await db.getPaymentById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    // Get parent details
    const parent = await db.getUserById(payment.parentId);
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }
    
    // Get tutor details
    const tutor = await db.getUserById(payment.tutorId);
    
    // Get course and subscription details
    let courseName = 'Course';
    let studentName = 'Student';
    let installmentInfo = undefined;
    
    if (payment.subscriptionId) {
      const subscription = await db.getSubscriptionById(payment.subscriptionId);
      if (subscription) {
        const course = await db.getCourseById(subscription.courseId);
        if (course) {
          courseName = course.title;
        }
        
        if (subscription.studentFirstName && subscription.studentLastName) {
          studentName = `${subscription.studentFirstName} ${subscription.studentLastName}`;
        }
        
        // Check if this is an installment payment
        if (subscription.paymentPlan === 'installment') {
          const firstAmount = parseFloat(subscription.firstInstallmentAmount || '0');
          const secondAmount = parseFloat(subscription.secondInstallmentAmount || '0');
          const totalAmount = firstAmount + secondAmount;
          const paidAmount = parseFloat(payment.amount);
          
          // Determine which installment this is
          let installmentNumber = 1;
          let remainingAmount = secondAmount;
          
          if (subscription.firstInstallmentPaid && Math.abs(paidAmount - secondAmount) < 0.01) {
            installmentNumber = 2;
            remainingAmount = 0;
          }
          
          installmentInfo = {
            installmentNumber,
            totalInstallments: 2,
            remainingAmount: remainingAmount.toFixed(2),
          };
        }
      }
    }
    
    // Generate receipt number
    const receiptNumber = `EDK-${payment.id.toString().padStart(6, '0')}`;
    
    // Generate PDF
    const pdfStream = generatePaymentReceipt({
      receiptNumber,
      paymentDate: payment.createdAt,
      parentName: parent.name || 'Parent',
      parentEmail: parent.email,
      courseName,
      tutorName: tutor?.name || 'Tutor',
      studentName,
      amount: payment.amount,
      currency: payment.currency,
      paymentMethod: 'Credit Card',
      transactionId: payment.stripePaymentIntentId,
      paymentType: payment.paymentType,
      installmentInfo,
    });
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Receipt_${receiptNumber}.pdf"`);
    
    // Pipe the PDF stream to response
    pdfStream.pipe(res);
  } catch (error) {
    console.error('Error generating receipt PDF:', error);
    res.status(500).json({ error: 'Failed to generate receipt' });
  }
});
