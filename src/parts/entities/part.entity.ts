import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { PartType } from '../parts-type.enum';

export type PartDocument = Part & Document;

export class Constituency {
    id: string;      // reference to Part._id
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

    isRaw(): boolean {
        return this.type === PartType.RAW;
    }

    isAssembled(): boolean {
        return this.type === PartType.ASSEMBLED;
    }
}

export const PartSchema = SchemaFactory.createForClass(Part);

PartSchema.virtual('id').get(function (this: any) {
    return this._id;
});
PartSchema.set('toJSON', { virtuals: true });
PartSchema.set('toObject', { virtuals: true });
