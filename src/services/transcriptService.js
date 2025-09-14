import pgPool from '../utils/pgClient.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Save final chat transcript to PostgreSQL when session ends
 * @param {string} sessionId - Unique session identifier
 * @param {Array} messages - Array of chat messages from session history
 * @param {Date} startedAt - Session start timestamp
 * @param {Date} endedAt - Session end timestamp
 * @returns {Object} Saved transcript information
 */
export const saveTranscript = async (sessionId, messages, startedAt = null, endedAt = new Date()) => {
    try {
        // Extract user messages and bot responses
        const userMessages = messages.map(msg => msg.userQuery);
        const botResponses = messages.map(msg => msg.botResponse);
        
        // Calculate session statistics
        const messageCount = messages.length;
        const totalCharacters = messages.reduce((total, msg) => 
            total + (msg.userQuery?.length || 0) + (msg.botResponse?.length || 0), 0
        );
        
        // Calculate session duration
        const sessionStartTime = startedAt || (messages.length > 0 ? new Date(messages[0].timestamp) : endedAt);
        const durationSeconds = Math.floor((endedAt.getTime() - sessionStartTime.getTime()) / 1000);

        const transcriptId = uuidv4();
        
        const insertQuery = `
            INSERT INTO chat_sessions (
                id, session_id, user_messages, bot_responses, message_count,
                started_at, ended_at, duration_seconds, total_characters
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *;
        `;
        
        const values = [
            transcriptId,
            sessionId,
            userMessages,
            botResponses,
            messageCount,
            sessionStartTime,
            endedAt,
            durationSeconds,
            totalCharacters
        ];
        
        const result = await pgPool.query(insertQuery, values);
        
        console.log(`✓ Transcript saved for session: ${sessionId} (${messageCount} messages)`);
        
        return {
            success: true,
            transcriptId,
            sessionId,
            messageCount,
            totalCharacters,
            durationSeconds,
            savedAt: endedAt
        };
        
    } catch (error) {
        console.error('Error saving transcript:', error);
        throw error;
    }
};

/**
 * Retrieve a saved transcript by session ID
 * @param {string} sessionId - Session identifier
 * @returns {Object|null} Transcript data or null if not found
 */
export const getTranscript = async (sessionId) => {
    try {
        const selectQuery = `
            SELECT * FROM chat_sessions 
            WHERE session_id = $1 
            ORDER BY ended_at DESC 
            LIMIT 1;
        `;
        
        const result = await pgPool.query(selectQuery, [sessionId]);
        
        if (result.rows.length === 0) {
            return null;
        }
        
        const transcript = result.rows[0];
        
        return {
            id: transcript.id,
            sessionId: transcript.session_id,
            userMessages: transcript.user_messages,
            botResponses: transcript.bot_responses,
            messageCount: transcript.message_count,
            startedAt: transcript.started_at,
            endedAt: transcript.ended_at,
            durationSeconds: transcript.duration_seconds,
            totalCharacters: transcript.total_characters,
            createdAt: transcript.created_at
        };
        
    } catch (error) {
        console.error('Error retrieving transcript:', error);
        throw error;
    }
};

/**
 * Get all saved transcripts with pagination
 * @param {number} limit - Number of transcripts to retrieve
 * @param {number} offset - Number of transcripts to skip
 * @returns {Array} Array of transcript summaries
 */
export const getAllTranscripts = async (limit = 50, offset = 0) => {
    try {
        const selectQuery = `
            SELECT 
                id, session_id, message_count, started_at, ended_at, 
                duration_seconds, total_characters, created_at
            FROM chat_sessions 
            ORDER BY ended_at DESC 
            LIMIT $1 OFFSET $2;
        `;
        
        const result = await pgPool.query(selectQuery, [limit, offset]);
        
        return result.rows.map(row => ({
            id: row.id,
            sessionId: row.session_id,
            messageCount: row.message_count,
            startedAt: row.started_at,
            endedAt: row.ended_at,
            durationSeconds: row.duration_seconds,
            totalCharacters: row.total_characters,
            createdAt: row.created_at
        }));
        
    } catch (error) {
        console.error('Error retrieving transcripts:', error);
        throw error;
    }
};

/**
 * Get transcript statistics
 * @returns {Object} Database statistics
 */
export const getTranscriptStats = async () => {
    try {
        const statsQuery = `
            SELECT 
                COUNT(*) as total_sessions,
                SUM(message_count) as total_messages,
                SUM(total_characters) as total_characters,
                AVG(duration_seconds) as avg_duration_seconds,
                AVG(message_count) as avg_messages_per_session,
                MAX(ended_at) as last_session_date
            FROM chat_sessions;
        `;
        
        const result = await pgPool.query(statsQuery);
        const stats = result.rows[0];
        
        return {
            totalSessions: parseInt(stats.total_sessions),
            totalMessages: parseInt(stats.total_messages || 0),
            totalCharacters: parseInt(stats.total_characters || 0),
            avgDurationSeconds: parseFloat(stats.avg_duration_seconds || 0),
            avgMessagesPerSession: parseFloat(stats.avg_messages_per_session || 0),
            lastSessionDate: stats.last_session_date
        };
        
    } catch (error) {
        console.error('Error retrieving transcript stats:', error);
        throw error;
    }
};

/**
 * Delete old transcripts based on age
 * @param {number} daysOld - Delete transcripts older than this many days
 * @returns {number} Number of deleted transcripts
 */
export const cleanupOldTranscripts = async (daysOld = 90) => {
    try {
        const deleteQuery = `
            DELETE FROM chat_sessions 
            WHERE ended_at < NOW() - INTERVAL '${daysOld} days'
            RETURNING session_id;
        `;
        
        const result = await pgPool.query(deleteQuery);
        
        console.log(`✓ Cleaned up ${result.rows.length} transcripts older than ${daysOld} days`);
        
        return result.rows.length;
        
    } catch (error) {
        console.error('Error cleaning up old transcripts:', error);
        throw error;
    }
};