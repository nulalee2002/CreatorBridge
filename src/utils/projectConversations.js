function participantKey(message) {
  const participants = [message?.senderId, message?.recipientId]
    .filter(Boolean)
    .map(String)
    .sort();
  return participants.length === 2 ? `participants:${participants.join('_')}` : null;
}

export function buildProjectThreadKey(message) {
  const projectId = message?.projectId || message?.project_id;
  if (projectId) return `project:${projectId}`;

  const conversationId = message?.remoteConversationId
    || message?.conversationId
    || message?.conversation_id
    || message?.threadId;
  if (conversationId) return `conversation:${conversationId}`;

  return participantKey(message) || `local:${message?.id || 'unknown'}`;
}

export function projectIdFromThreadKey(threadKey) {
  return String(threadKey || '').startsWith('project:')
    ? String(threadKey).slice('project:'.length)
    : null;
}
