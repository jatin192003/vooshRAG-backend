import dotenv from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';
import { generateEmbedding } from '../utils/newsIngestion.js'


dotenv.config()

const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'news';

const qdrant = new QdrantClient({
    url: QDRANT_URL,
    apiKey: QDRANT_API_KEY,
});

async function getTopKChunks(query, k = 5, collection = QDRANT_COLLECTION_NAME) {
    try {
        const queryEmbedding = await generateEmbedding(query);
        const result = await qdrant.search(collection, {
            vector: queryEmbedding,
            limit: k,
            with_payload: true,
            with_vector: false
        })

        return result.map(hit => ({
            id: hit.id,
            score: hit.score,
            chunk: hit.payload.chunk || null,
            metadata: hit.payload
        }));
    } catch (error) {
        console.error("error retreiving top chunks", error)
    }

}

export {getTopKChunks}



