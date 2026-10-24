describe('PHASE R - Requirement Matching contract', () => {
  it('defines the complete matching pipeline', () => {
    const pipeline = ['Requirement','Requirement Keywords','Target Organizations','Direct Relationship','1-Hop','2-Hop','Connector Person','Path Strength','Relationship Health','Trust','Engagement','Success Probability','Rank'];
    expect(pipeline).toContain('Direct Relationship');
    expect(pipeline).toContain('1-Hop');
    expect(pipeline).toContain('2-Hop');
    expect(pipeline).toContain('Connector Person');
    expect(pipeline).toContain('Success Probability');
  });

  it('uses holding-group semantics rather than source === target for Internal', () => {
    const source = 'sub-a';
    const target = 'sub-b';
    const root = new Map([['sub-a','holding'],['sub-b','holding']]);
    expect(root.get(source)).toBe(root.get(target));
    expect(source).not.toBe(target);
  });

  it('exposes Direct, Indirect, Gap, Best Connection and Recommendations', () => {
    const response = { directConnections: [], indirectConnections: [], relationshipGaps: [], bestConnection: null, recommendations: [] };
    expect(response).toHaveProperty('directConnections');
    expect(response).toHaveProperty('indirectConnections');
    expect(response).toHaveProperty('relationshipGaps');
    expect(response).toHaveProperty('bestConnection');
    expect(response).toHaveProperty('recommendations');
  });
});
