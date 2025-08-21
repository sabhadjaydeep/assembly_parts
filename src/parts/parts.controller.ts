import { Body, Controller, Get, HttpException, HttpStatus, Param, Patch, Post, Query, Logger } from '@nestjs/common';
import { PartsService } from 'src/parts/parts.service';
import { CreatePartDto } from 'src/parts/dto/create-part.dto';
import { AddQuantityDto } from 'src/parts/dto/add-quantity.dto';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Part')
@Controller('part')
export class PartsController {
  private readonly logger = new Logger(PartsController.name);

  constructor(private readonly partsService: PartsService) { }

  @Post()
  @ApiOperation({ summary: 'Create raw or assembled part' })
  @ApiBody({ type: CreatePartDto })
  @ApiResponse({ status: 201, description: 'Part created successfully' })
  async createPart(@Body() dto: CreatePartDto) {
    try {
      const created = await this.partsService.createPart(dto);
      return {
        data: {
          id: created._id,
          name: created.name,
          type: created.type,
          parts: created.parts ?? [],
        },
        message: 'Part created successfully',
        statusCode: HttpStatus.CREATED,
      };
    } catch (error) {
      this.logger.error('Error creating part', error);
      return {
        data: null,
        message: error.message || 'Error creating part',
        statusCode: error.status || HttpStatus.BAD_REQUEST,
      };
    }
  }

  @Post(':id')
  @ApiOperation({ summary: 'Add quantity to a part' })
  @ApiBody({ type: AddQuantityDto })
  @ApiResponse({ status: 200, description: 'Quantity updated successfully' })
  async addQuantity(@Param('id') partId: string, @Body() dto: AddQuantityDto) {
    try {
      const res = await this.partsService.addQuantity(partId, dto.quantity);
      return {
        data: res.status,
        message: 'Quantity updated successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      this.logger.error(`Error adding quantity to part ${partId}`, error);
      return {
        data: null,
        message: error.message || 'Error updating quantity',
        statusCode: error.status || HttpStatus.BAD_REQUEST,
      };
    }
  }

  @Get('quantities')
  @ApiQuery({ name: 'page', required: true, type: Number })
  @ApiQuery({ name: 'limit', required: true, type: Number })
  @ApiResponse({ status: 200, description: 'Parts fetched successfully' })
  async getQuantities(@Query('page') page = 1, @Query('limit') limit = 10) {
    try {
      const res = await this.partsService.getPartsWithQuantity(Number(page), Number(limit));
      return {
        data: res.data,
        count: res.total,
        message: 'Parts fetched successfully',
        statusCode: HttpStatus.OK,
      };
    } catch (error) {
      this.logger.error('Error fetching parts', error);
      return {
        data: null,
        message: error.message || 'Error fetching parts',
        statusCode: error.status || HttpStatus.BAD_REQUEST,
      };
    }
  }
}
