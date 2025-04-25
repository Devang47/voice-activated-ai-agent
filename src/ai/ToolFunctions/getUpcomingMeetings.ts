import { google } from "googleapis"
import dotenv from "dotenv"
import { logger } from "../../utils/logger.ts"

dotenv.config()

// Set up OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI,
)

// Set credentials using refresh token
oauth2Client.setCredentials({
  refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
})

// Create calendar client
const calendar = google.calendar({ version: "v3", auth: oauth2Client })

// Get upcoming meetings
export async function getUpcomingMeetings(days = 7, maxResults = 10): Promise<string> {
  try {
    const now = new Date()
    const future = new Date()
    future.setDate(future.getDate() + days)

    logger.info(`Fetching meetings from ${now.toISOString()} to ${future.toISOString()}`)

    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: now.toISOString(),
      timeMax: future.toISOString(),
      maxResults: maxResults,
      singleEvents: true,
      orderBy: "startTime",
    })

    const events = response.data.items || []
    logger.info(`Found ${events.length} upcoming meetings`)

    const formattedEvents = events.map((event) => {
      const start = event.start?.dateTime
        ? new Date(event.start.dateTime)
        : event.start?.date
          ? new Date(event.start.date)
          : new Date()

      const end = event.end?.dateTime
        ? new Date(event.end.dateTime)
        : event.end?.date
          ? new Date(event.end.date)
          : new Date()

      return {
        id: event.id || "",
        title: event.summary || "Untitled Meeting",
        date: start.toLocaleDateString(),
        startTime: start.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        endTime: end.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        }),
        location: event.location || (event.hangoutLink ? "Google Meet" : "Not specified"),
        videoLink: event.hangoutLink || null,
        attendees: event.attendees
          ? event.attendees.map((a) => ({
              email: a.email || "",
              name: a.displayName || a.email || "",
            }))
          : [],
        description: event.description || "",
      }
    })

    return JSON.stringify({
      success: true,
      meetings: formattedEvents,
      timeZone: response.data.timeZone || "Unknown",
      count: formattedEvents.length,
    })
  } catch (error) {
    logger.error("Error retrieving upcoming meetings:", error)
    return JSON.stringify({
      success: false,
      error: `Error retrieving upcoming meetings: ${error instanceof Error ? error.message : "Unknown error"}`,
    })
  }
}
