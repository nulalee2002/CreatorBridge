import { supabase, supabaseConfigured } from './supabase';

export async function recordDirectionalEvent({ name, version, entityType, entityId, surface, properties = {} }) {
  if (!supabaseConfigured || !supabase || !name || !Number.isInteger(version)) {
    return { recorded: false, reason: 'unavailable' };
  }

  try {
    const { data, error } = await supabase.rpc('record_directional_platform_event', {
      p_event_name: name,
      p_event_version: version,
      p_entity_type: entityType || null,
      p_entity_id: entityId || null,
      p_surface: surface || null,
      p_properties: properties,
    });

    if (error) return { recorded: false, reason: 'rejected' };
    return { recorded: true, eventId: data };
  } catch {
    return { recorded: false, reason: 'unavailable' };
  }
}
