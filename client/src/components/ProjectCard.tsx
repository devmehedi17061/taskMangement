import { Link } from 'react-router-dom';
import { FileSpreadsheet, FileText, Trash2, ExternalLink } from 'lucide-react';
import type { Project } from '../lib/types';
import { Button } from './Button';

interface ProjectCardProps {
  project: Project;
  onDelete: (project: Project) => void;
  deleting: boolean;
}

export function ProjectCard({ project, onDelete, deleting }: ProjectCardProps) {
  const created = project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '';
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/projects/${project.id}`}
            className="block truncate text-base font-semibold text-ink hover:underline"
          >
            {project.title}
          </Link>
          <p className="text-xs text-slate-500">
            Created {created}
            {project.assignedTo ? ` · ${project.assignedTo}` : ''}
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={() => onDelete(project)}
          loading={deleting}
          className="text-rose-600 hover:bg-rose-50"
          title="Delete project (trashes the Drive folder)"
        >
          <Trash2 size={14} />
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <a
          href={project.sheetUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 hover:bg-slate-100"
        >
          <FileSpreadsheet size={14} className="text-emerald-600" /> Sheet <ExternalLink size={12} />
        </a>
        <a
          href={project.docUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700 hover:bg-slate-100"
        >
          <FileText size={14} className="text-blue-600" /> Doc <ExternalLink size={12} />
        </a>
        <Link
          to={`/projects/${project.id}`}
          className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1 text-white hover:bg-accentHover"
        >
          Open Tasks
        </Link>
      </div>
    </div>
  );
}
