// lib/sentiment.ts
// Sentiment analysis using Hugging Face Inference API via Vite env variable

const HF_API_URL = "https://api-inference.huggingface.co/models/distilbert-base-uncased-finetuned-sst-2-english";
// Make sure to set VITE_HF_TOKEN in your .env file at the project root: VITE_HF_TOKEN=hf_...
const HF_API_TOKEN = import.meta.env.VITE_HF_TOKEN as string;

interface HFResponse {
  label: string;
  score: number;
}

/**
 * Analyzes the sentiment of the given text using Hugging Face Inference API.
 * Returns "positive", "negative", or "neutral".
 */
export async function analyzeSentiment(text: string): Promise<string> {
  try {
    const response = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${HF_API_TOKEN}`
      },
      body: JSON.stringify({ inputs: text })
    });

    if (response.status === 401) {
      console.error("Unauthorized: check your Hugging Face token and env var VITE_HF_TOKEN");
      return "neutral";
    }
    if (!response.ok) {
      console.error("Hugging Face API error:", response.status, response.statusText);
      return "neutral";
    }

    // The API may return either an array or a single object
    const data = await response.json();
    let results: HFResponse[] = [];
    if (Array.isArray(data)) {
      results = data;
    } else if (data.label && data.score) {
      results = [data as HFResponse];
    } else {
      console.error("Unexpected HF response format:", data);
      return "neutral";
    }

    if (results.length === 0) {
      return "neutral";
    }

    const { label, score } = results[0];
    if (label.toUpperCase() === "POSITIVE" && score >= 0.6) return "positive";
    if (label.toUpperCase() === "NEGATIVE" && score >= 0.6) return "negative";

    return "neutral";
  } catch (error) {
    console.error("Error analyzing sentiment:", error);
    return "neutral";
  }
}
