import type { PaginatedResponse } from '@app/contracts';

// `implements` only takes a type reference, not an indexed access type
type PageMeta = PaginatedResponse<unknown>['meta'];

// Swagger cannot document generics: each paginated route declares its own
// page class with a concrete `data` type and reuses this meta
export class PageMetaDto implements PageMeta {
  /** @example 42 */
  total!: number;
  /** @example 1 */
  page!: number;
  /** @example 10 */
  limit!: number;
  /** @example 5 */
  totalPages!: number;
}
