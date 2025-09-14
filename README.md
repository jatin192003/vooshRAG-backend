# Voosh RAG Backend

A Retrieval-Augmented Generation (RAG) based chatbot backend that answers queries using news articles from RSS feeds. Built with Node.js, Express, Qdrant vector database, Jina embeddings, and Google Gemini LLM.

## Features

- 🔍 **RAG Pipeline**: Retrieval-Augmented Generation with news articles
- 📰 **News Ingestion**: Automatic RSS feed processing and embedding
- 💬 **Real-time Chat**: WebSocket support via Socket.IO
- 🗃️ **Vector Search**: Qdrant vector database for semantic similarity
- 🧠 **LLM Integration**: Google Gemini for response generation
- 📊 **Session Management**: Redis-based chat history with TTL
- 🔒 **Security**: Rate limiting, CORS, helmet, input validation
- 📈 **Monitoring**: Health checks and system statistics

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Express API    │    │  Vector DB      │
│   (React)       │◄──►│   + Socket.IO    │◄──►│   (Qdrant)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐    ┌─────────────────┐
                       │   Redis Cache    │    │  External APIs  │
                       │ (Session + Chat) │    │ (Jina + Gemini) │
                       └──────────────────┘    └─────────────────┘
```

## Prerequisites

- Node.js 18+
- Redis server
- Qdrant vector database
- API Keys:
  - [Jina AI API key](https://jina.ai) (for embeddings)
  - [Google Gemini API key](https://makersuite.google.com/app/apikey) (for LLM)

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Start Required Services

**Option A: Using Docker (Recommended)**
```bash
# Start Qdrant
docker run -p 6333:6333 qdrant/qdrant

# Start Redis
docker run -p 6379:6379 redis:alpine
```

**Option B: Local Installation**
- Install Qdrant: https://qdrant.tech/documentation/install/
- Install Redis: https://redis.io/download

### 3. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
```env
# Get from https://jina.ai
JINA_API_KEY=your_jina_api_key_here

# Get from https://makersuite.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key_here

# Default configurations (modify if needed)
QDRANT_URL=http://localhost:6333
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=5000
```

### 4. Initialize Database

```bash
# Initialize vector database and ingest news articles
npm run init-db
```

### 5. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on http://localhost:5000

## API Endpoints

### Chat Endpoints

#### Send Message
```http
POST /api/chat/message
Content-Type: application/json

{
  "sessionId": "uuid-session-id",
  "message": "What's the latest news about technology?"
}
```

#### Get Chat History
```http
GET /api/chat/history/{sessionId}?limit=50
```

### Session Endpoints

#### Create Session
```http
POST /api/session/create
Content-Type: application/json

{
  "sessionId": "optional-custom-id"
}
```

#### Clear Session
```http
DELETE /api/session/{sessionId}
```

### Admin Endpoints

#### Manual News Ingestion
```http
POST /api/admin/ingest
X-Admin-Key: admin123
```

#### System Health
```http
GET /api/admin/health
X-Admin-Key: admin123
```

## WebSocket Events

Connect to Socket.IO at `ws://localhost:5000`

### Client Events
- `join-session`: Join a chat session
- `chat-message`: Send a message
- `leave-session`: Leave a session

### Server Events
- `message`: Receive chat messages
- `error`: Error notifications
- `session-cleared`: Session was cleared

### Example WebSocket Usage

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000');

// Join a session
socket.emit('join-session', sessionId);

// Send a message
socket.emit('chat-message', {
  sessionId: sessionId,
  message: 'Hello, what can you tell me about today\'s news?'
});

// Receive messages
socket.on('message', (data) => {
  console.log('Bot response:', data.content);
  console.log('Sources:', data.sources);
});
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `QDRANT_URL` | Qdrant server URL | `http://localhost:6333` |
| `QDRANT_API_KEY` | Qdrant API key (if cloud) | - |
| `QDRANT_COLLECTION_NAME` | Vector collection name | `news` |
| `JINA_API_KEY` | Jina embeddings API key | **Required** |
| `GEMINI_API_KEY` | Google Gemini API key | **Required** |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `REDIS_PASSWORD` | Redis password | - |
| `SESSION_TTL` | Session expiry (seconds) | `3600` |
| `MAX_CHAT_HISTORY` | Max messages per session | `50` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |
| `ADMIN_KEY` | Admin endpoints key | `admin123` |

### News RSS Feed

By default, the system ingests from Times of India RSS feed:
`https://timesofindia.indiatimes.com/rssfeedstopstories.cms`

To change the feed, modify `RSS_FEED_URL` in your `.env` file or update the `newsIngestion.js` file.

## Development

### Project Structure

```
backend/
├── src/
│   ├── app.js              # Main application entry
│   ├── config/             # Configuration files
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Express middleware
│   ├── routes/             # API route definitions
│   ├── services/           # Business logic services
│   │   ├── ragService.js   # Main RAG pipeline
│   │   ├── vectorService.js # Qdrant operations
│   │   ├── embeddingService.js # Jina embeddings
│   │   ├── llmService.js   # Gemini LLM
│   │   └── sessionService.js # Redis sessions
│   └── utils/
│       ├── logger.js       # Winston logging
│       └── newsIngestion.js # RSS feed processing
├── scripts/
│   └── initDatabase.js     # Database initialization
├── data/                   # Data storage directory
├── package.json
└── .env.example
```

### Running Tests

```bash
npm test
```

### Available Scripts

```bash
npm start         # Start production server
npm run dev       # Start development server with nodemon
npm run ingest    # Manual news ingestion
npm run init-db   # Initialize database and ingest initial data
npm test          # Run tests
```

## Deployment

### Docker Deployment

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  backend:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - REDIS_HOST=redis
      - QDRANT_URL=http://qdrant:6333
    depends_on:
      - redis
      - qdrant
    env_file:
      - .env

  redis:
    image: redis:alpine
    ports:
      - "6379:6379"

  qdrant:
    image: qdrant/qdrant
    ports:
      - "6333:6333"
```

### Production Considerations

1. **Security**:
   - Change default `ADMIN_KEY`
   - Use strong Redis password
   - Set up proper CORS origins
   - Use HTTPS in production

2. **Performance**:
   - Enable Redis persistence
   - Configure Qdrant for production workloads
   - Set up proper logging aggregation
   - Monitor API rate limits

3. **Monitoring**:
   - Set up health check monitoring
   - Configure log aggregation (ELK stack, etc.)
   - Monitor API response times
   - Track vector database performance

## Troubleshooting

### Common Issues

1. **"Redis client not connected"**
   - Ensure Redis is running: `redis-cli ping`
   - Check Redis connection settings in `.env`

2. **"Failed to generate embedding"**
   - Verify Jina API key is valid
   - Check internet connectivity
   - Monitor API usage limits

3. **"Gemini API error"**
   - Verify Google Gemini API key
   - Check API quotas and billing
   - Ensure content passes safety filters

4. **"Collection not found"**
   - Run database initialization: `npm run init-db`
   - Check Qdrant is running: `curl http://localhost:6333/collections`

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm run dev
```

### Health Check

Check system health:
```bash
curl http://localhost:5000/health
```

## API Response Examples

### Successful Chat Response
```json
{
  "success": true,
  "data": {
    "message": "Based on recent news articles, technology companies are focusing on AI development...",
    "sources": [
      {
        "title": "AI Revolution in Tech Industry",
        "url": "https://example.com/article1",
        "description": "Latest developments in artificial intelligence...",
        "score": 0.89,
        "publishedAt": "2024-01-15T10:30:00Z"
      }
    ],
    "metadata": {
      "queryProcessingTime": 1250,
      "relevantPassagesCount": 5,
      "sessionId": "uuid-session-id"
    }
  }
}
```

### Session Creation Response
```json
{
  "success": true,
  "data": {
    "sessionId": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2024-01-15T10:30:00Z",
    "lastActivity": "2024-01-15T10:30:00Z",
    "messageCount": 0
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details