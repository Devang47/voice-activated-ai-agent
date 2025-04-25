import { google, type calendar_v3 } from 'googleapis';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger.ts';

dotenv.config();

// Set up OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
);

// Set credentials using refresh token
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
});

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL,
    pass: process.env.PASSWORD,
  },
});

// Create calendar client
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

// Convert date strings to RFC3339 format for Google Calendar API
function formatDateTimeForGoogle(dateStr: string, timeStr: string): string {
  const [year, month, day] = dateStr
    .split('-')
    .map((num) => Number.parseInt(num));
  const [hours, minutes] = timeStr
    .split(':')
    .map((num) => Number.parseInt(num));

  const date = new Date(Date.UTC(year, month - 1, day, hours, minutes, 0));
  return date.toISOString();
}

// Fix the email sending function for meeting notifications
async function sendMeetingEmail(
  clientEmail: string,
  clientName: string,
  meetingDetails: {
    subject: string;
    with: string;
    date: string;
    time: string;
    location: string;
    isVideoConference: boolean;
  },
): Promise<void> {
  try {
    // Make sure we have valid email credentials
    if (!process.env.EMAIL || !process.env.PASSWORD) {
      logger.error('Missing email credentials in environment variables');
      throw new Error('Email credentials not configured');
    }

    const mailOptions = {
      from: process.env.EMAIL,
      to: clientEmail,
      subject: `Meeting Scheduled: ${meetingDetails.subject}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 5px;">
          <h2 style="color: #333;">Meeting Confirmation</h2>
          <p>Hello ${clientName},</p>
          <p>Your meeting has been scheduled.</p>
          <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #333;">Meeting Details:</h3>
            <p><strong>Subject:</strong> ${meetingDetails.subject}</p>
            <p><strong>Date:</strong> ${meetingDetails.date}</p>
            <p><strong>Time:</strong> ${meetingDetails.time}</p>
            <p><strong>Location:</strong> ${meetingDetails.location}</p>
            ${meetingDetails.isVideoConference ? `<p><strong>Join Link:</strong> <a href="${meetingDetails.location}">${meetingDetails.location}</a></p>` : ''}
          </div>
          <p>Looking forward to our discussion!</p>
          <p>Best Regards,<br>Robin Rathore</p>
        </div>
      `,
    };

    // Log the email being sent for debugging
    logger.info(`Attempting to send meeting email to: ${clientEmail}`);

    const info = await transporter.sendMail(mailOptions);
    logger.info(`Meeting email sent successfully: ${info.messageId}`);
  } catch (error) {
    logger.error('Error sending meeting email:', error);
    throw error; // Rethrow to handle in the calling function
  }
}

// Update the scheduleMeeting function to better handle errors
export async function scheduleMeeting(
  clientName: string,
  clientEmail: string,
  date: string,
  startTime: string,
  duration = 60,
  projectName = '',
  notes = '',
  location = 'Google Meet',
  timeZone = 'America/Los_Angeles',
): Promise<string> {
  try {
    // Validate inputs
    if (!clientName || !clientEmail || !date || !startTime) {
      return JSON.stringify({
        success: false,
        error: 'Missing required meeting information',
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      return JSON.stringify({
        success: false,
        error: 'Invalid email format',
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return JSON.stringify({
        success: false,
        error: 'Invalid date format. Please use YYYY-MM-DD',
      });
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime)) {
      return JSON.stringify({
        success: false,
        error: 'Invalid time format. Please use HH:MM (24-hour format)',
      });
    }

    const meetingDuration = duration;
    const startDateTime = formatDateTimeForGoogle(date, startTime);

    // Calculate end time by adding duration
    const endDateTime = new Date(
      new Date(startDateTime).getTime() + meetingDuration * 60000,
    ).toISOString();

    // Default to video conference if location is Google Meet or Zoom
    const useVideoConference =
      location.toLowerCase().includes('google meet') ||
      location.toLowerCase().includes('zoom');

    const meetingSubject = `Meeting with ${clientName}${projectName ? ` - ${projectName}` : ''}`;
    const meetingDescription = `
Meeting with ${clientName}
Email: ${clientEmail}
${projectName ? `Project: ${projectName}` : ''}
${notes ? `\nNotes: ${notes}` : ''}

Automatically scheduled by LISA.
    `.trim();

    // Create calendar event with proper typing
    const event: calendar_v3.Schema$Event = {
      summary: meetingSubject,
      description: meetingDescription,
      start: {
        dateTime: startDateTime,
        timeZone: timeZone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: timeZone,
      },
      attendees: [
        { email: clientEmail },
        { email: process.env.EMAIL! }, // Your email
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 30 }, // 30 minutes before
        ],
      },
    };

    // Add conference details if needed
    if (useVideoConference) {
      event.conferenceData = {
        createRequest: {
          requestId: `meeting-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    } else {
      event.location = location;
    }

    // Log the event being created
    logger.info(`Creating calendar event: ${JSON.stringify(event, null, 2)}`);

    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'all', // Send email notifications to attendees
      conferenceDataVersion: useVideoConference ? 1 : 0,
    });

    // Properly accessing data from response
    const createdEvent = response.data;
    const hangoutLink = createdEvent.hangoutLink || '';

    const meetingDetails = {
      subject: event.summary,
      with: clientName,
      date,
      time: `${startTime} - ${new Date(endDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
      location: useVideoConference && hangoutLink ? hangoutLink : location,
      isVideoConference: useVideoConference,
    };

    // Try to send the email, but don't fail if it doesn't work
    try {
      await sendMeetingEmail(clientEmail, clientName, meetingDetails);
      logger.info('Meeting email sent successfully');
    } catch (emailError) {
      logger.error(
        'Failed to send meeting email, but meeting was created:',
        emailError,
      );
    }

    return JSON.stringify({
      success: true,
      meetingId: createdEvent.id,
      meetingLink: createdEvent.htmlLink,
      meetingDetails: {
        subject: meetingSubject,
        with: clientName,
        date: date,
        time: `${startTime} - ${new Date(endDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`,
        location: useVideoConference && hangoutLink ? hangoutLink : location,
        isVideoConference: useVideoConference,
      },
    });
  } catch (error) {
    logger.error('Error scheduling meeting:', error);
    return JSON.stringify({
      success: false,
      error: `Error scheduling meeting: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

// Cancel a meeting
export async function cancelMeeting(
  meetingId: string,
  reason = 'Cancellation requested',
  sendNotification = true,
): Promise<string> {
  try {
    // First get the existing event to preserve details for the response
    const existingEventResponse = await calendar.events.get({
      calendarId: 'primary',
      eventId: meetingId,
    });

    const event = existingEventResponse.data;

    // Delete/cancel the event
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: meetingId,
      sendUpdates: sendNotification ? 'all' : 'none',
    });

    return JSON.stringify({
      success: true,
      canceled: true,
      meetingDetails: {
        subject: event.summary,
        date: event.start?.dateTime
          ? new Date(event.start.dateTime).toLocaleDateString()
          : '',
        time:
          event.start?.dateTime && event.end?.dateTime
            ? `${new Date(event.start.dateTime).toLocaleTimeString()} - ${new Date(event.end.dateTime).toLocaleTimeString()}`
            : '',
        reason: reason,
      },
    });
  } catch (error) {
    logger.error('Error canceling meeting:', error);
    return JSON.stringify({
      success: false,
      error: `Error canceling meeting: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}

// Get upcoming meetings
export async function getUpcomingMeetings(
  days = 7,
  maxResults = 10,
): Promise<string> {
  try {
    const now = new Date();
    const future = new Date();
    future.setDate(future.getDate() + days);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      maxResults: maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];

    const formattedEvents = events.map((event) => {
      const start = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
          ? new Date(event.start.date)
          : new Date();

      const end = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : event.end?.date
          ? new Date(event.end.date)
          : new Date();

      return {
        id: event.id || '',
        title: event.summary || 'Untitled Meeting',
        date: start.toLocaleDateString(),
        startTime: start.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        endTime: end.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
        location:
          event.location ||
          (event.hangoutLink ? 'Google Meet' : 'Not specified'),
        videoLink: event.hangoutLink || null,
        attendees: event.attendees
          ? event.attendees.map((a) => ({
              email: a.email || '',
              name: a.displayName || a.email || '',
            }))
          : [],
        description: event.description || '',
      };
    });

    return JSON.stringify({
      success: true,
      meetings: formattedEvents,
      timeZone: response.data.timeZone || 'Unknown',
      count: formattedEvents.length,
    });
  } catch (error) {
    logger.error('Error retrieving upcoming meetings:', error);
    return JSON.stringify({
      success: false,
      error: `Error retrieving upcoming meetings: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
}
