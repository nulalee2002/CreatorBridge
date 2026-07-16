import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Generates the shared draft call summary from the stored VTT transcript.
// Internal-only: called by zoom-webhook with the service role key. The AI
// only summarizes the real transcript; it never invents content or people.

const MAX_TRANSCRIPT_CHARS = 24000;
const DEFAULT_MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = [
  'You summarize a recorded business call between a verified creator and their client on CreatorBridge.',
  'Use ONLY what is in the transcript. Never invent names, amounts, dates, or commitments.',
  'Write plain, professional English in short sentences.',
  'Structure the summary with exactly these four headings, each on its own line:',
  'Agreed scope',
  'Decisions',
  'Action items',
  'Dates',
  'Under each heading, use simple hyphen bullets. If a section has nothing, write "- Nothing discussed."',
  'Never use em dashes or en dashes anywhere in the output. Use commas or hyphens instead.',
].join('\n');

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function parseStorageReference(value = '') {
  if (!value.startsWith('storage://')) return null;
  const withoutPrefix = value.slice('storage://'.length);
  const slashIndex = withoutPrefix.indexOf('/');
  if (slashIndex < 1) return null;
  return {
    bucket: withoutPrefix.slice(0, slashIndex),
    path: withoutPrefix.slice(slashIndex + 1),
  };
}

// Reduce a VTT file to readable dialogue lines.
function vttToDialogue(vtt: string) {
  const lines = vtt.split(/\r?\n/);
  const dialogue: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed === 'WEBVTT') continue;
    if (/^\d+$/.test(trimmed)) continue;
    if (trimmed.includes('-->')) continue;
    if (/^(NOTE|STYLE|REGION)\b/.test(trimmed)) continue;
    dialogue.push(trimmed.replace(/<[^>]+>/g, ''));
  }
  return dialogue.join('\n');
}

function stripDashes(text: string) {
  return text.replace(/—|–/g, '-');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  try {
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const bearer = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    if (!serviceRoleKey || bearer !== serviceRoleKey) {
      return json({ error: 'unauthorized' }, 401);
    }

    const apiKey = Deno.env.get('OPENAI_API_KEY') || '';
    if (!apiKey) return json({ error: 'AI summarization is not configured' }, 503);

    const { callId } = await req.json();
    if (!callId) return json({ error: 'callId is required' }, 400);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      serviceRoleKey,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: call, error: callError } = await admin
      .from('project_calls')
      .select('*')
      .eq('id', callId)
      .maybeSingle();
    if (callError || !call) return json({ error: 'Call not found' }, 404);
    if (!call.transcript_ref) return json({ error: 'No transcript stored for this call' }, 409);

    const { data: existing } = await admin
      .from('call_summaries')
      .select('id')
      .eq('call_id', call.id)
      .maybeSingle();
    if (existing) return json({ summaryId: existing.id, idempotent: true });

    const parsed = parseStorageReference(call.transcript_ref);
    if (!parsed || parsed.bucket !== 'call-transcripts') {
      return json({ error: 'Transcript reference is invalid' }, 500);
    }
    const { data: file, error: fileError } = await admin.storage
      .from(parsed.bucket)
      .download(parsed.path);
    if (fileError || !file) return json({ error: 'Transcript could not be loaded' }, 500);

    const dialogue = vttToDialogue(await file.text()).slice(0, MAX_TRANSCRIPT_CHARS);
    if (dialogue.trim().length < 20) {
      return json({ error: 'Transcript is empty; no summary generated' }, 409);
    }

    const model = Deno.env.get('OPENAI_MODEL') || DEFAULT_MODEL;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 900,
        temperature: 0.2,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Summarize this call transcript:\n\n${dialogue}` },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error('summarize-call OpenAI error:', response.status, await response.text());
      return json({ error: 'AI service error' }, 502);
    }
    const data = await response.json();
    const draft = stripDashes(String(data.choices?.[0]?.message?.content || '').trim());
    if (!draft) return json({ error: 'empty AI response' }, 502);

    const { data: summary, error: insertError } = await admin
      .from('call_summaries')
      .insert({
        call_id: call.id,
        project_id: call.project_id,
        body: draft,
        status: 'draft',
      })
      .select('*')
      .single();
    if (insertError || !summary) {
      if (insertError?.code === '23505') return json({ idempotent: true });
      throw new Error(insertError?.message || 'Summary could not be saved');
    }

    // First revision snapshot: the AI draft, no human editor.
    await admin.from('call_summary_revisions').insert({
      summary_id: summary.id,
      editor_user_id: null,
      body_snapshot: draft,
    });

    for (const recipient of [call.creator_id, call.client_id]) {
      await admin.rpc('create_platform_notification', {
        p_recipient_id: recipient,
        p_type: 'call_summary_ready',
        p_title: 'Call summary ready for review',
        p_body: 'The draft summary of your call is ready. Both parties can review and edit it; the creator owns its accuracy.',
        p_action_url: '/projects',
        p_metadata: { project_id: call.project_id, call_id: call.id, summary_id: summary.id },
        p_actor_id: null,
        p_response_due_at: null,
      });
    }

    return json({ summaryId: summary.id, model });
  } catch (error) {
    console.error('summarize-call error:', error);
    return json({ error: error instanceof Error ? error.message : 'summary generation failed' }, 500);
  }
});
