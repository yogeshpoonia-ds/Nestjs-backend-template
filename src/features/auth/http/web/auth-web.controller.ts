import { Controller } from '@nestjs/common';

/** Relative routes. WebApiModule mounts this module at /web/v1. */
@Controller('auth')
export class AuthWebController {}
