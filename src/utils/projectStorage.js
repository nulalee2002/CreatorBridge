export const PROJECTS_KEY = 'cm-projects';

export function loadLocalProjects(clientId = null) {
  try {
    const all = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]');
    return clientId ? all.filter(p => p.clientId === clientId) : all;
  } catch {
    return [];
  }
}

export function saveLocalProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

export function upsertLocalProject(project) {
  const all = loadLocalProjects();
  const exists = all.some(p => p.id === project.id);
  const next = exists
    ? all.map(p => p.id === project.id ? { ...p, ...project } : p)
    : [project, ...all];
  saveLocalProjects(next);
  return project;
}

export function mergeProjects(...lists) {
  const byId = new Map();
  lists.flat().filter(Boolean).forEach(project => {
    if (!project?.id) return;
    const current = byId.get(project.id) || {};
    byId.set(project.id, { ...project, ...current });
  });
  return Array.from(byId.values()).sort((a, b) => {
    const aTime = new Date(a.createdAt || a.created_at || 0).getTime();
    const bTime = new Date(b.createdAt || b.created_at || 0).getTime();
    return bTime - aTime;
  });
}

export function fromSupabaseProject(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    serviceId: row.service_id,
    budgetMin: row.budget_min,
    budgetMax: row.budget_max,
    projectDuration: row.project_duration || row.projectDuration || null,
    location: row.location || '',
    deadline: row.timeline || null,
    clientId: row.client_id,
    clientName: row.client_name || 'Client',
    status: row.status || 'open',
    applications: row.applications || 0,
    acceptedCreatorId: row.accepted_creator_id,
    acceptedApplicationId: row.accepted_application_id,
    deliveredAt: row.delivered_at,
    approvedAt: row.approved_at,
    deliveryLink: row.delivery_link,
    deliveryNotes: row.delivery_notes,
    revision_count: row.revision_count || 0,
    createdAt: row.created_at,
    source: 'supabase',
  };
}

export function toSupabaseProject(project, userId) {
  return {
    client_id: userId || project.clientId,
    title: project.title,
    service_id: project.serviceId || project.service_id || null,
    description: project.description,
    budget_min: project.budgetMin ?? project.budget_min ?? null,
    budget_max: project.budgetMax ?? project.budget_max ?? null,
    location: typeof project.location === 'string'
      ? project.location
      : [project.location?.city, project.location?.state].filter(Boolean).join(', '),
    timeline: project.deadline || project.projectDate || project.timeline || null,
    status: project.status || 'open',
    accepted_creator_id: project.acceptedCreatorId || project.accepted_creator_id || null,
    accepted_application_id: project.acceptedApplicationId || project.accepted_application_id || null,
    delivered_at: project.deliveredAt || project.delivered_at || null,
    approved_at: project.approvedAt || project.approved_at || null,
    delivery_link: project.deliveryLink || project.delivery_link || null,
    delivery_notes: project.deliveryNotes || project.delivery_notes || null,
    revision_count: project.revision_count || 0,
    applications: project.applications || 0,
  };
}
