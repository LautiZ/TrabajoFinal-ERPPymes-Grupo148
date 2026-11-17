import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CategoryIdMessage,
  CreateCategoryDto,
  ERP_PATTERNS,
  ERP_SERVICE,
} from '@app/contracts';
import { sendRpc } from '../common/send-rpc';
import { CategoryResponseDto } from './dto/category-response.dto';

// No @Roles: every role operates the ERP without restrictions (RN-16.3)
@ApiTags('categories')
@ApiUnauthorizedResponse({ description: 'Missing or invalid token' })
@Controller('categories')
export class CategoriesController {
  constructor(@Inject(ERP_SERVICE) private readonly erpClient: ClientProxy) {}

  /** List active categories, sorted by name */
  @Get()
  @ApiOkResponse({ type: [CategoryResponseDto] })
  list() {
    return sendRpc<CategoryResponseDto[]>(
      this.erpClient,
      ERP_PATTERNS.LIST_CATEGORIES,
      {},
    );
  }

  /** Create a category */
  @Post()
  @ApiCreatedResponse({ type: CategoryResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid body' })
  @ApiConflictResponse({ description: 'Category name already exists' })
  create(@Body() dto: CreateCategoryDto) {
    return sendRpc<CategoryResponseDto, CreateCategoryDto>(
      this.erpClient,
      ERP_PATTERNS.CREATE_CATEGORY,
      dto,
    );
  }

  /** Logical delete; rejected while active products use the category. Its name can be reused afterwards */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Category deleted' })
  @ApiBadRequestResponse({ description: 'Invalid id' })
  @ApiNotFoundResponse({ description: 'Category not found or already deleted' })
  @ApiConflictResponse({ description: 'Category has active products' })
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await sendRpc<void, CategoryIdMessage>(
      this.erpClient,
      ERP_PATTERNS.DELETE_CATEGORY,
      { id },
    );
  }
}
