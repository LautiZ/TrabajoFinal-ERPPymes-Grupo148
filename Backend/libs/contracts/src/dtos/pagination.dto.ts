import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page: number = 1;

  // Capped so a single request cannot pull the whole table
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit: number = 10;
}

// Same shape the frontend expects (core/models/pagination.model.ts)
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const paginate = <T>(
  data: T[],
  total: number,
  { page, limit }: PaginationDto,
): PaginatedResponse<T> => ({
  data,
  meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
});
