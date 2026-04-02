import { Resource, tables } from 'harperdb';
import { embedBatch } from './embeddings.js';

/**
 * Bulk ingestion endpoint for documents.
 * POST /KnowledgeIngest/ with { "content": "full document text", "source": "filename.pdf" }
 * Chunks the text, generates embeddings locally (no API key), and stores in KnowledgeChunk table.
 */
export class KnowledgeIngest extends Resource {
	async post(data: { content: string; source: string; chunkSize?: number }) {
		if (!data.content || !data.source) {
			throw new Error('content and source are required');
		}

		const chunkSize = data.chunkSize || 500;
		const overlap = 50;
		const chunks = chunkText(data.content, chunkSize, overlap);

		// Generate all embeddings in one batch — local ONNX, no API call
		const embeddings = await embedBatch(chunks);

		const now = Date.now();
		let stored = 0;

		for (let i = 0; i < chunks.length; i++) {
			const id = `${data.source}_${i}_${now}`;
			await tables.KnowledgeChunk.put({
				id,
				content: chunks[i],
				source: data.source,
				embedding: embeddings[i],
				createdAt: now,
			});
			stored++;
		}

		return {
			ok: true,
			source: data.source,
			chunksCreated: stored,
		};
	}
}

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
	const chunks: string[] = [];
	let start = 0;
	while (start < text.length) {
		const end = Math.min(start + chunkSize, text.length);
		const chunk = text.slice(start, end).trim();
		if (chunk.length > 0) chunks.push(chunk);
		start = end - overlap;
		if (start + overlap >= text.length) break;
	}
	return chunks;
}
