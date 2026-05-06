import type { GovernanceProposalOperation } from '../services/api';

export type GovernanceProposalOperationKind = GovernanceProposalOperation['kind'];

export interface GovernanceProposalFormState {
  title: string;
  description: string;
  type: string;
  operationKind: GovernanceProposalOperationKind;
  operationPath: string;
  operationContent: string;
}

export interface GovernanceProposalCreateInput {
  title: string;
  description?: string;
  type?: string;
  operations: GovernanceProposalOperation[];
}

export type GovernanceProposalCreateInputResult =
  | { ok: true; value: GovernanceProposalCreateInput }
  | { ok: false; error: string };

export function createEmptyGovernanceProposalForm(): GovernanceProposalFormState {
  return {
    title: '',
    description: '',
    type: 'evolution',
    operationKind: 'write',
    operationPath: '',
    operationContent: '',
  };
}

function normalizeOperationPath(rawPath: string): string | null {
  const slashPath = rawPath.trim().replace(/\\/gu, '/');
  const stripped = slashPath.startsWith('governance/charter/')
    ? slashPath.slice('governance/charter/'.length)
    : slashPath;
  const segments = stripped.split('/').filter(Boolean);

  if (!stripped || stripped.startsWith('/') || segments.length === 0) {
    return null;
  }
  if (segments.some((segment) => segment === '.' || segment === '..')) {
    return null;
  }

  return segments.join('/');
}

export function buildGovernanceProposalCreateInput(
  form: GovernanceProposalFormState,
): GovernanceProposalCreateInputResult {
  const title = form.title.trim();
  if (!title) {
    return { ok: false, error: 'title is required' };
  }

  const path = normalizeOperationPath(form.operationPath);
  if (!path) {
    return { ok: false, error: 'operation path is required and must stay within governance/charter' };
  }

  const description = form.description.trim();
  const type = form.type.trim();
  const base = {
    title,
    ...(description ? { description } : {}),
    ...(type ? { type } : {}),
  };

  if (form.operationKind === 'delete') {
    return {
      ok: true,
      value: {
        ...base,
        operations: [{ kind: 'delete', path }],
      },
    };
  }

  if (!form.operationContent) {
    return { ok: false, error: 'write operation content is required' };
  }

  return {
    ok: true,
    value: {
      ...base,
      operations: [{ kind: 'write', path, content: form.operationContent }],
    },
  };
}
