/**
 * Email Service for EdKonnect Academy
 * Handles sending transactional emails using nodemailer
 */

import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    // Check if email credentials are configured
    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_PASSWORD;
    const emailHost = process.env.EMAIL_HOST || 'email-smtp.us-east-1.amazonaws.com';
    const emailPort = Number(process.env.EMAIL_PORT) || 587;

    if (emailUser && emailPassword) {
      try {
        this.transporter = nodemailer.createTransport({
          host: emailHost,
          port: emailPort,
          secure: false,
          auth: {
            user: emailUser,
            pass: emailPassword,
          },
        });

        await this.transporter.verify();
        this.isConfigured = true;
        console.log('[Email Service] Email service connected to SMTP server');
      } catch (error) {
        console.error('[Email Service] Failed to initialize:', error);
        this.isConfigured = false;
      }
    } else {
      console.warn('[Email Service] Email credentials not configured. Emails will be logged but not sent.');
      this.isConfigured = false;
    }
  }

  /**
   * Send an email
   */
  async sendEmail(options: EmailOptions): Promise<boolean> {
    const { to, subject, html, text } = options;

    // If not configured, log the email instead of sending
    if (!this.isConfigured || !this.transporter) {
      console.log('[Email Service] Email would be sent (not configured):');
      console.log(`  To: ${to}`);
      console.log(`  Subject: ${subject}`);
      console.log(`  HTML Length: ${html.length} characters`);
      
      // In development, we can still return true to allow the flow to continue
      if (process.env.NODE_ENV === 'development') {
        return true;
      }
      return false;
    }

    try {
      const from = process.env.EMAIL_FROM
        ? `"EdKonnect Academy" <${process.env.EMAIL_FROM}>`
        : `"EdKonnect Academy" <${process.env.EMAIL_USER}>`;

      const info = await this.transporter.sendMail({
        from,
        to,
        subject,
        text: text || this.stripHtml(html),
        html,
      });

      console.log('[Email Service] Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('[Email Service] Email send failed:', error);
      return false;
    }
  }

  /**
   * Strip HTML tags for plain text fallback
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>.*<\/style>/gm, '')
      .replace(/<script[^>]*>.*<\/script>/gm, '')
      .replace(/<[^>]+>/gm, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if email service is configured and ready
   */
  isReady(): boolean {
    return this.isConfigured;
  }

  /**
   * Verify email configuration
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      console.log('[Email Service] Connection verified successfully');
      return true;
    } catch (error) {
      console.error('[Email Service] Connection verification failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export types
export type { EmailOptions };
