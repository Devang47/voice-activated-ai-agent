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

// Improved email sending function for meeting notifications with better error handling
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
): Promise<boolean> {
  try {
    // Make sure we have valid email credentials
    if (!process.env.EMAIL || !process.env.PASSWORD) {
      logger.error('Missing email credentials in environment variables');
      throw new Error('Email credentials not configured');
    }

    // Create transporter for this specific email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    });

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
      text: `Hello ${clientName},\n\nYour meeting has been scheduled.\n\nDetails:\nSubject: ${meetingDetails.subject}\nDate: ${meetingDetails.date}\nTime: ${meetingDetails.time}\nLocation: ${meetingDetails.location}\n\n${meetingDetails.isVideoConference ? `Join Link: ${meetingDetails.location}` : ''}\n\nLooking forward to our discussion!\n\nBest Regards,\nRobin Rathore`,
    };

    // Log the email being sent for debugging
    logger.info(`Sending meeting email to: ${clientEmail}`);

    // Send the email
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Meeting email sent successfully: ${info.messageId}`);
    return true;
  } catch (error) {
    logger.error('Error sending meeting email:', error);
    return false; // Return false instead of throwing to handle in the calling function
  }
}

// Determine meeting duration based on meeting type
function getMeetingDurationMinutes(meetingType: string): number {
  switch (meetingType?.toLowerCase()) {
    case 'initial consultation':
      return 60;
    case 'proposal review':
      return 45;
    case 'status update':
      return 30;
    case 'technical discussion':
      return 60;
    default:
      return 30; // Default to 30 minutes
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
  meetingType = '', // Added meeting type parameter
): Promise<string> {
  try {
    // Validate inputs
    if (!clientName || !clientEmail || !date || !startTime) {
      return "I need more information to schedule this meeting. Could you provide the client's name, email, date, and start time?";
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      return "The email address doesn't look right. Could you double-check it?";
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return 'Please provide the date in YYYY-MM-DD format, like 2025-05-15.';
    }

    // Validate time format (HH:MM)
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime)) {
      return 'Please provide the time in 24-hour format, like 14:30 for 2:30 PM.';
    }

    // Use appropriate meeting duration if meeting type is provided
    const meetingDuration = meetingType
      ? getMeetingDurationMinutes(meetingType)
      : duration;
    const startDateTime = formatDateTimeForGoogle(date, startTime);

    // Calculate end time by adding duration
    const endDateTime = new Date(
      new Date(startDateTime).getTime() + meetingDuration * 60000,
    ).toISOString();

    // Default to video conference if location is Google Meet or Zoom
    const useVideoConference =
      location.toLowerCase().includes('google meet') ||
      location.toLowerCase().includes('zoom');

    const meetingSubject = meetingType
      ? `${meetingType}: ${clientName}${projectName ? ` - ${projectName}` : ''}`
      : `Meeting with ${clientName}${projectName ? ` - ${projectName}` : ''}`;

    const meetingDescription = `
Meeting with ${clientName}
Email: ${clientEmail}
${meetingType ? `Type: ${meetingType}` : ''}
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

    const formattedDate = new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const formattedStartTime = new Date(
      `${date}T${startTime}`,
    ).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const formattedEndTime = new Date(endDateTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const meetingDetails = {
      subject: event.summary || '',
      with: clientName,
      date: formattedDate,
      time: `${formattedStartTime} - ${formattedEndTime}`,
      location: useVideoConference && hangoutLink ? hangoutLink : location,
      isVideoConference: useVideoConference,
    };

    // Always send the email notification
    const emailSent = await sendMeetingEmail(
      clientEmail,
      clientName,
      meetingDetails,
    );

    if (emailSent) {
      return `I've scheduled the meeting with ${clientName} for ${formattedDate} at ${formattedStartTime}. I've sent a calendar invitation and email confirmation to ${clientEmail}. ${useVideoConference ? 'A Google Meet link has been included in the invitation.' : ''}`;
    } else {
      return `I've scheduled the meeting with ${clientName} for ${formattedDate} at ${formattedStartTime}, but there was an issue sending the email confirmation. The calendar invitation has still been sent to ${clientEmail}. ${useVideoConference ? 'A Google Meet link has been included in the invitation.' : ''}`;
    }
  } catch (error) {
    logger.error('Error scheduling meeting:', error);
    return `I had trouble scheduling that meeting. ${error instanceof Error ? error.message : 'Please try again with complete details.'}`;
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

    // Format the date and time for natural language response
    const startDate = event.start?.dateTime
      ? new Date(event.start.dateTime)
      : null;
    const formattedDate = startDate
      ? startDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : 'the scheduled date';

    const formattedTime = startDate
      ? startDate.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : 'the scheduled time';

    const meetingTitle = event.summary || 'meeting';

    // Delete/cancel the event
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: meetingId,
      sendUpdates: sendNotification ? 'all' : 'none',
    });

    return `I've canceled the ${meetingTitle} that was scheduled for ${formattedDate} at ${formattedTime}. ${sendNotification ? 'All attendees have been notified of the cancellation.' : 'No notifications were sent to attendees.'}`;
  } catch (error) {
    logger.error('Error canceling meeting:', error);
    return `I couldn't cancel that meeting. ${error instanceof Error ? error.message : 'Please check the meeting ID and try again.'}`;
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

    logger.info(
      `Fetching meetings from ${now.toISOString()} to ${future.toISOString()}`,
    );

    const listResponse = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      maxResults: maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = listResponse.data.items || [];
    const eventCount = events.length;

    if (eventCount === 0) {
      return `You don't have any meetings scheduled in the next ${days} days.`;
    }

    const formattedEvents = events.map((event) => {
      const start = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
          ? new Date(event.start.date)
          : new Date();

      return {
        title: event.summary || 'Untitled Meeting',
        date: start.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        }),
        time: start.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
        with:
          event.attendees
            ?.filter((a) => a.email !== process.env.EMAIL)
            .map((a) => a.displayName || a.email) || [],
      };
    });

    // Create a natural language response
    let response = `You have ${eventCount} meeting${eventCount > 1 ? 's' : ''} in the next ${days} days:`;

    formattedEvents.forEach((event, index) => {
      const attendees =
        event.with.length > 0 ? ` with ${event.with.join(', ')}` : '';
      response += `\n${index + 1}. ${event.title} on ${event.date} at ${event.time}${attendees}`;
    });

    return response;
  } catch (error) {
    logger.error('Error retrieving upcoming meetings:', error);
    return `I couldn't retrieve your upcoming meetings. ${error instanceof Error ? error.message : 'Please try again later.'}`;
  }
}

// Reschedule a meeting
export async function rescheduleMeeting(
  meetingId: string,
  newDate: string,
  newStartTime: string,
  reason = 'Schedule change requested',
  timeZone = 'America/Los_Angeles',
): Promise<string> {
  try {
    // First get the existing event
    const existingEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: meetingId,
    });

    const event = existingEvent.data;

    // Determine meeting duration from existing event
    const existingStart = new Date(event.start?.dateTime || '');
    const existingEnd = new Date(event.end?.dateTime || '');
    const durationMinutes = Math.round(
      (existingEnd.getTime() - existingStart.getTime()) / 60000,
    );

    // Format the original time for natural language response
    const originalFormattedDate = existingStart.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const originalFormattedTime = existingStart.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Update start and end times
    const startDateTime = formatDateTimeForGoogle(newDate, newStartTime);
    const endDateTime = new Date(
      new Date(startDateTime).getTime() + durationMinutes * 60000,
    ).toISOString();

    // Format the new time for natural language response
    const newFormattedDate = new Date(newDate).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const newFormattedTime = new Date(
      `${newDate}T${newStartTime}`,
    ).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    // Update event description to include rescheduling information
    const updatedDescription = `${event.description || ''}\n\nRescheduled: ${reason}\nPrevious time: ${existingStart.toLocaleString()}`;

    // Update the event
    const updatedEvent = {
      ...event,
      start: {
        dateTime: startDateTime,
        timeZone: timeZone,
      },
      end: {
        dateTime: endDateTime,
        timeZone: timeZone,
      },
      description: updatedDescription,
    };

    await calendar.events.update({
      calendarId: 'primary',
      eventId: meetingId,
      requestBody: updatedEvent,
      sendUpdates: 'all', // Send email notifications to attendees
    });

    const meetingTitle = event.summary || 'meeting';
    const attendees =
      event.attendees?.filter((a) => a.email !== process.env.EMAIL) || [];
    const attendeeNames = attendees
      .map((a) => a.displayName || a.email)
      .join(', ');
    const attendeeMessage =
      attendees.length > 0 ? ` with ${attendeeNames}` : '';

    return `I've rescheduled the ${meetingTitle}${attendeeMessage} from ${originalFormattedDate} at ${originalFormattedTime} to ${newFormattedDate} at ${newFormattedTime}. All attendees have been notified of this change.`;
  } catch (error) {
    logger.error('Error rescheduling meeting:', error);
    return `I couldn't reschedule that meeting. ${error instanceof Error ? error.message : 'Please check the meeting ID and try again with valid date and time.'}`;
  }
}
