import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Staff } from './entities/staff.entity';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    @InjectRepository(Staff) private readonly staff: Repository<Staff>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    if (process.env.NODE_ENV === 'development' && process.env.AUTH_MODE === 'dev') {
      request.user = { sub: 'local-admin', email: 'admin@example.com', role: 'admin' };
      return true;
    }
    const token = request.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) throw new UnauthorizedException('Sign in to continue');
    try {
      const claims = await this.jwt.verifyAsync(token);
      const staff = await this.staff.findOne({ where: { id: claims.sub }, relations: { team: true } });
      if (!staff) throw new UnauthorizedException('Staff account is no longer active');
      if ((claims.sessionVersion ?? 0) !== staff.sessionVersion) throw new UnauthorizedException('Session expired');
      request.user = { sub: staff.id, id: staff.id, email: staff.email, role: staff.role, teamId: staff.teamId, isTeamLead: staff.isTeamLead, mustChangePassword: staff.mustChangePassword };
      if (staff.mustChangePassword && !request.path.endsWith('/auth/password') && !request.path.endsWith('/auth/me'))
        throw new UnauthorizedException('Change your temporary password before continuing');
      return true;
    } catch {
      throw new UnauthorizedException('Session expired');
    }
  }
}
