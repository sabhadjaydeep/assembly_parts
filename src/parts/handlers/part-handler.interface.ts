// handlers/part-handler.interface.ts
import { PartDocument } from '../entities/part.entity';
import { InventoryDocument } from '../entities/inventory.entity';
import { Model } from 'mongoose';

export interface PartHandler<TDto> {
    validate(dto: TDto, partModel: Model<PartDocument>): Promise<void>;
    create(dto: TDto, id: string, partModel: Model<PartDocument>): Promise<PartDocument>;
    addQuantity?(part: PartDocument, quantity: number, inventoryModel: Model<InventoryDocument>): Promise<void>;
}
