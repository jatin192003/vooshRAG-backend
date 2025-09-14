import redisClient from '../utils/redisClient.js';
import { v4 as uuidv4 } from 'uuid';

const SESSION_TTL = parseInt(process.env.SESSION_TTL) || 3600; // 1 hour default

/**
 * Store a chat message in a session
 * @param {string} sessionId - Unique session identifier
 * @param {string} userQuery - User's question
 * @param {string} botResponse - Bot's response
 * @param {number} timestamp - Message timestamp
 */
export const storeMessage = async (sessionId, userQuery, botResponse, timestamp = Date.now()) => {
    try {
        const message = {
            id: uuidv4(),
            userQuery,
            botResponse,
            timestamp
        };

        const sessionKey = `session:${sessionId}`;
        
        // Add message to session list
        await redisClient.lPush(sessionKey, JSON.stringify(message));
        
        // Set TTL for the session
        await redisClient.expire(sessionKey, SESSION_TTL);
        
        return message;
    } catch (error) {
        console.error('Error storing message:', error);
        throw error;
    }
};

/**
 * Retrieve all messages from a session
 * @param {string} sessionId - Session identifier
 * @returns {Array} Array of messages
 */
export const getSessionHistory = async (sessionId) => {
    try {
        const sessionKey = `session:${sessionId}`;
        const messages = await redisClient.lRange(sessionKey, 0, -1);
        
        return messages.map(msg => JSON.parse(msg)).reverse(); // Reverse to get chronological order
    } catch (error) {
        console.error('Error retrieving session history:', error);
        throw error;
    }
};

/**
 * Clear a specific session
 * @param {string} sessionId - Session identifier
 */
export const clearSession = async (sessionId) => {
    try {
        const sessionKey = `session:${sessionId}`;
        await redisClient.del(sessionKey);
        return true;
    } catch (error) {
        console.error('Error clearing session:', error);
        throw error;
    }
};

/**
 * Get all active sessions
 * @returns {Array} Array of session IDs
 */
export const getActiveSessions = async () => {
    try {
        const keys = await redisClient.keys('session:*');
        return keys.map(key => key.replace('session:', ''));
    } catch (error) {
        console.error('Error getting active sessions:', error);
        throw error;
    }
};

/**
 * Create a new session
 * @returns {string} New session ID
 */
export const createSession = () => {
    return uuidv4();
};

/**
 * Update session TTL
 * @param {string} sessionId - Session identifier
 */
export const refreshSession = async (sessionId) => {
    try {
        const sessionKey = `session:${sessionId}`;
        await redisClient.expire(sessionKey, SESSION_TTL);
    } catch (error) {
        console.error('Error refreshing session:', error);
        throw error;
    }
};