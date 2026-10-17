import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';
import { MfaService } from './mfa.service';
@Controller('auth/mfa') @UseGuards(AuthGuard)
export class MfaController { constructor(private readonly mfa:MfaService){} @Post('enroll') enroll(@Req()r:any,@Body()b:any){return this.mfa.enroll(r.user.sub,b?.label)} @Post('verify-enrollment') verifyEnrollment(@Req()r:any,@Body()b:any){return this.mfa.verifyEnrollment(r.user.sub,b.deviceId,b.code)} @Post('verify') verify(@Req()r:any,@Body()b:any){return this.mfa.verify(r.user.sub,b.code).then(ok=>({verified:ok}))} @Get('required') required(@Req()r:any){return this.mfa.required(r.user.sub).then(required=>({required}))} }
