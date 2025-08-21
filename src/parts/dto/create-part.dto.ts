import {
    ArrayNotEmpty,
    IsArray,
    IsEnum,
    IsNotEmpty,
    IsString,
    Min,
    ValidateNested,
    Validate,
    ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PartType } from 'src/parts/parts-type.enum';
import { IsPartsValidConstraint } from 'src/parts/validators/is-parts-valid.validator';

class ConstituencyDto {
    @ApiProperty({ description: 'ID of the part' })
    @IsString()
    @IsNotEmpty()
    id: string;

    @ApiProperty({ description: 'Quantity required', minimum: 1 })
    @Min(1)
    quantity: number;
}

export class CreatePartDto {
    @ApiProperty({ description: 'Name of the part' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({
        enum: PartType,
        example: PartType.RAW,
        description: 'Type of the part (RAW or ASSEMBLED)',
    })
    @IsEnum(PartType)
    type: PartType;

    @ApiPropertyOptional({
        description: 'Constituent parts (required if ASSEMBLED, forbidden if RAW)',
        type: [ConstituencyDto],
    })
    @Validate(IsPartsValidConstraint)
    @ValidateIf(o => o.parts !== null && o.parts !== undefined)
    @IsArray()
    @ArrayNotEmpty()
    @ValidateNested({ each: true })
    @Type(() => ConstituencyDto)
    parts?: ConstituencyDto[];
}