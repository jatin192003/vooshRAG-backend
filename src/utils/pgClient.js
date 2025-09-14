import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL || undefined,
    host: process.env.POSTGRES_HOST || 'localhost',
    port: process.env.POSTGRES_PORT || 5432,
    database: process.env.POSTGRES_DB || 'vooshrag',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || '',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pgPool.on('error', (err) => {
    console.error('PostgreSQL Pool Error:', err);
});

pgPool.on('connect', () => {
    console.log('Connected to PostgreSQL');
});

// Test the connection
pgPool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('PostgreSQL connection test failed:', err.message);
    } else {
        console.log('PostgreSQL connection test successful');
    }
});

export default pgPool;