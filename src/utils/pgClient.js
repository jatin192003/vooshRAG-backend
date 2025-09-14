import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Parse the DATABASE_URL if it exists
let pgConfig;

if (process.env.DATABASE_URL) {
    // Use the connection string directly with SSL configuration
    pgConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { 
            rejectUnauthorized: false 
        } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000, // Increased timeout
    };
} else {
    // Fallback to individual environment variables
    pgConfig = {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: process.env.POSTGRES_PORT || 5432,
        database: process.env.POSTGRES_DB || 'vooshrag',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || '',
        ssl: false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    };
}

console.log('PostgreSQL Config:', {
    ...pgConfig,
    connectionString: pgConfig.connectionString ? '[REDACTED]' : undefined
});

const pgPool = new Pool(pgConfig);

pgPool.on('error', (err) => {
    console.error('PostgreSQL Pool Error:', err);
});

pgPool.on('connect', (client) => {
    console.log('Connected to PostgreSQL');
});

// Test the connection with better error handling
const testConnection = async () => {
    try {
        const client = await pgPool.connect();
        const result = await client.query('SELECT NOW()');
        console.log('PostgreSQL connection test successful:', result.rows[0]);
        client.release();
    } catch (err) {
        console.error('PostgreSQL connection test failed:', err.message);
        console.error('Full error:', err);
    }
};

// Test connection after a short delay to ensure environment is loaded
setTimeout(testConnection, 1000);

export default pgPool;