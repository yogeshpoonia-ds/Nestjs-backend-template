import { Controller } from '@nestjs/common';

/** Relative routes. AdminApiModule mounts this module at /admin/v1. */
@Controller('auth')
export class AuthAdminController {}
