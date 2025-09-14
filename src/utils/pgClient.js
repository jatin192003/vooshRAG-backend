import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Parse the DATABASE_URL if it exists
let pgConfig;

if (process.env.DATABASE_URL) {
    // Check if we're on Render (or any production environment that requires SSL)
    const isProduction = process.env.NODE_ENV === 'production' || 
                        process.env.DATABASE_URL.includes('render.com') ||
                        process.env.DATABASE_URL.includes('amazonaws.com') ||
                        process.env.DATABASE_URL.includes('herokuapp.com');
    
    console.log('Database URL detected, isProduction:', isProduction);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    
    // Use the connection string directly with SSL configuration
    pgConfig = {
        connectionString: process.env.DATABASE_URL,
        ssl: isProduction ? { 
            rejectUnauthorized: false  // This allows self-signed certificates
        } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
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
    connectionString: pgConfig.connectionString ? '[REDACTED]' : undefined,
    ssl: pgConfig.ssl
});

const pgPool = new Pool(pgConfig);

pgPool.on('error', (err) => {
    console.error('PostgreSQL Pool Error:', err);
});

pgPool.on('connect', (client) => {
    console.log('Connected to PostgreSQL successfully');
});

// Test the connection with better error handling
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
        
        // If it's still a certificate issue, try alternative SSL config
        if (err.code === 'DEPTH_ZERO_SELF_SIGNED_CERT') {
            console.log('Trying alternative SSL configuration...');
            // This is handled by rejectUnauthorized: false
        }
    }
};

// Test connection after a short delay to ensure environment is loaded
setTimeout(testConnection, 1000);

export default pgPool;