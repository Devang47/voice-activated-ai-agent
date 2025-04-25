import { WebSearchResponse } from '../types/index.ts';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

export async function performWebSearch(query: string): Promise<string> {
  try {
    const apiKey = process.env.SERP_API_KEY;

    const response = await axios.get('https://serpapi.com/search', {
      params: {
        q: query,
        engine: 'google',
        api_key: apiKey,
      },
    });

    const results = response.data.organic_results;
    if (!results || results.length === 0) {
      return JSON.stringify({
        success: false,
        error: 'No results found.',
        details: {
          query,
          timestamp: new Date().toISOString(),
        },
      });
    }

    const topResults = results
      .slice(0, 3)
      .map((r: any) => `${r.title} - ${r.link}`)
      .join('\n');

    const searchResponse: WebSearchResponse = {
      success: true,
      results: topResults,
      details: {
        query,
        timestamp: new Date().toISOString(),
      },
    };
    return JSON.stringify(searchResponse);
  } catch (error) {
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: {
        query,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
