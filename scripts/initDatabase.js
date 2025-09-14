import pgPool from '../src/utils/pgClient.js';

/**
 * Initialize PostgreSQL database with required tables for chat session persistence
 */
const initializeDatabase = async () => {
    try {
        console.log('Initializing PostgreSQL database...');

        // Create chat_sessions table for storing final transcripts
        const createChatSessionsTable = `
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id UUID PRIMARY KEY,
                session_id VARCHAR(255) UNIQUE NOT NULL,
                user_messages TEXT[] NOT NULL DEFAULT '{}',
                bot_responses TEXT[] NOT NULL DEFAULT '{}',
                message_count INTEGER NOT NULL DEFAULT 0,
                started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                ended_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                duration_seconds INTEGER,
                total_characters INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `;

        // Create indexes for better query performance
        const createIndexes = `
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_session_id ON chat_sessions(session_id);
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_ended_at ON chat_sessions(ended_at);
            CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);
        `;

        // Execute table creation
        await pgPool.query(createChatSessionsTable);
        console.log('✓ chat_sessions table created successfully');

        // Execute index creation
        await pgPool.query(createIndexes);
        console.log('✓ Database indexes created successfully');

        // Verify table exists
        const verifyTable = `
            SELECT table_name, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'chat_sessions' 
            ORDER BY ordinal_position;
        `;

        const result = await pgPool.query(verifyTable);
        
        if (result.rows.length > 0) {
            console.log('✓ Database initialization completed successfully');
            console.log('Table schema:');
            result.rows.forEach(row => {
                console.log(`  - ${row.column_name}: ${row.data_type}`);
            });
        } else {
            throw new Error('Table verification failed');
        }

    } catch (error) {
        console.error('❌ Database initialization failed:', error.message);
        process.exit(1);
    } finally {
        await pgPool.end();
        console.log('Database connection closed');
    }
};

// Run initialization
initializeDatabase();

export default initializeDatabase;