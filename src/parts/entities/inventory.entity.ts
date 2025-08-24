import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type InventoryDocument = Inventory & Document;

@Schema()
export class Inventory {
    @Prop({ required: true })
    _id: string;

    @Prop({ required: true, default: 0, min: 0 })
    quantity: number;

    increase(amount: number) {
        this.quantity += amount;
    }

    decrease(amount: number) {
        if (this.quantity - amount < 0) {
            throw new Error('Not enough stock');
        }
        this.quantity -= amount;
    }
}

export const InventorySchema = SchemaFactory.createForClass(Inventory);

InventorySchema.virtual('id').get(function (this: any) {
    return this._id;
});
InventorySchema.set('toJSON', { virtuals: true });
InventorySchema.set('toObject', { virtuals: true });
