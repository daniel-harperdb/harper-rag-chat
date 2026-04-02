import { Resource, tables } from 'harperdb';

/**
 * WebSocket/SSE resource for real-time message streaming.
 * Connect via WebSocket to /ChatStream/{conversationId}
 * to receive live updates when new messages are added.
 */
export class ChatStream extends Resource {
	async *connect(target: string, incomingMessages: AsyncIterable<any> | null) {
		// Subscribe to Message table changes filtered by conversationId
		const subscription = await tables.Message.subscribe({
			conditions: {
				attribute: 'conversationId',
				value: target,
			},
		});

		if (!incomingMessages) {
			// SSE mode — just stream table changes
			return subscription;
		}

		// WebSocket mode — handle bidirectional
		yield* subscription;
	}
}
