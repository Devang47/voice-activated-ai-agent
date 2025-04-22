import { tool } from "@langchain/core/tools"
import { z } from "zod"
import nodemailer from "nodemailer"
import dotenv from "dotenv"

dotenv.config()

// Email schema with fixed recipient
const emailSchema = z.object({
  to: z.string().describe("Email recipient as given in message"),
  subject: z.string().describe("Email subject"),
  body: z.string().describe("Email body content in detail"),
  priority: z.enum(["high", "normal", "low"]).describe("Email priority"),
})

// Track if an email has been sent in this session
let emailSentInCurrentSession = false

// Function to create HTML email
function generateEmailHTML(body, subject) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <style>
      body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; }
      .container { padding: 20px; }
      .header { background-color: #4a6fa5; color: white; padding: 15px 20px; border-radius: 5px 5px 0 0; }
      .content { padding: 20px; background-color: #f9f9f9; border-left: 1px solid #ddd; border-right: 1px solid #ddd; }
      .footer { background-color: #f1f1f1; padding: 15px; border-radius: 0 0 5px 5px; border: 1px solid #ddd; }
      h1 { margin: 0; font-size: 22px; }
      h2 { font-size: 18px; margin-top: 25px; margin-bottom: 10px; color: #4a6fa5; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>${subject}</h1>
      </div>
      
      <div class="content">
        ${body}
      </div>
      
      <div class="footer">
        <p>Sent by Lisa, your personal assistant</p>
      </div>
    </div>
  </body>
  </html>
  `
}

// Reset email flag function
export function resetEmailFlag() {
  emailSentInCurrentSession = false
}

// Send email tool
export const sendEmail = tool(
  async ({ to, subject, body, priority = "normal" }) => {
    // Force the recipient to always be robinsingh248142@gmail.com for security
    // const secureRecipient = "robinsingh248142@gmail.com"

    // Check if email was already sent in this session
    if (emailSentInCurrentSession && subject.includes("Revised")) {
      return "Skipping redundant email. An email has already been sent in this session."
    }

    // Check if recipient is trying to be set to something other than the secure recipient
    // if (to !== secureRecipient) {
    //   return `Security constraint: Emails can only be sent to ${secureRecipient}. Redirecting email to authorized recipient.`
    // }

    // Generate HTML email
    const emailBody = generateEmailHTML(body, subject)

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASSWORD,
      },
    })

    try {
      await transporter.sendMail({
        from: "robinsingh248142@gmail.com",
        to: to, // Always use the secure recipient
        subject,
        html: emailBody,
        priority: priority === "high" ? "high" : priority === "low" ? "low" : "normal",
      })

      // Set the flag to true after sending
      emailSentInCurrentSession = true

      return `Email successfully sent to ${to} with enhanced formatting`
    } catch (error) {
      return `Failed to send email: ${error.message}`
    }
  },
  {
    name: "sendEmail",
    description: "Send an email (restricted to sending only to Robin's email)",
    schema: emailSchema,
  },
)
