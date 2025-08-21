import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Part, PartDocument } from 'src/parts/entities/part.entity';
import { Inventory, InventoryDocument } from 'src/parts/entities/inventory.entity';
import { CreatePartDto } from 'src/parts/dto/create-part.dto';
import slugify from 'slugify';
import { PartType } from 'src/parts/parts-type.enum';

@Injectable()
export class PartsService {
  private readonly logger = new Logger(PartsService.name);

  constructor(
    @InjectModel(Part.name) private readonly partModel: Model<PartDocument>,
    @InjectModel(Inventory.name) private readonly inventoryModel: Model<InventoryDocument>,
  ) { }

  private async generateId(name: string): Promise<string> {
    const base = slugify(name.trim(), { lower: true, strict: true });
    const count = await this.partModel.countDocuments({ _id: new RegExp(`^${base}-\\d+$`) });
    return `${base}-${count + 1}`;
  }


  async createPart(dto: CreatePartDto): Promise<PartDocument> {
    try {
      const existing = await this.partModel.findOne({ name: dto.name }).lean();
      if (existing) throw new HttpException(`Part with name ${dto.name} already exists`, HttpStatus.CONFLICT);

      const newId = await this.generateId(dto.name);

      if (dto.type === PartType.ASSEMBLED) {
        if (!dto.parts?.length) throw new HttpException('Assembled part must have constituents', HttpStatus.BAD_REQUEST);
        // Check for duplicate IDs
        const duplicates = dto.parts
          .map(p => p.id)
          .filter((id, i, arr) => arr.indexOf(id) !== i);
        if (duplicates.length) {
          throw new HttpException(
            `Duplicate part IDs found in constituents: ${[...new Set(duplicates)].join(', ')}`,
            HttpStatus.BAD_REQUEST
          );
        }
        const refIds = dto.parts.map(p => p.id);
        const found = await this.partModel.find({ _id: { $in: refIds } }).lean();
        if (found.length !== refIds.length) {
          const foundIds = found.map(f => f._id.toString());
          const missingIds = refIds.filter(id => !foundIds.includes(id));
          throw new HttpException(`Missing constituent parts: ${missingIds.join(', ')}`, HttpStatus.BAD_REQUEST);
        }

        await this.checkCircular(newId, dto.parts, new Set());
      }

      const created = new this.partModel({ _id: newId, name: dto.name, type: dto.type, parts: dto.parts ?? [] });
      await created.save();

      await this.inventoryModel.updateOne({ _id: newId }, { $setOnInsert: { quantity: 0 } }, { upsert: true });

      return created;
    } catch (error) {
      this.logger.error('Error creating part', error);
      throw error instanceof HttpException ? error : new HttpException(error.message || 'Error creating part', HttpStatus.BAD_REQUEST);
    }
  }

  async addQuantity(partId: string, quantity: number) {
    try {
      if (quantity <= 0) {
        throw new HttpException('Quantity must be > 0', HttpStatus.BAD_REQUEST);
      }

      // fetch part once
      const part = await this.partModel.findById(partId).lean();
      if (!part) throw new HttpException('Part not found', HttpStatus.NOT_FOUND);

      // check circular only for assembled
      if (part.type === PartType.ASSEMBLED) {
        await this.checkCircular(part._id.toString(), part.parts, new Set());
      }

      // RAW → just increment
      if (part.type === PartType.RAW) {
        await this.inventoryModel.updateOne(
          { _id: partId },
          { $inc: { quantity } }
        );
        return { status: 'SUCCESS' };
      }

      const plan = new Map<string, number>();
      await this.buildConsumptionPlan(partId, quantity, plan);

      // fetch all required inventories in one query
      const partIds = Array.from(plan.keys());
      const inventories = await this.inventoryModel
        .find({ _id: { $in: partIds } }, { quantity: 1 })
        .lean();

      const invMap = new Map(inventories.map(inv => [inv._id.toString(), inv]));

      // check sufficiency
      for (const [pid, reqQty] of plan.entries()) {
        const inv = invMap.get(pid);
        if (!inv || inv.quantity < reqQty) {
          throw new HttpException(
            `Insufficient quantity of part ${pid}. Required: ${reqQty}, Available: ${inv?.quantity ?? 0}`,
            HttpStatus.BAD_REQUEST
          );
        }
      }

      // bulk updates (consume raw + increment final)
      const bulkOps = [
        ...Array.from(plan.entries()).map(([pid, reqQty]) => ({
          updateOne: {
            filter: { _id: pid },
            update: { $inc: { quantity: -reqQty } }
          }
        })),
        {
          updateOne: {
            filter: { _id: partId },
            update: { $inc: { quantity } }
          }
        }
      ];

      await this.inventoryModel.bulkWrite(bulkOps);

      return { status: 'SUCCESS' };
    } catch (error) {
      this.logger.error('Error adding quantity', error);
      throw error instanceof HttpException
        ? error
        : new HttpException(error.message || 'Error updating quantity', HttpStatus.BAD_REQUEST);
    }
  }

  private async buildConsumptionPlan(assemblyId: string, needed: number, plan: Map<string, number>) {
    const assembly = await this.partModel.findById(assemblyId).lean();
    if (!assembly) throw new HttpException(`Part not found: ${assemblyId}`, HttpStatus.BAD_REQUEST);

    if (assembly.type === PartType.RAW) {
      plan.set(assemblyId, (plan.get(assemblyId) ?? 0) + needed);
      return;
    }

    for (const c of assembly.parts) {
      const childPart = await this.partModel.findById(c.id).lean();
      if (!childPart) throw new HttpException(`Child part not found: ${c.id}`, HttpStatus.BAD_REQUEST);

      const childNeeded = c.quantity * needed;
      plan.set(c.id, (plan.get(c.id) ?? 0) + childNeeded);
    }
  }


  private async checkCircular(
    rootId: string,
    children: { id: string; quantity: number }[],
    visited = new Set<string>()
  ): Promise<void> {
    const childIds = children.map(c => c.id).filter(id => !visited.has(id));
    if (!childIds.length) return;

    for (const id of childIds) {
      if (id === rootId) {
        throw new HttpException('Circular dependency detected', HttpStatus.BAD_REQUEST);
      }
      visited.add(id);
    }

    const childParts = await this.partModel.find(
      { _id: { $in: childIds } },
      { parts: 1 }
    ).lean();

    const nextChildren = childParts.flatMap(cp => cp.parts || []);
    if (nextChildren.length) {
      await this.checkCircular(rootId, nextChildren, visited);
    }
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
                  name: { $arrayElemAt: [{ $map: { input: { $filter: { input: '$partDetails', as: 'd', cond: { $eq: ['$$d._id', '$$p.id'] } } }, as: 'f', in: '$$f.name' } }, 0] }
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
