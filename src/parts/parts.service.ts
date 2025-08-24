import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Part, PartDocument } from 'src/parts/entities/part.entity';
import { Inventory, InventoryDocument } from 'src/parts/entities/inventory.entity';
import slugify from 'slugify';
import { PartType } from 'src/parts/parts-type.enum';
import { AssembledPartDto, RawPartDto } from './dto/create-part.dto';
import { RawPartHandler } from './handlers/raw-part.handler';
import { AssembledPartHandler } from './handlers/assembled-part.handler';
import { PartHandler } from './handlers/part-handler.interface';

@Injectable()
export class PartsService {
  private readonly logger = new Logger(PartsService.name);

  private readonly handlers: Record<PartType, PartHandler<any>> = {
    [PartType.RAW]: new RawPartHandler(),
    [PartType.ASSEMBLED]: new AssembledPartHandler(),
  };

  constructor(
    @InjectModel(Part.name) private readonly partModel: Model<PartDocument>,
    @InjectModel(Inventory.name) private readonly inventoryModel: Model<InventoryDocument>,
  ) { }

  private async generateId(name: string): Promise<string> {
    const base = slugify(name.trim(), { lower: true, strict: true });
    const count = await this.partModel.countDocuments({ _id: new RegExp(`^${base}-\\d+$`) });
    return `${base}-${count + 1}`;
  }

  async createPart(dto: RawPartDto | AssembledPartDto): Promise<PartDocument> {
    const existing = await this.partModel.findOne({ name: dto.name }).lean();
    if (existing) {
      throw new HttpException(`Part with name ${dto.name} already exists`, HttpStatus.CONFLICT);
    }

    const newId = await this.generateId(dto.name);
    const handler = this.handlers[dto.type];
    if (!handler) throw new HttpException('Unsupported part type', HttpStatus.BAD_REQUEST);

    await handler.validate(dto, this.partModel);
    const created = await handler.create(dto, newId, this.partModel);

    await this.inventoryModel.updateOne(
      { _id: newId },
      { $setOnInsert: { quantity: 0 } },
      { upsert: true },
    );

    return created;
  }

  async addQuantity(partId: string, quantity: number) {
    if (quantity <= 0) {
      throw new HttpException('Quantity must be > 0', HttpStatus.BAD_REQUEST);
    }

    const part = await this.partModel.findById(partId).lean();
    if (!part) throw new HttpException('Part not found', HttpStatus.NOT_FOUND);

    const handler = this.handlers[part.type];
    if (!handler?.addQuantity) {
      throw new HttpException('Add quantity not supported for this type', HttpStatus.BAD_REQUEST);
    }

    await handler.addQuantity(part, quantity, this.inventoryModel);
    return { status: 'SUCCESS' };
  }

  async getPartsWithQuantity(page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;
      const results = await this.partModel.aggregate([
        {
          $lookup: { from: 'inventories', localField: '_id', foreignField: '_id', as: 'inventory' }
        },
        { $addFields: { quantity: { $ifNull: [{ $arrayElemAt: ['$inventory.quantity', 0] }, 0] } } },
        {
          $lookup: { from: 'parts', localField: 'parts.id', foreignField: '_id', as: 'partDetails' }
        },
        {
          $addFields: {
            parts: {
              $map: {
                input: '$parts',
                as: 'p',
                in: {
                  id: '$$p.id',
                  quantity: '$$p.quantity',
                  name: {
                    $arrayElemAt: [
                      {
                        $map: {
                          input: {
                            $filter: {
                              input: '$partDetails',
                              as: 'd',
                              cond: { $eq: ['$$d._id', '$$p.id'] }
                            }
                          },
                          as: 'f',
                          in: '$$f.name'
                        }
                      },
                      0
                    ]
                  }
                }
              }
            }
          }
        },
        { $project: { _id: 1, name: 1, type: 1, quantity: 1, parts: 1 } },
        { $skip: skip },
        { $limit: limit }
      ]);

      const total = await this.partModel.countDocuments();
      return { page, limit, total, data: results };
    } catch (error) {
      this.logger.error('Error fetching parts', error);
      throw new HttpException(error.message || 'Error fetching parts', HttpStatus.BAD_REQUEST);
    }
  }
}
