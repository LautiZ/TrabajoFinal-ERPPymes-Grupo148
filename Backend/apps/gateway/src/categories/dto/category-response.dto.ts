import type { CategoryView } from '@app/contracts';

export class CategoryResponseDto implements CategoryView {
  id!: string;
  /** @example Bebidas */
  name!: string;
  description!: string | null;
}
