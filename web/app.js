/**
 * Harper RAG Chat — Frontend
 *
 * Talks to Harper's REST API directly (same origin).
 * All endpoints are auto-generated or custom resources served by Harper.
 */

// ── State ──────────────────────────────────────────────────────────────────
let conversations = [];
let currentConversationId = null;
let isLoading = false;

// ── DOM refs ───────────────────────────────────────────────────────────────
const conversationList = document.getElementById('conversation-list');
const messagesEl = document.getElementById('messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const newChatBtn = document.getElementById('new-chat');
const chatHeader = document.getElementById('chat-header');

const knowledgeContent = document.getElementById('knowledge-content');
const knowledgeSource = document.getElementById('knowledge-source');
const ingestBtn = document.getElementById('ingest-btn');
const ingestStatus = document.getElementById('ingest-status');

const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

// ── API helpers ────────────────────────────────────────────────────────────
async function api(path, options = {}) {
	const res = await fetch(path, {
		headers: { 'Content-Type': 'application/json' },
		...options,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`API error (${res.status}): ${text}`);
	}
	return res.json();
}

// ── Conversations ──────────────────────────────────────────────────────────
async function loadConversations() {
	try {
		conversations = await api('/Conversation/');
		conversations.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
		renderConversationList();
	} catch {
		conversations = [];
		renderConversationList();
	}
}

function renderConversationList() {
	conversationList.innerHTML = '';
	for (const conv of conversations) {
		const li = document.createElement('li');
		li.textContent = conv.title || 'Untitled';
		li.dataset.id = conv.id;
		if (conv.id === currentConversationId) li.classList.add('active');
		li.addEventListener('click', () => selectConversation(conv.id));
		conversationList.appendChild(li);
	}
}

async function createConversation() {
	const id = `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	const title = 'New conversation';
	await api('/Conversation/', {
		method: 'POST',
		body: JSON.stringify({ id, title, createdAt: Date.now() }),
	});
	await loadConversations();
	selectConversation(id);
}

async function selectConversation(id) {
	currentConversationId = id;
	renderConversationList();

	const conv = conversations.find((c) => c.id === id);
	chatHeader.innerHTML = `${conv?.title || 'Chat'} <span>vector search + real-time persistence</span>`;

	// Load messages
	try {
		const messages = await api(`/Message/?conversationId=${id}&sort=createdAt&order=asc`);
		renderMessages(messages);
	} catch {
		renderMessages([]);
	}
}

function renderMessages(messages) {
	if (!messages || messages.length === 0) {
		messagesEl.innerHTML = `
			<div class="empty-state">
				<h3>Start a conversation</h3>
				<p>Ask a question — the AI will search your knowledge base for context.</p>
			</div>
		`;
		return;
	}

	messagesEl.innerHTML = '';
	for (const msg of messages) {
		appendMessage(msg.role, msg.content);
	}
	messagesEl.scrollTop = messagesEl.scrollHeight;
}

function appendMessage(role, content) {
	// Remove empty state if present
	const emptyState = messagesEl.querySelector('.empty-state');
	if (emptyState) emptyState.remove();

	const div = document.createElement('div');
	div.className = `message ${role}`;
	div.textContent = content;
	messagesEl.appendChild(div);
	messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ── Chat ───────────────────────────────────────────────────────────────────
chatForm.addEventListener('submit', async (e) => {
	e.preventDefault();
	const message = chatInput.value.trim();
	if (!message || isLoading) return;

	if (!currentConversationId) {
		await createConversation();
	}

	// Update conversation title if it's the first message
	const conv = conversations.find((c) => c.id === currentConversationId);
	if (conv && conv.title === 'New conversation') {
		const newTitle = message.slice(0, 50) + (message.length > 50 ? '...' : '');
		try {
			await api(`/Conversation/${currentConversationId}`, {
				method: 'PATCH',
				body: JSON.stringify({ title: newTitle }),
			});
			conv.title = newTitle;
			chatHeader.innerHTML = `${newTitle} <span>vector search + real-time persistence</span>`;
			renderConversationList();
		} catch {
			// Non-critical
		}
	}

	appendMessage('user', message);
	chatInput.value = '';

	isLoading = true;
	sendBtn.disabled = true;
	sendBtn.innerHTML = '<span class="loading"></span>';

	try {
		const result = await api('/Chat/', {
			method: 'POST',
			body: JSON.stringify({
				conversationId: currentConversationId,
				message,
			}),
		});

		appendMessage('assistant', result.content);
	} catch (err) {
		appendMessage('assistant', `Error: ${err.message}`);
	} finally {
		isLoading = false;
		sendBtn.disabled = false;
		sendBtn.textContent = 'Send';
	}
});

// ── Knowledge ingestion ────────────────────────────────────────────────────
ingestBtn.addEventListener('click', async () => {
	const content = knowledgeContent.value.trim();
	const source = knowledgeSource.value.trim();

	if (!content || !source) {
		setIngestStatus('Both content and source name are required.', 'error');
		return;
	}

	ingestBtn.disabled = true;
	ingestBtn.textContent = 'Ingesting...';
	setIngestStatus('Processing and generating embeddings...', '');

	try {
		const result = await api('/KnowledgeIngest/', {
			method: 'POST',
			body: JSON.stringify({ content, source }),
		});

		setIngestStatus(`Ingested ${result.chunksCreated} chunks from "${source}"`, 'success');
		knowledgeContent.value = '';
		knowledgeSource.value = '';
	} catch (err) {
		setIngestStatus(`Error: ${err.message}`, 'error');
	} finally {
		ingestBtn.disabled = false;
		ingestBtn.textContent = 'Ingest into Knowledge Base';
	}
});

function setIngestStatus(msg, type) {
	ingestStatus.textContent = msg;
	ingestStatus.className = `status-msg ${type}`;
}

// ── Knowledge search ───────────────────────────────────────────────────────
let searchTimeout;
searchInput.addEventListener('input', () => {
	clearTimeout(searchTimeout);
	const query = searchInput.value.trim();
	if (!query) {
		searchResults.innerHTML = '';
		return;
	}
	searchTimeout = setTimeout(() => performSearch(query), 500);
});

async function performSearch(query) {
	try {
		const results = await api('/KnowledgeSearch/', {
			method: 'POST',
			body: JSON.stringify({ query, limit: 5 }),
		});

		searchResults.innerHTML = '';
		if (!results || results.length === 0) {
			searchResults.innerHTML = '<div class="search-result">No results found.</div>';
			return;
		}

		for (const r of results) {
			const div = document.createElement('div');
			div.className = 'search-result';
			div.innerHTML = `
				<span class="score">Distance: ${(r.$distance || 0).toFixed(4)}</span>
				<div>${escapeHtml(r.content?.slice(0, 200))}${r.content?.length > 200 ? '...' : ''}</div>
				<div class="source-label">Source: ${escapeHtml(r.source || 'unknown')}</div>
			`;
			searchResults.appendChild(div);
		}
	} catch (err) {
		searchResults.innerHTML = `<div class="search-result">Error: ${escapeHtml(err.message)}</div>`;
	}
}

function escapeHtml(str) {
	if (!str) return '';
	return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── New Chat button ────────────────────────────────────────────────────────
newChatBtn.addEventListener('click', createConversation);

// ── Init ───────────────────────────────────────────────────────────────────
loadConversations();
