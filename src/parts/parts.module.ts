import { Module } from '@nestjs/common';
import { PartsService } from 'src/parts/parts.service';
import { PartsController } from 'src/parts/parts.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Part, PartSchema } from 'src/parts/entities/part.entity';
import { Inventory, InventorySchema } from 'src/parts/entities/inventory.entity';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Part.name, schema: PartSchema },
    { name: Inventory.name, schema: InventorySchema },
  ])],
  controllers: [PartsController],
  providers: [PartsService],
})
export class PartsModule { }
