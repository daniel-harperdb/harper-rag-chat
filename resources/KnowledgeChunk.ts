import { type RequestTargetOrId, tables } from 'harperdb';
import { embed } from './embeddings.js';

/**
 * Extends the KnowledgeChunk table to auto-generate embeddings on insert.
 * Uses local ONNX model — no API key required.
 */
export class KnowledgeChunk extends tables.KnowledgeChunk {
	async post(target: RequestTargetOrId, record: any) {
		if (!record.content) {
			throw new Error('content is required');
		}
		record.embedding = await embed(record.content);
		record.createdAt = record.createdAt || Date.now();
		return super.post(target, record);
	}
}
