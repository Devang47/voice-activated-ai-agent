// emailSender.ts
import { logger } from '../utils/logger.ts';
import dotenv from 'dotenv';
import csv from 'csv-parser';
import { sendEmail } from './index.ts';
import fetch from 'node-fetch';
import { Readable } from 'stream';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getStorage, ref, listAll, getDownloadURL } from 'firebase/storage';

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
    const readable = Readable.from([csvData]); // Wrap csvData in an array for stream

    await new Promise<void>((resolve, reject) => {
      readable
        .pipe(csv())
        .on('data', (row) => {
          const email = row.email?.trim(); // Ensure CSV has a column called 'email'
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

// Function to list files from 'uploads/' folder in Firebase Storage
const listUploadsFolderFiles = async (): Promise<
  { name: string; url: string }[]
> => {
  const result: { name: string; url: string }[] = [];

  try {
    const firebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
    };

    const app =
      getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    const storage = getStorage(app);
    const uploadsRef = ref(storage, 'uploads/');
    const listResult = await listAll(uploadsRef);

    for (const item of listResult.items) {
      const url = await getDownloadURL(item);
      result.push({ name: item.name, url });
    }

    return result;
  } catch (error) {
    console.error('Error listing uploads folder files:', error);
    return [];
  }
};

// Function to send emails to all from the CSV file
export async function sendMailToAll(
  subject: string,
  body: string,
  fileName: string,
): Promise<string> {
  try {
    const files = await listUploadsFolderFiles();
    const file = files.find((it) => it.name === fileName);

    if (!file) {
      return 'File not found by the given name.';
    }

    const emails = await readEmailsFromCSV(file.url);
    for (const email of emails) {
      await sendEmail(email, subject, body); // Ensure sendEmail returns a Promise
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
