import { FileSecurityService } from './file-security.service';

describe('FileSecurityService',()=>{
  const service = new FileSecurityService({} as any, {} as any);
  it('accepts a valid PDF signature and MIME',()=>{
    const file={originalname:'contract.pdf',mimetype:'application/pdf',size:5,buffer:Buffer.from('%PDF-')};
    expect(service.validate(file).mimeType).toBe('application/pdf');
  });
  it('rejects extension/MIME mismatch',()=>{
    const file={originalname:'contract.exe',mimetype:'application/pdf',size:5,buffer:Buffer.from('%PDF-')};
    expect(()=>service.validate(file)).toThrow();
  });
  it('rejects oversized files',()=>{
    const file={originalname:'x.pdf',mimetype:'application/pdf',size:Number(process.env.FILE_MAX_BYTES||26214400)+1,buffer:Buffer.from('%PDF-')};
    expect(()=>service.validate(file)).toThrow();
  });
});
