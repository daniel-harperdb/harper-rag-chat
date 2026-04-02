import { Resource, tables } from 'harperdb';
import OpenAI from 'openai';

const openai = new OpenAI();
const EMBEDDING_MODEL = 'text-embedding-3-small';
const SIMILARITY_THRESHOLD = 0.5;

/**
 * Custom resource for semantic search across the knowledge base.
 * POST /KnowledgeSearch/ with { "query": "your question" }
 * Returns the top matching chunks ranked by vector similarity.
 */
export class KnowledgeSearch extends Resource {
	async post(data: { query: string; limit?: number }) {
		if (!data.query) {
			throw new Error('query is required');
		}

		// Generate query embedding
		const embeddingRes = await openai.embeddings.create({
			model: EMBEDDING_MODEL,
			input: data.query,
			encoding_format: 'float',
		});
		const queryVector = embeddingRes.data[0].embedding;

		// Vector search using Harper's HNSW index
		const results = await tables.KnowledgeChunk.search({
			select: ['id', 'content', 'source', '$distance'],
			conditions: {
				attribute: 'embedding',
				comparator: 'lt',
				value: SIMILARITY_THRESHOLD,
				target: queryVector,
			},
			limit: data.limit || 5,
		});

		return results;
	}
}
