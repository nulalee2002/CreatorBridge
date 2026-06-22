import { UserPlus } from 'lucide-react';

export function HireCollaboratorButton({ projectId, onClick, disabled = false }) {
  const label = projectId ? 'Add to This Project' : 'Hire as a Collaborator';
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn-gold min-h-[38px] disabled:opacity-50">
      <UserPlus size={15} aria-hidden="true" /> {label}
    </button>
  );
}
