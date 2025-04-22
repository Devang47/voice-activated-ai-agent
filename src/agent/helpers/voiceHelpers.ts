/**
 * Helper functions for voice command processing
 */

/**
 * Detects if a message contains the wake word "Lisa"
 * @param {string} message - The user's message
 * @returns {boolean} True if the wake word is detected
 */
export function detectVoiceCommand(message) {
    if (!message) return false
  
    // Convert to lowercase for case-insensitive matching
    const lowerMessage = message.toLowerCase()
  
    // Check for the wake word "Lisa"
    return lowerMessage.includes("lisa")
  }
  
  /**
   * Detects if a message is a closing statement
   * @param {string} message - The user's message
   * @returns {boolean} True if the message is a closing statement
   */
  export function isClosingStatement(message) {
    if (!message) return false
  
    // Convert to lowercase for case-insensitive matching
    const lowerMessage = message.toLowerCase()
  
    // Check for common closing phrases
    const closingPhrases = [
      "okay thanks bye",
      "ok thanks bye",
      "thank you bye",
      "thanks bye",
      "goodbye",
      "bye lisa",
      "that's all",
      "that is all",
      "end conversation",
      "close connection",
      "disconnect",
      "that will be all",
    ]
  
    return closingPhrases.some((phrase) => lowerMessage.includes(phrase))
  }
  
  /**
   * Extracts email information from a message
   * @param {string} message - The user's message
   * @returns {Object|null} Extracted email information or null if not found
   */
  export function extractEmailInfo(message) {
    if (!message) return null
  
    const lowerMessage = message.toLowerCase()
  
    // Check if this is an email request
    if (!lowerMessage.includes("email") && !lowerMessage.includes("send") && !lowerMessage.includes("message")) {
      return null
    }
  
    // Extract subject if present
    let subject = null
    const subjectMatches =
      message.match(/subject[:\s]+([^,.]+)/i) ||
      message.match(/about[:\s]+([^,.]+)/i) ||
      message.match(/regarding[:\s]+([^,.]+)/i)
  
    if (subjectMatches && subjectMatches[1]) {
      subject = subjectMatches[1].trim()
    }
  
    // Extract content if present
    let content = null
    const contentMatches =
      message.match(/content[:\s]+([^,.]+)/i) ||
      message.match(/body[:\s]+([^,.]+)/i) ||
      message.match(/saying[:\s]+([^,.]+)/i)
  
    if (contentMatches && contentMatches[1]) {
      content = contentMatches[1].trim()
    }
  
    // If we have either subject or content, return the email info
    if (subject || content) {
      return {
        subject: subject || "No subject provided",
        content: content || "No content provided",
        isComplete: subject && content,
      }
    }
  
    return null
  }
  
  /**
   * Extracts meeting information from a message
   * @param {string} message - The user's message
   * @returns {Object|null} Extracted meeting information or null if not found
   */
  export function extractMeetingInfo(message) {
    if (!message) return null
  
    const lowerMessage = message.toLowerCase()
  
    // Check if this is a meeting request
    if (
      !lowerMessage.includes("meeting") &&
      !lowerMessage.includes("schedule") &&
      !lowerMessage.includes("appointment") &&
      !lowerMessage.includes("call")
    ) {
      return null
    }
  
    // Extract attendee name if present
    let attendeeName = null
    const nameMatches = message.match(/with[:\s]+([^,.]+)/i) || message.match(/for[:\s]+([^,.]+)/i)
  
    if (nameMatches && nameMatches[1]) {
      attendeeName = nameMatches[1].trim()
    }
  
    // Extract email if present
    let email = null
    const emailMatches = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)
  
    if (emailMatches && emailMatches[0]) {
      email = emailMatches[0]
    }
  
    // Extract date if present
    let date = null
    const dateMatches = message.match(/on[:\s]+([^,.]+)/i) || message.match(/for[:\s]+([^,.]+)/i)
  
    if (dateMatches && dateMatches[1]) {
      date = dateMatches[1].trim()
    }
  
    // Extract time if present
    let time = null
    const timeMatches = message.match(/at[:\s]+([^,.]+)/i)
  
    if (timeMatches && timeMatches[1]) {
      time = timeMatches[1].trim()
    }
  
    // If we have at least some information, return the meeting info
    if (attendeeName || email || date || time) {
      return {
        attendeeName: attendeeName,
        email: email,
        date: date,
        time: time,
        isComplete: attendeeName && email && date && time,
      }
    }
  
    return null
  }
  