import { Router } from 'express';
import { 
    getSessionHistory, 
    clearSession, 
    getActiveSessions,
    createSession,
    storeMessage
} from '../services/sessionService.js';
import { generateAnswer } from '../services/geminiService.js';
import { saveTranscript, getTranscript, getAllTranscripts, getTranscriptStats } from '../services/transcriptService.js';

const router = Router();

// Get session history
router.get('/sessions/:sessionId/history', async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({ message: 'Session ID is required' });
        }

        const history = await getSessionHistory(sessionId);
        res.status(200).json({ 
            message: 'Session history retrieved successfully', 
            data: {
                sessionId,
                messages: history,
                count: history.length
            }
        });
    } catch (error) {
        console.error('Error retrieving session history:', error);
        res.status(500).json({ message: 'Error retrieving session history' });
    }
});

// Clear specific session with transcript persistence
router.delete('/sessions/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({ message: 'Session ID is required' });
        }

        // Get session history before clearing
        const history = await getSessionHistory(sessionId);
        
        let transcriptResult = null;
        
        if (history.length > 0) {
            // Calculate session start time from first message
            const startedAt = new Date(history[0].timestamp);
            const endedAt = new Date();
            
            // Save transcript to PostgreSQL
            transcriptResult = await saveTranscript(sessionId, history, startedAt, endedAt);
        }

        // Clear session from Redis
        await clearSession(sessionId);
        
        // Prepare response
        const response = {
            message: 'Session cleared successfully',
            data: {
                sessionId
            }
        };
        
        if (transcriptResult) {
            response.data.transcriptSaved = true;
            response.data.transcriptId = transcriptResult.transcriptId;
            response.data.messageCount = transcriptResult.messageCount;
            response.data.durationSeconds = transcriptResult.durationSeconds;
            response.data.totalCharacters = transcriptResult.totalCharacters;
            response.data.savedAt = transcriptResult.savedAt;
        } else {
            response.data.transcriptSaved = false;
            response.data.messageCount = 0;
        }

        res.status(200).json(response);
    } catch (error) {
        console.error('Error clearing session:', error);
        res.status(500).json({ message: 'Error clearing session' });
    }
});

// Get all active sessions
router.get('/sessions', async (req, res) => {
    try {
        const sessions = await getActiveSessions();
        res.status(200).json({ 
            message: 'Active sessions retrieved successfully',
            data: {
                sessions,
                count: sessions.length
            }
        });
    } catch (error) {
        console.error('Error retrieving active sessions:', error);
        res.status(500).json({ message: 'Error retrieving active sessions' });
    }
});

// Create new session
router.post('/sessions', async (req, res) => {
    try {
        const sessionId = createSession();
        res.status(201).json({ 
            message: 'Session created successfully',
            data: { sessionId }
        });
    } catch (error) {
        console.error('Error creating session:', error);
        res.status(500).json({ message: 'Error creating session' });
    }
});

// Chat with session (alternative to socket for REST API usage)
router.post('/sessions/:sessionId/chat', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { query } = req.body;

        if (!sessionId) {
            return res.status(400).json({ message: 'Session ID is required' });
        }

        if (!query) {
            return res.status(400).json({ message: 'Query is required' });
        }

        // Generate response using existing Gemini service
        const botResponse = await generateAnswer(query);
        
        // Store message in session
        const message = await storeMessage(sessionId, query, botResponse);

        res.status(200).json({
            message: 'Chat response generated successfully',
            data: {
                sessionId,
                messageId: message.id,
                userQuery: query,
                botResponse,
                timestamp: message.timestamp
            }
        });
    } catch (error) {
        console.error('Error processing chat request:', error);
        res.status(500).json({ message: 'Error processing chat request' });
    }
});

// Get saved transcript by session ID
router.get('/sessions/:sessionId/transcript', async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json({ message: 'Session ID is required' });
        }

        const transcript = await getTranscript(sessionId);
        
        if (!transcript) {
            return res.status(404).json({ 
                message: 'Transcript not found for this session',
                data: { sessionId }
            });
        }

        res.status(200).json({
            message: 'Transcript retrieved successfully',
            data: transcript
        });
    } catch (error) {
        console.error('Error retrieving transcript:', error);
        res.status(500).json({ message: 'Error retrieving transcript' });
    }
});

// Get all saved transcripts with pagination
router.get('/transcripts', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        if (limit > 100) {
            return res.status(400).json({ message: 'Limit cannot exceed 100' });
        }

        const transcripts = await getAllTranscripts(limit, offset);
        
        res.status(200).json({
            message: 'Transcripts retrieved successfully',
            data: {
                transcripts,
                count: transcripts.length,
                limit,
                offset
            }
        });
    } catch (error) {
        console.error('Error retrieving transcripts:', error);
        res.status(500).json({ message: 'Error retrieving transcripts' });
    }
});

// Get transcript statistics
router.get('/transcripts/stats', async (req, res) => {
    try {
        const stats = await getTranscriptStats();
        
        res.status(200).json({
            message: 'Transcript statistics retrieved successfully',
            data: stats
        });
    } catch (error) {
        console.error('Error retrieving transcript stats:', error);
        res.status(500).json({ message: 'Error retrieving transcript statistics' });
    }
});

export default router;