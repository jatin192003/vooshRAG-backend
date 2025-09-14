import dotenv from 'dotenv';
import { QdrantClient } from '@qdrant/js-client-rest';
import Parser from 'rss-parser';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_COLLECTION_NAME = process.env.QDRANT_COLLECTION_NAME || 'news';
const JINA_API_KEY = process.env.JINA_API_KEY;
const JINA_API_URL = 'https://api.jina.ai/v1/embeddings';

const parser = new Parser();
const qdrant = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

// Function to generate embeddings using Jina API
async function generateEmbedding(text) {
  try {
    const response = await axios.post(
      JINA_API_URL,
      {
        model: 'jina-embeddings-v3',
        input: [text],
      },
      {
        headers: {
          'Authorization': `Bearer ${JINA_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    return response.data.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error.message);
    throw error;
  }
}

// Function to extract and process news articles from TOI RSS feed
async function extractNewsArticles() {
  try {
    console.log('Fetching news articles from Times of India RSS feed...');
    
    const feed = await parser.parseURL('https://timesofindia.indiatimes.com/rssfeedstopstories.cms');
    
    // Get first 50 articles
    const articles = feed.items.slice(0, 50);
    console.log(`Found ${articles.length} articles to process`);
    
    const processedArticles = [];
    
    for (let i = 0; i < articles.length; i++) {
      const article = articles[i];
      console.log(`Processing article ${i + 1}/${articles.length}: ${article.title}`);
      
      try {
        // Extract description from various possible fields and clean CDATA wrapper
        let cleanDescription = '';
        
        // Try different possible description fields
        const descriptionText = article.description || 
                               article.content || 
                               article['content:encoded'] || 
                               article.summary || 
                               '';
        
        if (descriptionText) {
          // Clean description by removing CDATA wrapper and HTML tags
          cleanDescription = descriptionText
            .replace(/^\s*<!\[CDATA\[\s*/, '')
            .replace(/\s*\]\]>\s*$/, '')
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .trim();
        }
        
        // Combine title and description for embedding
        const textToEmbed = `${article.title || ''} ${cleanDescription}`.trim();
        
        if (!textToEmbed) {
          console.log(`Skipping article ${i + 1} - no text content`);
          continue;
        }
        
        // Generate embedding
        const embedding = await generateEmbedding(textToEmbed);
        
        // Prepare article data
        const articleData = {
          id: uuidv4(),
          vector: embedding,
          payload: {
            title: article.title || '',
            description: cleanDescription,
            link: article.link || '',
            guid: article.guid || '',
            pubDate: article.pubDate || '',
            creator: article['dc:creator'] || article.creator || '',
            enclosure: article.enclosure || null,
            categories: article.categories || [],
            source: 'Times of India',
            rssUrl: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms',
            processedAt: new Date().toISOString(),
            textContent: textToEmbed
          }
        };
        
        processedArticles.push(articleData);
        
        // Add small delay to avoid overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error processing article ${i + 1}:`, error.message);
        continue; // Skip this article and continue with the next
      }
    }
    
    console.log(`Successfully processed ${processedArticles.length} articles`);
    return processedArticles;
    
  } catch (error) {
    console.error('Error extracting news articles:', error);
    throw error;
  }
}

// Function to store articles in Qdrant
async function storeArticlesInQdrant(articles) {
  try {
    console.log(`Storing ${articles.length} articles in Qdrant...`);
    
    // Check if collection exists, create if not
    try {
      await qdrant.getCollection(QDRANT_COLLECTION_NAME);
      console.log(`Collection '${QDRANT_COLLECTION_NAME}' exists`);
    } catch (error) {
      console.log(`Creating collection '${QDRANT_COLLECTION_NAME}'...`);
      await qdrant.createCollection(QDRANT_COLLECTION_NAME, {
        vectors: {
          size: 1024, // Jina embeddings dimension
          distance: 'Cosine'
        }
      });
    }
    
    // Prepare points for batch upsert
    const points = articles.map(article => ({
      id: article.id,
      vector: article.vector,
      payload: article.payload
    }));
    
    // Upsert points in batches of 10 to avoid memory issues
    const batchSize = 10;
    for (let i = 0; i < points.length; i += batchSize) {
      const batch = points.slice(i, i + batchSize);
      await qdrant.upsert(QDRANT_COLLECTION_NAME, {
        wait: true,
        points: batch
      });
      console.log(`Stored batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(points.length / batchSize)}`);
    }
    
    console.log(`Successfully stored ${articles.length} articles in Qdrant`);
    return { success: true, count: articles.length };
    
  } catch (error) {
    console.error('Error storing articles in Qdrant:', error);
    throw error;
  }
}

// Main function to extract and store news articles
export async function ingestNewsArticles() {
  try {
    console.log('Starting news ingestion process...');
    
    // Extract articles from RSS feed
    const articles = await extractNewsArticles();
    
    if (articles.length === 0) {
      console.log('No articles to process');
      return { success: false, message: 'No articles found' };
    }
    
    // Store articles in Qdrant
    const result = await storeArticlesInQdrant(articles);
    
    console.log('News ingestion completed successfully!');
    return {
      success: true,
      message: `Successfully ingested ${result.count} news articles`,
      count: result.count
    };
    
  } catch (error) {
    console.error('News ingestion failed:', error);
    return {
      success: false,
      message: `News ingestion failed: ${error.message}`,
      error: error.message
    };
  }
}

// Export helper functions for testing
export { extractNewsArticles, storeArticlesInQdrant, generateEmbedding };




