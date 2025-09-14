import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';
import cors from 'cors';
import newsIngestionRoute from './routes/newsIngestionRoute.js';
import retrieverRoute from './routes/retrieverRoute.js';
import sessionRoute from './routes/sessionRoute.js';
import { initializeSocketIO } from './services/socketService.js';

dotenv.config();

const app = express();
const server = createServer(app);

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());
app.use('/api', newsIngestionRoute);
app.use('/api', retrieverRoute);
app.use('/api', sessionRoute);

// Initialize Socket.IO
const io = initializeSocketIO(server);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Socket.IO enabled for real-time chat`);
});