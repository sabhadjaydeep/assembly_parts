import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class AddQuantityDto {
    @IsInt()
    @Min(1)
    @ApiProperty({ default: 1 })
    quantity: number;
}
