import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

let pgConfig;

if (process.env.DATABASE_URL) {
    // Parse the DATABASE_URL manually for better SSL control
    try {
        const dbUrl = new URL(process.env.DATABASE_URL);
        
        const isProduction = process.env.NODE_ENV === 'production' || 
                            process.env.DATABASE_URL.includes('render.com');
        
        console.log('Parsing DATABASE_URL manually, isProduction:', isProduction);
        console.log('Parsed hostname:', dbUrl.hostname);
        
        pgConfig = {
            host: dbUrl.hostname,
            port: parseInt(dbUrl.port) || 5432,
            database: dbUrl.pathname.slice(1), // Remove leading slash
            user: dbUrl.username,
            password: dbUrl.password,
            ssl: isProduction ? {
                rejectUnauthorized: false,
                checkServerIdentity: false
            } : false,
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        };
        
        console.log('PostgreSQL Config (parsed):', {
            host: pgConfig.host,
            port: pgConfig.port,
            database: pgConfig.database,
            user: pgConfig.user,
            ssl: pgConfig.ssl
        });
        
    } catch (parseErr) {
        console.error('Failed to parse DATABASE_URL:', parseErr);
        throw parseErr;
    }
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

const pgPool = new Pool(pgConfig);

pgPool.on('error', (err) => {
    console.error('PostgreSQL Pool Error:', err);
});

pgPool.on('connect', () => {
    console.log('Connected to PostgreSQL successfully');
});

// Test connection
const testConnection = async () => {
    try {
        console.log('Testing PostgreSQL connection...');
        const client = await pgPool.connect();
        const result = await client.query('SELECT NOW()');
        console.log('PostgreSQL connection test successful:', result.rows[0]);
        client.release();
    } catch (err) {
        console.error('PostgreSQL connection test failed:', err.message);
        console.error('Error code:', err.code);
    }
};

setTimeout(testConnection, 1000);

export default pgPool;