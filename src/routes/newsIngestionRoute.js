import { Router } from 'express';
import { ingestNewsArticles } from '../utils/newsIngestion.js';

const router = Router();

// Route to trigger news ingestion
router.post('/ingest-news', async (req, res) => {
  try {
    const result = await ingestNewsArticles();
    res.status(200).json({ message: 'News articles ingested successfully', data: result });
  } catch (error) {
    console.error('Error ingesting news articles:', error);
    res.status(500).json({ message: 'Failed to ingest news articles', error: error.message });
  }
});

export default router;
