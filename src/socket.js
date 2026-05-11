import { io } from "socket.io-client";

// Switch between local dev and production (Render)
const SERVER_URL =
    process.env.REACT_APP_SERVER_URL || "http://localhost:4000";

const socket = io(SERVER_URL, {
    // Keeps the connection alive through Render's idle timeouts
    transports: ["websocket", "polling"],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
});

export default socket;