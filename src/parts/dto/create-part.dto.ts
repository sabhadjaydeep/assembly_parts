import {
    ArrayNotEmpty,
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { PartType } from 'src/parts/parts-type.enum';

// ---------------- Constituency -----------------
class ConstituencyDto {
    @ApiProperty({ description: 'ID of the part' })
    @IsString()
    @IsNotEmpty()
    id: string;

    @ApiProperty({ description: 'Quantity required', minimum: 1 })
    @Min(1)
    quantity: number;
}

// ---------------- Base -----------------
export class BasePartDto {
    @ApiProperty({ description: 'Name of the part' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ enum: PartType })
    @IsEnum(PartType)
    type: PartType;
}

// ---------------- RAW -----------------
export class RawPartDto extends BasePartDto {
    @ApiProperty({ enum: [PartType.RAW], example: PartType.RAW })
    type: PartType.RAW;
}

// ---------------- ASSEMBLED -----------------
export class AssembledPartDto extends BasePartDto {
    @ApiProperty({ enum: [PartType.ASSEMBLED], example: PartType.ASSEMBLED })
    type: PartType.ASSEMBLED;

    @ApiProperty({
        description: 'Constituent parts (required if ASSEMBLED)',
        type: [ConstituencyDto],
    })
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => ConstituencyDto)
    parts: ConstituencyDto[];
}
