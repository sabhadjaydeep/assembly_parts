import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PartType } from 'src/parts/parts-type.enum';

export type PartDocument = Part & Document;

export class Constituency {
    id: string;
    quantity: number;
}

@Schema({ timestamps: true })
export class Part {
    @Prop({ type: String })
    _id: string;

    @Prop({ required: true, unique: true })
    name: string;

    @Prop({ required: true, enum: PartType })
    type: PartType;

    @Prop({ type: [Constituency], default: [] })
    parts: Constituency[];
}

export const PartSchema = SchemaFactory.createForClass(Part);

PartSchema.virtual('id').get(function (this: any) {
    return this._id;
});
PartSchema.set('toJSON', { virtuals: true });
PartSchema.set('toObject', { virtuals: true });
