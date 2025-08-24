// handlers/raw-part.handler.ts
import { PartHandler } from './part-handler.interface';
import { Part, PartDocument } from '../entities/part.entity';
import { Model } from 'mongoose';
import { InventoryDocument } from '../entities/inventory.entity';
import { RawPartDto } from '../dto/create-part.dto';

export class RawPartHandler implements PartHandler<RawPartDto> {
    async validate(dto: RawPartDto): Promise<void> {
        // nothing special for raw parts
    }

    async create(dto: RawPartDto, id: string, partModel: Model<PartDocument>): Promise<PartDocument> {
        const created = new partModel({
            _id: id,
            name: dto.name,
            type: dto.type,
            parts: [],
        });
        await created.save();
        return created;
    }

    async addQuantity(part: PartDocument, quantity: number, inventoryModel: Model<InventoryDocument>): Promise<void> {
        await inventoryModel.updateOne({ _id: part._id }, { $inc: { quantity } });
    }
}
