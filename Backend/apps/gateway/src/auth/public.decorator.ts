import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Opt-out of the global AuthGuard: everything is protected unless marked
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
