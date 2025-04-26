import { google } from 'googleapis';
import dotenv from 'dotenv';
import readline from 'readline';

dotenv.config();

// Validate environment variables
const requiredEnvVars = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

// Set up OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// Generate auth URL
const scopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: scopes,
});

console.log('Authorize this app by visiting this URL:', authUrl);

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Ask for the authorization code
rl.question('Enter the code from the redirect URL: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.warn(
        'No refresh token received. You might need to re-authenticate with prompt: "consent"',
      );
    } else {
      console.log('Refresh token:', tokens.refresh_token);
      console.log(
        'Add this refresh token to your .env file as GOOGLE_REFRESH_TOKEN',
      );
    }

    // Save all tokens if needed
    console.log('Full tokens:', tokens);
  } catch (err) {
    console.error('Error during token exchange:', err.message);
    if (err.response) {
      console.error('Response data:', err.response.data);
    }
  } finally {
    rl.close();
    process.exit();
  }
});
