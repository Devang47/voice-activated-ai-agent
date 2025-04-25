import type { WebSocket } from "ws"
import { handleNewMessage } from "./handlers.ts"
import { sessionManager, startInactivityTimer } from "./helpers.ts"
import { logger } from "../utils/logger.ts"

export const handleWSConnection = (ws: WebSocket) => {
  logger.info("New WS connection established")

  startInactivityTimer(ws)
  const sId = sessionManager.create()

  ws.on("message", (message) => handleNewMessage(message, ws))

  ws.on("close", () => {
    logger.info("Client disconnected ", sId)
  })

  // Send initial greeting that prompts for "Hey Lisa"
  ws.send(
    JSON.stringify({
      role: "assistant",
      content: "Voice assistant is ready. Please greet me to begin.",
      sessionActive: true,
    }),
  )
}
