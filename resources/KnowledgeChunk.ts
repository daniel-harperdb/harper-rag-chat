import { type RequestTargetOrId, tables } from 'harperdb';
import OpenAI from 'openai';

const openai = new OpenAI();
const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Extends the KnowledgeChunk table with custom logic for:
 * - POST: Accepts text content, generates embeddings via OpenAI, and stores chunks
 * - GET: Standard retrieval (inherited from Harper)
 */
export class KnowledgeChunk extends tables.KnowledgeChunk {
	/**
	 * Ingest a knowledge chunk. Generates embedding server-side before storing.
	 */
	async post(target: RequestTargetOrId, record: any) {
		if (!record.content) {
			throw new Error('content is required');
		}

		// Generate embedding via OpenAI
		const embeddingRes = await openai.embeddings.create({
			model: EMBEDDING_MODEL,
			input: record.content,
			encoding_format: 'float',
		});

		record.embedding = embeddingRes.data[0].embedding;
		record.createdAt = record.createdAt || Date.now();

		return super.post(target, record);
	}
}
