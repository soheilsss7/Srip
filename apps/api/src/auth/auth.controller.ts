import { Body, Controller, Post, Req, UseGuards, Get, Query } from '@nestjs/common';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { OidcService } from './oidc.service';
import { AuthGuard } from '../common/guards/auth.guard';

class AuthDto { @IsEmail() email!: string; @IsString() @MinLength(12) password!: string; @IsString() @IsOptional() otp?: string; }
class RegisterDto extends AuthDto { @IsString() @MinLength(2) name!: string; }
class ResetRequestDto { @IsEmail() email!: string; }
class ResetDto { @IsString() token!: string; @IsString() @MinLength(12) password!: string; }
class TokenDto { @IsString() token!: string; }

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly oidc: OidcService) {}
  @Get('oidc/:provider/authorize') oidcAuthorize(@Req() r: any, @Query('redirectUri') redirectUri?: string) { return this.oidc.authorize(r.params.provider, redirectUri ?? process.env.OIDC_DEFAULT_REDIRECT_URI ?? 'http://localhost:3000/auth/oidc/callback'); }
  @Post('oidc/:provider/callback') oidcCallback(@Req() r: any, @Body() b: any) { return this.oidc.callback(r.params.provider, b.code, b.state, { ip: r.ip, userAgent: r.headers['user-agent'] }); }
  @Post('oidc/complete') oidcComplete(@Body() b: any) { return this.oidc.complete(b.ticket, b.otp); }
  @Post('register') register(@Body() d: RegisterDto) { return this.auth.register(d.email, d.password, d.name); }
  @Post('login') login(@Body() d: AuthDto, @Req() r: any) { return this.auth.login(d.email, d.password, { ip: r.ip, userAgent: r.headers['user-agent'], otp: d.otp }); }
  @Post('refresh') refresh(@Body() d: TokenDto, @Req() r: any) { return this.auth.refresh(d.token, { ip: r.ip, userAgent: r.headers['user-agent'] }); }
  @Post('logout') logout(@Body() d: TokenDto) { return this.auth.logout(d.token); }
  @Post('password-reset/request') request(@Body() d: ResetRequestDto) { return this.auth.requestPasswordReset(d.email); }
  @Post('password-reset/confirm') confirm(@Body() d: ResetDto) { return this.auth.resetPassword(d.token, d.password); }
  @Post('email/verify') verifyEmail(@Body() d: TokenDto) { return this.auth.verifyEmail(d.token); }
  @UseGuards(AuthGuard)
  @Get('me')
  me(@Req() r: any) { return this.auth.me(r.user.sub); }
  @UseGuards(AuthGuard)
  @Post('email/resend') resendVerification(@Req() r: any) { return this.auth.resendVerification(r.user.sub); }
}
