/**
 * Local ONNX embeddings — no API key required.
 *
 * Uses @huggingface/transformers with sentence-transformers/all-MiniLM-L6-v2.
 * Produces 384-dimensional vectors, identical to the model used in Harper Cortex.
 * The model is downloaded once on first use and cached locally.
 */
import { pipeline } from '@huggingface/transformers';

const EMBEDDING_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';

let embeddingPipeline: any = null;

async function getEmbeddingPipeline() {
	if (!embeddingPipeline) {
		embeddingPipeline = await pipeline('feature-extraction', EMBEDDING_MODEL, {
			dtype: 'fp32',
		});
	}
	return embeddingPipeline;
}

/**
 * Embed a single string. Returns a 384-dim float array.
 */
export async function embed(text: string): Promise<number[]> {
	const pipe = await getEmbeddingPipeline();
	const output = await pipe(text, { pooling: 'mean', normalize: true });
	return Array.from(output.data as Float32Array);
}

/**
 * Embed multiple strings in a single batch. More efficient than calling embed() in a loop.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
	const pipe = await getEmbeddingPipeline();
	const output = await pipe(texts, { pooling: 'mean', normalize: true });
	// output.data is a flat Float32Array — reshape into [texts.length][384]
	const dims = 384;
	const result: number[][] = [];
	for (let i = 0; i < texts.length; i++) {
		result.push(Array.from((output.data as Float32Array).slice(i * dims, (i + 1) * dims)));
	}
	return result;
}
