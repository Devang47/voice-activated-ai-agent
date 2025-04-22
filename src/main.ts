import express from "express"
import http from "http"
import cors from "cors"
import { WebSocketServer } from "ws"
import { RedisStorage } from "./agent/storage.js"
import { handleWebSocketConnection } from "./agent/index.js"
import dotenv from "dotenv"

dotenv.config()

const app = express()
const PORT = process.env.PORT ?? 3000

const corsOptions = {
  origin: "*",
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"],
}
app.use(cors(corsOptions))
app.use(express.json())

app.get("/", (_, res) => {
  res.send("Lisa Voice Activated AI Agent Server is running")
})

const server = http.createServer(app)
const storage = new RedisStorage()

const wss = new WebSocketServer({ server })

// Handle WebSocket connections using the function from agent/index.js
wss.on("connection", handleWebSocketConnection)

server.listen(PORT, async () => {
  await storage.connect()

  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`WebSocket server running on ws://localhost:${PORT}`)
})
