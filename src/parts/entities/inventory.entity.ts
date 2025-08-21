import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InventoryDocument = Inventory & Document;

@Schema({ _id: false, id: false })
export class Inventory {
    @Prop({ required: true, })
    _id: string;

    @Prop({ required: true, default: 0, min: 0 })
    quantity: number;
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);

InventorySchema.virtual('id').get(function (this: any) {
    return this._id;
});
InventorySchema.set('toJSON', { virtuals: true });
InventorySchema.set('toObject', { virtuals: true });
