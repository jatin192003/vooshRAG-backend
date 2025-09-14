import { GoogleGenerativeAI } from "@google/generative-ai"
import dotenv from 'dotenv';
import { getTopKChunks } from '../services/retrieverService.js'

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateAnswer(query) {
    try {
        const chunks = await getTopKChunks(query);
        if (!chunks || chunks.length === 0) {
            return "I did not find relevant information";
        }

        console.log("Starting Gemini response generation...");

        // Build context string from retrieved chunks
        const context = chunks
            .map(
                (c, i) =>
                    `Source ${i + 1}:\n${c.metadata.textContent}\nRead more: ${c.metadata.link}`
            )
            .join("\n\n");

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const prompt = `
You are an assistant that answers questions based on retrieved news articles.
Use the provided context to answer the query. If the answer is not in the context, say "I did not find relevant information"

Query: ${query}

Context:
${context}

Answer:
`;

        const result = await model.generateContent(prompt);
        return result.response.text();
    } catch (error) {
        console.error('Error generating answer:', error);
        throw error;
    }
}

async function generateAnswerStream(query, onChunk, onComplete) {
    try {
        const chunks = await getTopKChunks(query);
        if (!chunks || chunks.length === 0) {
            onComplete("I did not find relevant information");
            return;
        }

        console.log("Starting Gemini streaming response generation...");

        // Build context string from retrieved chunks
        const context = chunks
            .map(
                (c, i) =>
                    `Source ${i + 1}:\n${c.metadata.textContent}\nRead more: ${c.metadata.link}`
            )
            .join("\n\n");

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        const prompt = `
You are an assistant that answers questions based on retrieved news articles.
Use the provided context to answer the query. If the answer is not in the context, say "I did not find relevant information"

Query: ${query}

Context:
${context}

Answer:
`;

        const result = await model.generateContentStream(prompt);
        let fullResponse = '';
        let totalChunks = 0;

        for await (const chunk of result.stream) {
            totalChunks++;
            const chunkText = chunk.text();
            
            console.log(`\n=== CHUNK ${totalChunks} ===`);
            console.log(`Length: ${chunkText.length}`);
            console.log(`Content: "${chunkText}"`);
            console.log(`Full response so far length: ${fullResponse.length}`);
            
            if (chunkText && chunkText.length > 0) {
                fullResponse += chunkText;
                onChunk(chunkText);
            }
        }

        console.log(`\n=== STREAMING COMPLETE ===`);
        console.log(`Total chunks: ${totalChunks}`);
        console.log(`Final response length: ${fullResponse.length}`);
        onComplete(fullResponse);
    } catch (error) {
        console.error('Error generating streaming answer:', error);
        throw error;
    }
}

export { generateAnswer, generateAnswerStream };