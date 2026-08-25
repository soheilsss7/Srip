export type IntegrationProviderName='GOOGLE'|'MICROSOFT';
export type IntegrationKind='CALENDAR'|'EMAIL'|'DRIVE'|'TEAMS'|'SHAREPOINT';
export interface TokenSet{accessToken:string;refreshToken?:string;expiresAt?:Date;scope?:string}
export interface ExternalEvent{externalId:string;kind:IntegrationKind;title?:string;subject?:string;startsAt?:string;endsAt?:string;attendees?:string[];sender?:string;recipients?:string[];threadId?:string;updatedAt?:string;etag?:string;cancelled?:boolean;meetingUrl?:string;location?:string;raw?:unknown}
export interface IntegrationProviderPort{readonly provider:IntegrationProviderName;buildAuthorizeUrl(kind:IntegrationKind,state:string,redirectUri:string):string;exchangeCode(kind:IntegrationKind,code:string,redirectUri:string):Promise<TokenSet>;refresh?(refreshToken:string):Promise<TokenSet>;pull(kind:IntegrationKind,token:string,cursor?:string):Promise<{events:ExternalEvent[];nextCursor?:string}>}
