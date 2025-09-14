import { Server } from 'socket.io';
import { generateAnswer, generateAnswerStream } from './geminiService.js';
import { storeMessage, getSessionHistory, clearSession, createSession, refreshSession } from './sessionService.js';
import { saveTranscript } from './transcriptService.js';

/**
 * Initialize Socket.IO server and handle chat connections
 * @param {http.Server} server - Express server instance
 */
export const initializeSocketIO = (server) => {
    const io = new Server(server, {
        cors: {
            origin: process.env.FRONTEND_URL || "http://localhost:5173",
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.id}`);
        
        let userSessionId = null;

        // Handle join session
        socket.on('join-session', async (data) => {
            try {
                const { sessionId } = data;
                
                if (sessionId) {
                    userSessionId = sessionId;
                    // Refresh session TTL
                    await refreshSession(sessionId);
                } else {
                    // Create new session
                    userSessionId = createSession();
                }

                socket.join(userSessionId);
                
                // Send session info back to client
                socket.emit('session-joined', {
                    sessionId: userSessionId,
                    message: 'Successfully joined session'
                });

                // Send session history if it exists
                const history = await getSessionHistory(userSessionId);
                if (history.length > 0) {
                    socket.emit('session-history', { history });
                }

                console.log(`User ${socket.id} joined session: ${userSessionId}`);
            } catch (error) {
                console.error('Error joining session:', error);
                socket.emit('error', { message: 'Failed to join session' });
            }
        });

        // Handle chat messages
        socket.on('chat-message', async (data) => {
            try {
                const { query, streaming = true } = data;

                if (!query) {
                    socket.emit('error', { message: 'Query is required' });
                    return;
                }

                if (!userSessionId) {
                    socket.emit('error', { message: 'No active session. Please join a session first.' });
                    return;
                }

                // Emit typing indicator
                socket.emit('bot-typing', { typing: true });

                const messageId = Date.now().toString();

                if (streaming) {
                    // Generate streaming response
                    await generateAnswerStream(
                        query,
                        // onChunk callback
                        (chunk) => {
                            // On first chunk, start streaming and turn off typing indicator
                            if (!socket.streamingStarted) {
                                socket.streamingStarted = true;
                                socket.emit('chat-response-start', {
                                    messageId,
                                    timestamp: Date.now()
                                });
                            }
                            
                            socket.emit('chat-response-chunk', {
                                messageId,
                                chunk
                            });
                        },
                        // onComplete callback
                        async (fullResponse) => {
                            try {
                                socket.streamingStarted = false;
                                
                                // Store complete message in session
                                const message = await storeMessage(userSessionId, query, fullResponse);

                                // Complete streaming
                                socket.emit('chat-response-complete', {
                                    messageId,
                                    userQuery: query,
                                    timestamp: message.timestamp
                                });

                                console.log(`Streaming chat response completed for session: ${userSessionId}`);
                            } catch (error) {
                                console.error('Error completing streaming response:', error);
                                socket.emit('error', { 
                                    message: 'Failed to complete response. Please try again.' 
                                });
                            }
                        }
                    );
                } else {
                    // Non-streaming response (fallback)
                    const botResponse = await generateAnswer(query);
                    
                    // Store message in session
                    const message = await storeMessage(userSessionId, query, botResponse);

                    // Stop typing indicator
                    socket.emit('bot-typing', { typing: false });

                    // Send response back to client
                    socket.emit('chat-response', {
                        messageId: message.id,
                        userQuery: query,
                        botResponse,
                        timestamp: message.timestamp
                    });

                    console.log(`Chat response sent to session: ${userSessionId}`);
                }
            } catch (error) {
                console.error('Error handling chat message:', error);
                socket.emit('bot-typing', { typing: false });
                socket.emit('error', { 
                    message: 'Failed to generate response. Please try again.' 
                });
            }
        });

        // Handle get session history
        socket.on('get-history', async () => {
            try {
                if (!userSessionId) {
                    socket.emit('error', { message: 'No active session' });
                    return;
                }

                const history = await getSessionHistory(userSessionId);
                socket.emit('session-history', { history });
            } catch (error) {
                console.error('Error getting session history:', error);
                socket.emit('error', { message: 'Failed to retrieve session history' });
            }
        });

        // Handle clear session with transcript persistence
        socket.on('clear-session', async () => {
            try {
                if (!userSessionId) {
                    socket.emit('error', { message: 'No active session' });
                    return;
                }

                // Get session history before clearing
                const history = await getSessionHistory(userSessionId);
                
                let transcriptResult = null;
                
                if (history.length > 0) {
                    // Calculate session start time from first message
                    const startedAt = new Date(history[0].timestamp);
                    const endedAt = new Date();
                    
                    // Save transcript to PostgreSQL
                    transcriptResult = await saveTranscript(userSessionId, history, startedAt, endedAt);
                    console.log(`Transcript saved for session: ${userSessionId} (${transcriptResult.messageCount} messages)`);
                }

                // Clear session from Redis
                await clearSession(userSessionId);
                
                // Send response with transcript info if saved
                const response = {
                    message: 'Session cleared successfully',
                    sessionId: userSessionId
                };
                
                if (transcriptResult) {
                    response.transcriptSaved = true;
                    response.transcriptId = transcriptResult.transcriptId;
                    response.messageCount = transcriptResult.messageCount;
                    response.durationSeconds = transcriptResult.durationSeconds;
                } else {
                    response.transcriptSaved = false;
                    response.messageCount = 0;
                }
                
                socket.emit('session-cleared', response);

                console.log(`Session cleared: ${userSessionId}${transcriptResult ? ' (transcript saved)' : ''}`);
            } catch (error) {
                console.error('Error clearing session:', error);
                socket.emit('error', { message: 'Failed to clear session' });
            }
        });

        // Handle cleanup sessions (when user disconnects/refreshes)
        socket.on('cleanup-sessions', async (data) => {
            try {
                const { sessions, reason } = data;
                console.log(`Cleaning up ${sessions.length} sessions for socket ${socket.id}, reason: ${reason}`);
                
                for (const sessionId of sessions) {
                    try {
                        // Get session history before clearing
                        const history = await getSessionHistory(sessionId);
                        
                        if (history.length > 0) {
                            // Calculate session start time from first message
                            const startedAt = new Date(history[0].timestamp);
                            const endedAt = new Date();
                            
                            // Save transcript to PostgreSQL
                            const transcriptResult = await saveTranscript(sessionId, history, startedAt, endedAt);
                            console.log(`Transcript auto-saved for session: ${sessionId} (${transcriptResult.messageCount} messages)`);
                        }

                        // Clear session from Redis
                        await clearSession(sessionId);
                        console.log(`Session auto-cleaned: ${sessionId}`);
                    } catch (sessionError) {
                        console.error(`Error cleaning session ${sessionId}:`, sessionError);
                    }
                }
                
                console.log(`Cleanup completed for socket ${socket.id}`);
            } catch (error) {
                console.error('Error during cleanup-sessions:', error);
            }
        });

        // Handle disconnection
        socket.on('disconnect', async () => {
            console.log(`User disconnected: ${socket.id}`);
            
            // Auto-cleanup the user's active session when disconnecting
            if (userSessionId) {
                try {
                    console.log(`Auto-cleaning session on disconnect: ${userSessionId}`);
                    
                    // Get session history before clearing
                    const history = await getSessionHistory(userSessionId);
                    
                    if (history.length > 0) {
                        // Calculate session start time from first message
                        const startedAt = new Date(history[0].timestamp);
                        const endedAt = new Date();
                        
                        // Save transcript to PostgreSQL
                        const transcriptResult = await saveTranscript(userSessionId, history, startedAt, endedAt);
                        console.log(`Transcript auto-saved on disconnect: ${userSessionId} (${transcriptResult.messageCount} messages)`);
                    }

                    // Clear session from Redis
                    await clearSession(userSessionId);
                    console.log(`Session auto-cleaned on disconnect: ${userSessionId}`);
                } catch (error) {
                    console.error(`Error auto-cleaning session ${userSessionId} on disconnect:`, error);
                }
                
                socket.leave(userSessionId);
            }
        });

        // Send welcome message
        socket.emit('connected', {
            message: 'Connected to VooshRAG chat server',
            socketId: socket.id
        });
    });

    console.log('Socket.IO server initialized');
    return io;
};