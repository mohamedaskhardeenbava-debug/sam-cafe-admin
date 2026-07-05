import { io } from "socket.io-client";

const SERVER_URL = process.env.REACT_APP_SERVER_URL || "http://localhost:4000";

const socket = io(SERVER_URL, {
    transports: ["websocket"],
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    upgrade: false,
});

export default socket;

//------------------------------------admin panel---------------------------------------------