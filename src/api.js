import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_SERVER_URL || "http://localhost:4000"
});

export default api;

//------------------------------------admin panel---------------------------------------------