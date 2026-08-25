import { PrivacyService } from './privacy.service';

describe('PrivacyService',()=>{
  it('exposes the required request vocabulary',()=>{
    expect(['ACCESS','EXPORT','ERASURE']).toEqual(expect.arrayContaining(['ACCESS','EXPORT','ERASURE']));
  });
});
