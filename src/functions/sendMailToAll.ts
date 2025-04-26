import { logger } from '../utils/logger.ts';
import dotenv from 'dotenv';
import csv from 'csv-parser';
import { sendEmail } from './index.ts';
import fetch from 'node-fetch';
import { Readable } from 'stream';
dotenv.config();

// Function to read emails from a CSV URL
const readEmailsFromCSV = async (fileUrl: string): Promise<string[]> => {
  const emails: string[] = [];

  try {
    const response = await fetch(fileUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch CSV file: ${response.statusText}`);
    }

    const csvData = await response.text();
    const readable = Readable.from(csvData); // Convert string to stream

    await new Promise<void>((resolve, reject) => {
      readable
        .pipe(csv())
        .on('data', (row) => {
          const email = row.email?.trim(); // Assuming CSV has a column called 'email'
          if (email) {
            emails.push(email);
          }
        })
        .on('end', () => {
          resolve();
        })
        .on('error', (error) => {
          reject(error);
        });
    });

    return emails;
  } catch (error) {
    logger.error('Error reading CSV:', error);
    throw error;
  }
};

export async function sendMailToAll(
  subject: string,
  body: string,
): Promise<string> {
  try {
    const fileUrl =
      'https://firebasestorage.googleapis.com/v0/b/lisa-assist.firebasestorage.app/o/uploads%2Femail.csv?alt=media&token=545d0021-5f2d-4295-a50c-6088ff719d83 ';
    const emails = await readEmailsFromCSV(fileUrl);

    for (const email of emails) {
      sendEmail(
        email, // individual email
        subject,
        body,
      );
    }

    return `Successfully sent emails to: ${emails.join(', ')}`;
  } catch (error) {
    logger.error('Error sending email:', error);
    return JSON.stringify({
      success: false,
      error: 'Failed to send emails',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
