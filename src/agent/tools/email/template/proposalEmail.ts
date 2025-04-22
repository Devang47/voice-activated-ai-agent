// This file contains email templates for different purposes

/**
 * Generates a meeting confirmation email template
 * @param {Object} params - Parameters for the template
 * @param {string} params.recipientName - Name of the recipient
 * @param {string} params.meetingDate - Date of the meeting
 * @param {string} params.meetingTime - Time of the meeting
 * @param {string} params.meetingLink - Link to join the meeting
 * @param {string} params.meetingType - Type of meeting
 * @returns {string} HTML email content
 */
export function meetingConfirmationTemplate({ recipientName, meetingDate, meetingTime, meetingLink, meetingType }) {
    return `
      <p>Hi ${recipientName},</p>
      
      <p>I've scheduled a ${meetingType} meeting for you on <strong>${meetingDate}</strong> at <strong>${meetingTime}</strong>.</p>
      
      <p>You can join the meeting using this link: <a href="${meetingLink}">${meetingLink}</a></p>
      
      <p>Please let me know if you need to reschedule or have any questions before our meeting.</p>
      
      <p>Looking forward to our discussion!</p>
      
      <p>Best regards,<br>Robin</p>
    `
  }
  
  /**
   * Generates a general email template
   * @param {Object} params - Parameters for the template
   * @param {string} params.recipientName - Name of the recipient
   * @param {string} params.messageBody - Main content of the email
   * @returns {string} HTML email content
   */
  export function generalEmailTemplate({ recipientName, messageBody }) {
    return `
      <p>Hi ${recipientName},</p>
      
      ${messageBody}
      
      <p>Best regards,<br>Robin</p>
    `
  }
  