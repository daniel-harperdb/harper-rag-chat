import { Resource, tables } from 'harperdb';
import { embed } from './embeddings.js';

const SIMILARITY_THRESHOLD = 0.5;

/**
 * Semantic search across the knowledge base.
 * POST /KnowledgeSearch/ with { "query": "your question" }
 * Embeds the query locally (no API key) and returns top matching chunks.
 */
export class KnowledgeSearch extends Resource {
	async post(data: { query: string; limit?: number }) {
		if (!data.query) {
			throw new Error('query is required');
		}

		const queryVector = await embed(data.query);

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
