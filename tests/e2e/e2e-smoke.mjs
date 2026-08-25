/**
 * PHASE AG — real backend E2E smoke.
 *
 * Required flow:
 * Login → Organization → Person → Relationship → Meeting → Action →
 * Commitment → Follow-up
 *
 * This script is intentionally fail-fast. It is NOT a mock test and it does
 * not report PASS unless every request reaches the real configured API.
 *
 * Usage:
 *   API_URL=http://127.0.0.1:4000/api/v1 \
 *   E2E_USER_EMAIL=... E2E_USER_PASSWORD=... E2E_USER_ID=... \
 *   node tests/e2e/e2e-smoke.mjs
 */

const base = (process.env.API_URL || 'http://127.0.0.1:4000/api/v1').replace(/\/$/, '');
const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;
const userId = process.env.E2E_USER_ID;

if (!email || !password || !userId) {
  console.error('Missing E2E_USER_EMAIL, E2E_USER_PASSWORD or E2E_USER_ID');
  process.exit(2);
}

let token = '';
let organizationId = '';
let targetOrganizationId = '';
let personId = '';
let relationshipId = '';
let meetingId = '';
let actionId = '';
let commitmentId = '';

function unwrap(body, keys = []) {
  if (!body || typeof body !== 'object') return body;
  for (const key of keys) if (body[key]) return body[key];
  return body;
}

async function api(path, { method = 'GET', body, idempotency = true } = {}) {
  const headers = { accept: 'application/json' };
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (token) headers.authorization = `Bearer ${token}`;
  headers['x-request-id'] = crypto.randomUUID();
  headers['x-correlation-id'] = crypto.randomUUID();
  if (idempotency && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['idempotency-key'] = crypto.randomUUID() + crypto.randomUUID();
  }

  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let parsed;
  try { parsed = text ? JSON.parse(text) : undefined; } catch { parsed = text; }
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${typeof parsed === 'string' ? parsed : JSON.stringify(parsed)}`);
  }
  return parsed;
}

function idOf(value, keys = []) {
  const unwrapped = unwrap(value, keys);
  return unwrapped?.id || unwrapped?.data?.id || unwrapped?.entity?.id;
}

try {
  const login = await api('/auth/login', { method: 'POST', body: { email, password }, idempotency: false });
  token = login?.accessToken || login?.token;
  if (!token) throw new Error('Login succeeded but no accessToken/token was returned');
  console.log('PASS Login');

  const organization = await api('/organizations', {
    method: 'POST',
    body: { name: `AG E2E Organization ${Date.now()}` },
  });
  organizationId = idOf(organization, ['organization']);
  if (!organizationId) throw new Error('Organization ID missing');
  console.log('PASS Organization', organizationId);

  const target = await api('/organizations', {
    method: 'POST',
    body: { name: `AG E2E Target ${Date.now()}` },
  });
  targetOrganizationId = idOf(target, ['organization']);
  if (!targetOrganizationId) throw new Error('Target organization ID missing');
  console.log('PASS Target Organization', targetOrganizationId);

  const person = await api('/people', {
    method: 'POST',
    body: {
      firstName: 'AG',
      lastName: 'E2E Person',
      organizationId,
      email: `ag-${Date.now()}@example.test`,
    },
  });
  personId = idOf(person, ['person']);
  if (!personId) throw new Error('Person ID missing');
  console.log('PASS Person', personId);

  const relationship = await api('/relationships', {
    method: 'POST',
    body: {
      sourceOrganizationId: organizationId,
      targetOrganizationId,
      relationshipType: 'BUSINESS',
    },
  });
  relationshipId = idOf(relationship, ['relationship']);
  if (!relationshipId) throw new Error('Relationship ID missing');
  console.log('PASS Relationship', relationshipId);

  const startAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const endAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const meeting = await api('/meetings', {
    method: 'POST',
    body: {
      organizationId,
      relationshipId,
      title: 'AG E2E Meeting',
      startAt,
      endAt,
      participantPersonIds: [personId],
    },
  });
  meetingId = idOf(meeting, ['meeting']);
  if (!meetingId) throw new Error('Meeting ID missing');
  console.log('PASS Meeting', meetingId);

  const action = await api('/actions', {
    method: 'POST',
    body: {
      title: 'AG E2E Action',
      status: 'OPEN',
      ownerId: userId,
      relationshipId,
      meetingId,
      personId,
      organizationId,
    },
  });
  actionId = idOf(action, ['action']);
  if (!actionId) throw new Error('Action ID missing');
  console.log('PASS Action', actionId);

  const commitment = await api('/commitments', {
    method: 'POST',
    body: {
      title: 'AG E2E Commitment',
      description: 'Phase AG integration smoke commitment',
      status: 'OPEN',
      ownerId: userId,
      relationshipId,
      meetingId,
      organizationId,
      dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  });
  commitmentId = idOf(commitment, ['commitment']);
  if (!commitmentId) throw new Error('Commitment ID missing');
  console.log('PASS Commitment', commitmentId);

  const followUp = await api('/commitments/follow-up/due-soon?days=7');
  if (!followUp) throw new Error('Follow-up endpoint returned no response');
  console.log('PASS Follow-up');

  console.log(JSON.stringify({
    result: 'PASS',
    flow: ['Login', 'Organization', 'Person', 'Relationship', 'Meeting', 'Action', 'Commitment', 'Follow-up'],
    ids: { organizationId, targetOrganizationId, personId, relationshipId, meetingId, actionId, commitmentId },
  }, null, 2));
} catch (error) {
  console.error(`PHASE AG E2E FAILURE: ${error?.stack || error}`);
  process.exit(1);
}
