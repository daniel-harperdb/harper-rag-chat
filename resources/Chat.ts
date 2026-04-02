import { Resource, tables } from 'harperdb';
import OpenAI from 'openai';
import { embed } from './embeddings.js';

const openai = new OpenAI();
const CHAT_MODEL = 'gpt-4o-mini';
const SIMILARITY_THRESHOLD = 0.5;

/**
 * Chat resource with RAG (Retrieval-Augmented Generation).
 *
 * POST /Chat/ — Send a message to a conversation.
 *   Body: { "conversationId": "...", "message": "..." }
 *
 * Embeddings use local ONNX (no API key needed for search).
 * Chat completions use OpenAI gpt-4o-mini (requires OPENAI_API_KEY).
 */
export class Chat extends Resource {
	async post(data: { conversationId: string; message: string }) {
		if (!data.conversationId || !data.message) {
			throw new Error('conversationId and message are required');
		}

		const { conversationId, message } = data;
		const now = Date.now();

		// 1. Store user message
		await tables.Message.put({
			id: `${conversationId}_${now}_user`,
			conversationId,
			role: 'user',
			content: message,
			createdAt: now,
		});

		// 2. Embed query locally and vector-search knowledge base
		let context = '';
		try {
			const queryVector = await embed(message);
			const results = await tables.KnowledgeChunk.search({
				select: ['content', 'source', '$distance'],
				conditions: {
					attribute: 'embedding',
					comparator: 'lt',
					value: SIMILARITY_THRESHOLD,
					target: queryVector,
				},
				limit: 3,
			});
			if (results && results.length > 0) {
				context = results
					.map((r: any) => `[Source: ${r.source}]\n${r.content}`)
					.join('\n\n---\n\n');
			}
		} catch {
			// Knowledge base may be empty — chat without RAG context
		}

		// 3. Load conversation history
		const history = await tables.Message.search({
			select: ['role', 'content', 'createdAt'],
			conditions: { attribute: 'conversationId', value: conversationId },
			sort: { attribute: 'createdAt' },
			limit: 20,
		});

		const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{
				role: 'system',
				content: context
					? `You are a helpful assistant. Answer questions using the following knowledge base context when relevant.\n\n--- KNOWLEDGE BASE ---\n${context}\n--- END KNOWLEDGE BASE ---`
					: 'You are a helpful assistant.',
			},
			...((history || []) as any[]).map((m) => ({
				role: m.role as 'user' | 'assistant',
				content: m.content,
			})),
		];

		// 4. Get LLM response
		const completion = await openai.chat.completions.create({
			model: CHAT_MODEL,
			messages,
		});

		const assistantContent = completion.choices[0]?.message?.content || '';

		// 5. Store assistant response
		const responseTime = Date.now();
		await tables.Message.put({
			id: `${conversationId}_${responseTime}_assistant`,
			conversationId,
			role: 'assistant',
			content: assistantContent,
			createdAt: responseTime,
		});

		return { role: 'assistant', content: assistantContent, conversationId };
	}
}
