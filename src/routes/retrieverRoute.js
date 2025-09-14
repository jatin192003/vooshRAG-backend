import { Router } from 'express';
import { getTopKChunks } from '../services/retrieverService.js'
import { generateAnswer } from '../services/geminiService.js';

const router = Router();


router.post('/retrieve', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ message: 'Query is required' });
        }

        const result = await getTopKChunks(query);
        res.status(200).json({ message: 'Top K chunks retrieved successfully', data: result });
    } catch (error) {
        res.status(500).json({ message: "error retrieving top chunks"})
    }
});

router.post('/chat', async (req, res) => {
    try {
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ message: 'Query is required' });
        }

        const result = await generateAnswer(query);
        res.status(200).json({ message: 'Chat response generated successfully', data: result });
    } catch (error) {
        res.status(500).json({ message: "error generating chat response"})
    }
});

export default router;
