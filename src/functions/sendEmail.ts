import nodemailer from 'nodemailer';
import { EmailResponse } from '../../types/index.ts';
import { logger } from '../../utils/logger.ts';
import dotenv from "dotenv";

dotenv.config();

// Email sending function

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
): Promise<string> {
  try {
    // Create mail options
    const mailOptions = {
      from: process.env.EMAIL,
      to: to,
      subject: subject,
      html: body, // Using HTML format for the email body
    };

    // Send the email using the transporter
    const info = await transporter.sendMail(mailOptions);

    logger.info(`Email sent: ${info.messageId}`);

    const emailResponse: EmailResponse = {
      success: true,
      message: `Email sent to ${to}`,
      details: {
        to,
        subject,
        timestamp: new Date().toISOString(),
      },
    };

    return JSON.stringify(emailResponse);
  } catch (error) {
    logger.error('Error sending email:', error);
    return JSON.stringify({
      success: false,
      error: 'Failed to send email',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
