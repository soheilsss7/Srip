/**
 * PHASE AD E2E suite. It is intentionally opt-in because it requires a real
 * deployed API plus seeded credentials. Run with RUN_E2E=1 and E2E_BASE_URL.
 * The test names are the canonical acceptance flow from the technical spec.
 */
const enabled = process.env.RUN_E2E === '1' && !!process.env.E2E_BASE_URL;
const describeE2E = enabled ? describe : describe.skip;

describeE2E('PHASE AD backend E2E acceptance flow', () => {
  const base = process.env.E2E_BASE_URL!;
  const email = process.env.E2E_USER_EMAIL!;
  const password = process.env.E2E_USER_PASSWORD!;
  let token = '';
  let organizationId = '';
  let personId = '';
  let targetOrganizationId = '';
  let relationshipId = '';
  let meetingId = '';
  let actionId = '';
  let commitmentId = '';

  async function api(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    headers.set('content-type', 'application/json');
    if (token) headers.set('authorization', `Bearer ${token}`);
    const response = await fetch(`${base}${path}`, { ...init, headers });
    const body = await response.json().catch(() => undefined);
    return { response, body };
  }

  it('Login', async () => {
    const r = await api('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    expect(r.response.ok).toBe(true);
    token = r.body?.accessToken ?? r.body?.token;
    expect(token).toBeTruthy();
  });

  it('Create Organization', async () => {
    const r = await api('/api/v1/organizations', { method: 'POST', body: JSON.stringify({ name: `AD E2E ${Date.now()}` }) });
    expect(r.response.ok).toBe(true);
    organizationId = r.body?.id ?? r.body?.organization?.id;
    expect(organizationId).toBeTruthy();
  });

  it('Create target Organization', async () => {
    const r = await api('/api/v1/organizations', { method: 'POST', body: JSON.stringify({ name: `AD E2E Target ${Date.now()}` }) });
    expect(r.response.ok).toBe(true);
    targetOrganizationId = r.body?.id ?? r.body?.organization?.id;
    expect(targetOrganizationId).toBeTruthy();
  });

  it('Create Person', async () => {
    const r = await api('/api/v1/people', { method: 'POST', body: JSON.stringify({ name: 'AD E2E Person', organizationId }) });
    expect(r.response.ok).toBe(true);
    personId = r.body?.id ?? r.body?.person?.id;
    expect(personId).toBeTruthy();
  });

  it('Create Relationship', async () => {
    const r = await api('/api/v1/relationships', { method: 'POST', body: JSON.stringify({ sourceOrganizationId: organizationId, targetOrganizationId }) });
    expect(r.response.ok).toBe(true);
    relationshipId = r.body?.id ?? r.body?.relationship?.id;
    expect(relationshipId).toBeTruthy();
  });

  it('Create Meeting', async () => {
    const r = await api('/api/v1/meetings', { method: 'POST', body: JSON.stringify({ organizationId, title: 'AD E2E Meeting', startAt: new Date(Date.now()+3600000).toISOString(), endAt: new Date(Date.now()+7200000).toISOString() }) });
    expect(r.response.ok).toBe(true);
    meetingId = r.body?.id ?? r.body?.meeting?.id;
    expect(meetingId).toBeTruthy();
  });

  it('Complete Meeting', async () => {
    const r = await api(`/api/v1/meetings/${meetingId}/complete`, { method: 'POST', body: JSON.stringify({}) });
    expect([200,201,204]).toContain(r.response.status);
  });

  it('Create Action', async () => {
    const r = await api('/api/v1/actions', { method: 'POST', body: JSON.stringify({ organizationId, title: 'AD E2E Action', ownerId: process.env.E2E_USER_ID }) });
    expect(r.response.ok).toBe(true);
    actionId = r.body?.id ?? r.body?.action?.id;
    expect(actionId).toBeTruthy();
  });

  it('Create Commitment', async () => {
    const r = await api('/api/v1/commitments', { method: 'POST', body: JSON.stringify({ organizationId, title: 'AD E2E Commitment', ownerId: process.env.E2E_USER_ID, dueAt: new Date(Date.now()+86400000).toISOString() }) });
    expect(r.response.ok).toBe(true);
    commitmentId = r.body?.id ?? r.body?.commitment?.id;
    expect(commitmentId).toBeTruthy();
  });

  it('Follow-up', async () => {
    const r = await api(`/api/v1/commitments/${commitmentId}`, { method: 'PATCH', body: JSON.stringify({ dueAt: new Date(Date.now()+172800000).toISOString() }) });
    expect(r.response.ok).toBe(true);
  });

  it('Recommendation', async () => {
    const r = await api('/api/v1/recommendations');
    expect(r.response.ok).toBe(true);
  });

  it('Permission Denial', async () => {
    const r = await api(`/api/v1/organizations/${process.env.E2E_FORBIDDEN_ORGANIZATION_ID}`);
    expect([403,404]).toContain(r.response.status);
  });
});
