import { io } from "socket.io-client";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:4000";

const socket = io(SERVER_URL, {
    transports: ["websocket"],   // ← websocket only, no polling fallback causing double-fire
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    upgrade: false,              // ← prevent transport upgrade re-connection
});

export default socket;

//------------------------------------admin panel---------------------------------------------