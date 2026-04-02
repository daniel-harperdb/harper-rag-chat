import { Resource, tables } from 'harperdb';
import OpenAI from 'openai';

const openai = new OpenAI();
const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHAT_MODEL = 'gpt-4o-mini';
const SIMILARITY_THRESHOLD = 0.5;

/**
 * Chat resource with RAG (Retrieval-Augmented Generation).
 *
 * POST /Chat/ — Send a message to a conversation.
 *   Body: { "conversationId": "...", "message": "..." }
 *   Returns: streamed SSE response with assistant's reply.
 *
 * The flow:
 *   1. Store user message in Harper (Message table)
 *   2. Embed the query and vector-search the KnowledgeChunk table
 *   3. Load conversation history from Harper
 *   4. Stream the LLM response back via SSE
 *   5. Store the complete assistant response in Harper
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

		// 2. Vector search for relevant knowledge
		let context = '';
		try {
			const embeddingRes = await openai.embeddings.create({
				model: EMBEDDING_MODEL,
				input: message,
				encoding_format: 'float',
			});
			const queryVector = embeddingRes.data[0].embedding;

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
			// Knowledge base may be empty — chat without RAG
		}

		// 3. Load conversation history
		const history = await tables.Message.search({
			select: ['role', 'content', 'createdAt'],
			conditions: {
				attribute: 'conversationId',
				value: conversationId,
			},
			sort: { attribute: 'createdAt' },
			limit: 20,
		});

		const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
			{
				role: 'system',
				content: context
					? `You are a helpful assistant. Answer questions using the following knowledge base context when relevant. If the context doesn't contain relevant information, say so and answer from your general knowledge.\n\n--- KNOWLEDGE BASE ---\n${context}\n--- END KNOWLEDGE BASE ---`
					: 'You are a helpful assistant.',
			},
			...((history || []) as any[]).map((m) => ({
				role: m.role as 'user' | 'assistant',
				content: m.content,
			})),
		];

		// 4. Get LLM response (non-streaming for simplicity in resource)
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

		return {
			role: 'assistant',
			content: assistantContent,
			conversationId,
		};
	}
}
