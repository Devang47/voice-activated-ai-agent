import { tool } from "@langchain/core/tools"
import { z } from "zod"
import dotenv from "dotenv"
import { sendEmail } from "../email/sendEmail.js"
import { meetingConfirmationTemplate } from "../email/template/proposalEmail.js"

dotenv.config()

// Meeting schema
const meetingSchema = z.object({
  attendeeName: z.string().describe("Name of the person attending the meeting"),
  attendeeEmail: z.string().email().describe("Email of the person attending the meeting"),
  meetingDate: z.string().describe("Date of the meeting (YYYY-MM-DD format)"),
  meetingTime: z.string().describe("Time of the meeting (HH:MM format)"),
  duration: z.number().min(15).max(120).describe("Duration of the meeting in minutes"),
  meetingType: z.string().describe("Type of meeting (e.g., consultation, follow-up)"),
  meetingDescription: z.string().describe("Brief description of the meeting purpose"),
})

// Mock function to generate a meeting link
function generateMeetingLink(meetingDate, meetingTime, attendeeName) {
  const encodedName = encodeURIComponent(attendeeName)
  const encodedDate = encodeURIComponent(`${meetingDate} ${meetingTime}`)
  return `https://meet.google.com/generated-link?name=${encodedName}&date=${encodedDate}`
}

// Mock function to check calendar availability
// function checkAvailability() {
//   // In a real implementation, this would check a calendar API
//   // For now, we'll just return true to simulate availability
//   return true
// }

// Schedule meeting tool
export const scheduleMeeting = tool(
  async ({
    attendeeName,
    // attendeeEmail,
    meetingDate,
    meetingTime,
    duration = 60,
    meetingType = "consultation",
    // meetingDescription = "Discussion",
  }) => {
    // Check if the requested time is available
    // const isAvailable = checkAvailability(meetingDate, meetingTime)
    const isAvailable = true

    if (!isAvailable) {
      return `The requested time (${meetingDate} at ${meetingTime}) is not available. Please suggest an alternative time.`
    }

    // Generate a meeting link
    const meetingLink = generateMeetingLink(meetingDate, meetingTime, attendeeName)

    // In a real implementation, this would create a calendar event
    // using Google Calendar API or similar

    // Send confirmation email to Robin
    const emailSubject = `Meeting Scheduled: ${meetingType} with ${attendeeName}`
    const emailBody = meetingConfirmationTemplate({
      recipientName: "Robin",
      meetingDate,
      meetingTime,
      meetingLink,
      meetingType,
    })

    try {
      await sendEmail.invoke({
        to: "robinsingh248142@gmail.com",
        subject: emailSubject,
        body: emailBody,
        priority: "normal",
      })

      return `Meeting successfully scheduled with ${attendeeName} on ${meetingDate} at ${meetingTime} for ${duration} minutes. Meeting type: ${meetingType}. Meeting link: ${meetingLink}. A confirmation email has been sent.`
    } catch (error) {
      return `Meeting scheduled but failed to send confirmation email: ${error.message}`
    }
  },
  {
    name: "scheduleMeeting",
    description: "Schedule a meeting with someone and send confirmation",
    schema: meetingSchema,
  },
)

// Reschedule meeting tool
export const rescheduleMeeting = tool(
  async ({
    attendeeName,
    // attendeeEmail,
    oldMeetingDate,
    oldMeetingTime,
    newMeetingDate,
    newMeetingTime,
    duration = 60,
    meetingType,
    // meetingDescription,
  }) => {
    // Check if the new requested time is available
    // const isAvailable = checkAvailability(newMeetingDate, newMeetingTime)
    const isAvailable = true

    if (!isAvailable) {
      return `The requested time (${newMeetingDate} at ${newMeetingTime}) is not available. Please suggest an alternative time.`
    }

    // Generate a new meeting link
    const meetingLink = generateMeetingLink(newMeetingDate, newMeetingTime, attendeeName)

    // In a real implementation, this would update a calendar event

    // Send rescheduling confirmation email
    const emailSubject = `Meeting Rescheduled: ${meetingType} with ${attendeeName}`
    const emailBody = `
      <p>Hi Robin,</p>
      
      <p>The meeting with ${attendeeName} has been rescheduled:</p>
      
      <p><strong>Previous time:</strong> ${oldMeetingDate} at ${oldMeetingTime}</p>
      <p><strong>New time:</strong> ${newMeetingDate} at ${newMeetingTime}</p>
      <p><strong>Meeting type:</strong> ${meetingType}</p>
      <p><strong>Duration:</strong> ${duration} minutes</p>
      <p><strong>Meeting link:</strong> <a href="${meetingLink}">${meetingLink}</a></p>
      
      <p>Best regards,<br>Your Assistant</p>
    `

    try {
      await sendEmail.invoke({
        to: "robinsingh248142@gmail.com",
        subject: emailSubject,
        body: emailBody,
        priority: "normal",
      })

      return `Meeting successfully rescheduled with ${attendeeName} from ${oldMeetingDate} at ${oldMeetingTime} to ${newMeetingDate} at ${newMeetingTime}. A confirmation email has been sent.`
    } catch (error) {
      return `Meeting rescheduled but failed to send confirmation email: ${error.message}`
    }
  },
  {
    name: "rescheduleMeeting",
    description: "Reschedule an existing meeting to a new time",
    schema: z.object({
      attendeeName: z.string().describe("Name of the person attending the meeting"),
      attendeeEmail: z.string().email().describe("Email of the person attending the meeting"),
      oldMeetingDate: z.string().describe("Original date of the meeting (YYYY-MM-DD format)"),
      oldMeetingTime: z.string().describe("Original time of the meeting (HH:MM format)"),
      newMeetingDate: z.string().describe("New date of the meeting (YYYY-MM-DD format)"),
      newMeetingTime: z.string().describe("New time of the meeting (HH:MM format)"),
      duration: z.number().min(15).max(120).describe("Duration of the meeting in minutes"),
      meetingType: z.string().describe("Type of meeting (e.g., consultation, follow-up)"),
      meetingDescription: z.string().describe("Brief description of the meeting purpose"),
    }),
  },
)

// Cancel meeting tool
export const cancelMeeting = tool(
  async ({ attendeeName, meetingDate, meetingTime, meetingType, reason = "Scheduling conflict" }) => {
    // In a real implementation, this would delete a calendar event

    // Send cancellation email
    const emailSubject = `Meeting Cancelled: ${meetingType} with ${attendeeName}`
    const emailBody = `
      <p>Hi Robin,</p>
      
      <p>The meeting with ${attendeeName} scheduled for ${meetingDate} at ${meetingTime} has been cancelled.</p>
      
      <p><strong>Reason:</strong> ${reason}</p>
      
      <p>Best regards,<br>Your Assistant</p>
    `

    try {
      await sendEmail.invoke({
        to: "robinsingh248142@gmail.com",
        subject: emailSubject,
        body: emailBody,
        priority: "normal",
      })

      return `Meeting with ${attendeeName} on ${meetingDate} at ${meetingTime} has been successfully cancelled. A notification email has been sent.`
    } catch (error) {
      return `Meeting cancelled but failed to send notification email: ${error.message}`
    }
  },
  {
    name: "cancelMeeting",
    description: "Cancel an existing meeting",
    schema: z.object({
      attendeeName: z.string().describe("Name of the person attending the meeting"),
      attendeeEmail: z.string().email().describe("Email of the person attending the meeting"),
      meetingDate: z.string().describe("Date of the meeting (YYYY-MM-DD format)"),
      meetingTime: z.string().describe("Time of the meeting (HH:MM format)"),
      meetingType: z.string().describe("Type of meeting (e.g., consultation, follow-up)"),
      reason: z.string().describe("Reason for cancellation"),
    }),
  },
)
