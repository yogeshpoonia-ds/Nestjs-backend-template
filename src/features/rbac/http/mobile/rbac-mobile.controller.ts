import { Controller } from '@nestjs/common';
import { ApiSurface } from '../../../auth/decorators/api-surface.decorator.js';

/** Relative routes. MobileApiModule mounts this module at /mobile/v1. */
@ApiSurface('mobile')
@Controller('rbac')
export class RbacMobileController {}
