import { Controller } from '@nestjs/common';
import { ApiSurface } from '../../../auth/decorators/api-surface.decorator.js';

/** Relative routes. WebApiModule mounts this module at /web/v1. */
@ApiSurface('web')
@Controller('rbac')
export class RbacWebController {}
