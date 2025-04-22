// Helper functions for calendar operations

/**
 * Detect meeting scheduling intent in user messages
 * @param {Object} message - User message object
 * @returns {boolean} True if scheduling intent is detected
 */
export function detectSchedulingIntent(message) {
    const schedulingKeywords = [
      "schedule",
      "meeting",
      "appointment",
      "book",
      "calendar",
      "availability",
      "available",
      "meet",
      "discuss",
      "consultation",
      "call",
      "free time",
      "time slot",
      "when can we",
      "let's meet",
    ]
  
    const content = message.content.toLowerCase()
  
    // Check for scheduling keywords
    const hasSchedulingKeywords = schedulingKeywords.some((keyword) => content.includes(keyword))
  
    // Check for date patterns (e.g., MM/DD, Month DD, Next Monday)
    const hasDatePatterns =
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|monday|tuesday|wednesday|thursday|friday|next week|tomorrow)\b|\d{1,2}\/\d{1,2}/i.test(
        content,
      )
  
    // Check for time patterns (e.g., 2pm, 14:30, 2:30pm)
    const hasTimePatterns = /\b\d{1,2}(:\d{2})?\s*(am|pm)?\b/i.test(content)
  
    // Return true if message has both scheduling intent and some indication of time
    return hasSchedulingKeywords && (hasDatePatterns || hasTimePatterns)
  }
  
  /**
   * Extract meeting preferences from message
   * @param {Object} message - User message object
   * @returns {Object} Extracted meeting preferences
   */
  export function extractMeetingPreferences(message) {
    const content = message.content.toLowerCase()
  
    // Extract possible date references
    const dateMatches =
      content.match(
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{1,2}\b|\d{1,2}\/\d{1,2}(\/\d{2,4})?|\b(monday|tuesday|wednesday|thursday|friday|next week|tomorrow)\b/gi,
      ) || []
  
    // Extract possible time references
    const timeMatches = content.match(/\b\d{1,2}(:\d{2})?\s*(am|pm)?\b/gi) || []
  
    // Extract client name if present (simple heuristic)
    const nameMatch = content.match(/\b(for|with|client|name|is)\s+([A-Z][a-z]+(\s+[A-Z][a-z]+)?)\b/) || []
    const clientName = nameMatch[2] || ""
  
    // Extract email if present
    const emailMatch = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/) || []
    const email = emailMatch[0] || ""
  
    // Extract meeting type
    let meetingType = "consultation"
    if (content.includes("follow-up") || content.includes("review")) {
      meetingType = "follow-up"
    } else if (content.includes("initial") || content.includes("first") || content.includes("consultation")) {
      meetingType = "initial consultation"
    } else if (content.includes("status") || content.includes("update") || content.includes("progress")) {
      meetingType = "status update"
    } else if (content.includes("technical") || content.includes("details")) {
      meetingType = "technical discussion"
    }
  
    return {
      foundPreferences: dateMatches.length > 0 || timeMatches.length > 0 || clientName || email,
      dates: dateMatches,
      times: timeMatches,
      clientName,
      email,
      meetingType,
    }
  }
  
  /**
   * Suggest appropriate meeting type based on context
   * @param {Array} messages - Array of message objects
   * @returns {string} Suggested meeting type
   */
  export function suggestMeetingType(messages) {
    // Check most recent messages for context
    for (let i = messages.length - 1; i >= Math.max(0, messages.length - 5); i--) {
      const message = messages[i]
      const content = message.content?.toLowerCase() || ""
  
      // If discussing specific technical requirements, suggest technical discussion
      if (
        content.includes("technical") &&
        (content.includes("requirement") || content.includes("specification") || content.includes("detail"))
      ) {
        return "technical discussion"
      }
  
      // If discussing progress, suggest status update
      if (content.includes("progress") || content.includes("status") || content.includes("update")) {
        return "status update"
      }
  
      // If discussing follow-up
      if (content.includes("follow") && content.includes("up")) {
        return "follow-up"
      }
    }
  
    // Default to initial consultation
    return "initial consultation"
  }
  
  /**
   * Format date string to YYYY-MM-DD format
   * @param {string} dateString - Date string in various formats
   * @returns {string} Formatted date string
   */
  export function formatDateString(dateString) {
    // This is a simplified version - in a real implementation,
    // you would use a library like date-fns or moment.js
    const date = new Date(dateString)
    return date.toISOString().split("T")[0]
  }
  
  /**
   * Format time string to HH:MM format
   * @param {string} timeString - Time string in various formats
   * @returns {string} Formatted time string
   */
  export function formatTimeString(timeString) {
    // This is a simplified version - in a real implementation,
    // you would use a library like date-fns or moment.js
  
    // Simple regex to extract hours and minutes
    const match = timeString.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  
    if (!match) return "12:00"
  
    let hours = Number.parseInt(match[1])
    const minutes = match[2] ? match[2] : "00"
    const period = match[3] ? match[3].toLowerCase() : null
  
    // Convert to 24-hour format if needed
    if (period === "pm" && hours < 12) {
      hours += 12
    } else if (period === "am" && hours === 12) {
      hours = 0
    }
  
    // Format with leading zeros
    return `${hours.toString().padStart(2, "0")}:${minutes}`
  }
  