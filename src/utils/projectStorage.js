import { clampNumber, sanitizeLongText, sanitizePlainText, sanitizeTagList, sanitizeUrl } from './inputSecurity.js';

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
    title: sanitizePlainText(project.title, 120),
    service_id: sanitizePlainText(project.serviceId || project.service_id || '', 80) || null,
    description: sanitizeLongText(project.description, 4000),
    budget_min: clampNumber(project.budgetMin ?? project.budget_min, { min: 0, max: 1000000, fallback: null }),
    budget_max: clampNumber(project.budgetMax ?? project.budget_max, { min: 0, max: 1000000, fallback: null }),
    project_duration: sanitizePlainText(project.projectDuration || project.project_duration || '', 80) || null,
    location: typeof project.location === 'string'
      ? sanitizePlainText(project.location, 160)
      : sanitizePlainText([project.location?.city, project.location?.state].filter(Boolean).join(', '), 160),
    timeline: sanitizePlainText(project.deadline || project.projectDate || project.timeline || '', 80) || null,
    status: sanitizePlainText(project.status || 'open', 40),
    accepted_creator_id: project.acceptedCreatorId || project.accepted_creator_id || null,
    accepted_application_id: project.acceptedApplicationId || project.accepted_application_id || null,
    delivered_at: project.deliveredAt || project.delivered_at || null,
    approved_at: project.approvedAt || project.approved_at || null,
    delivery_link: sanitizeUrl(project.deliveryLink || project.delivery_link || '', 500) || null,
    delivery_notes: sanitizeLongText(project.deliveryNotes || project.delivery_notes || '', 2000) || null,
    revision_count: clampNumber(project.revision_count, { min: 0, max: 50, fallback: 0 }),
    applications: clampNumber(project.applications, { min: 0, max: 100000, fallback: 0 }),
  };
}

export function sanitizeProjectDraft(project) {
  return {
    ...project,
    title: sanitizePlainText(project.title, 120),
    description: sanitizeLongText(project.description, 4000),
    serviceId: sanitizePlainText(project.serviceId || project.service_id || '', 80),
    budgetMin: clampNumber(project.budgetMin ?? project.budget_min, { min: 0, max: 1000000, fallback: null }),
    budgetMax: clampNumber(project.budgetMax ?? project.budget_max, { min: 0, max: 1000000, fallback: null }),
    projectDuration: sanitizePlainText(project.projectDuration || project.project_duration || '', 80),
    deadline: sanitizePlainText(project.deadline || project.projectDate || project.timeline || '', 80) || null,
    location: sanitizePlainText(typeof project.location === 'string'
      ? project.location
      : [project.location?.city, project.location?.state].filter(Boolean).join(', '), 160),
    skills: Array.isArray(project.skills)
      ? project.skills.map(skill => sanitizePlainText(skill, 36)).filter(Boolean).slice(0, 12)
      : sanitizeTagList(project.skills, 12, 36),
  };
}
