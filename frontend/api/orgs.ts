import { apiFetch } from '@/lib/apiFetch';

// TODO: route these through Next.js API proxy routes before using client-side
const API_URL = '/api';

// --- Organizations ---

export async function createOrganization(name: string) {
  const res = await fetch(`${API_URL}/organizations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? 'Failed to create organization');
  }

  return res.json().then(d => d.organization);
}

export async function listOrganizations() {
  const res = await fetch(`${API_URL}/organizations`);
  if (!res.ok) throw new Error('Failed to list organizations');
  return res.json().then(d => d.organizations);
}

export async function getOrganization(orgId: string) {
  const res = await fetch(`${API_URL}/organizations/${orgId}`);
  if (!res.ok) throw new Error('Organization not found');
  return res.json().then(d => d.organization);
}

// --- Users ---

export async function createUser(params: {
  email: string;
  name?: string;
  orgId?: string;
}) {
  const res = await fetch(`${API_URL}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.email,
      name: params.name,
      org_id: params.orgId,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error ?? 'Failed to create user');
  }

  return res.json().then(d => d.user);
}

export async function listUsers(orgId?: string) {
  const url = new URL(`${API_URL}/users`);
  if (orgId) url.searchParams.set('org_id', orgId);

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error('Failed to list users');
  return res.json().then(d => d.users);
}

export async function getUser(userId: string) {
  const res = await fetch(`${API_URL}/users/${userId}`);
  if (!res.ok) throw new Error('User not found');
  return res.json().then(d => d.user);
}
