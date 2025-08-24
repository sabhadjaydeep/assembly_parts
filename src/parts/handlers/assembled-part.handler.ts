import { PartHandler } from './part-handler.interface';
import { PartDocument } from '../entities/part.entity';
import { Model } from 'mongoose';
import { InventoryDocument } from '../entities/inventory.entity';
import { HttpException, HttpStatus } from '@nestjs/common';
import { AssembledPartDto } from '../dto/create-part.dto';
import { PartType } from '../parts-type.enum';

export class AssembledPartHandler implements PartHandler<AssembledPartDto> {
    async validate(dto: AssembledPartDto, partModel: Model<PartDocument>): Promise<void> {
        if (!dto.parts?.length) {
            throw new HttpException('Assembled part must have constituents', HttpStatus.BAD_REQUEST);
        }

        // check duplicates
        const duplicates = dto.parts.map(p => p.id).filter((id, i, arr) => arr.indexOf(id) !== i);
        if (duplicates.length) {
            throw new HttpException(
                `Duplicate part IDs found: ${[...new Set(duplicates)].join(', ')}`,
                HttpStatus.BAD_REQUEST
            );
        }

        // check references exist
        const refIds = dto.parts.map(p => p.id);
        const found = await partModel.find({ _id: { $in: refIds } }).lean();
        if (found.length !== refIds.length) {
            const missing = refIds.filter(id => !found.find(f => f._id.toString() === id));
            throw new HttpException(`Missing constituent parts: ${missing.join(', ')}`, HttpStatus.BAD_REQUEST);
        }

        // check circular dependencies
        await this.checkCircular(dto.parts, partModel, dto.name);
    }

    async create(dto: AssembledPartDto, id: string, partModel: Model<PartDocument>): Promise<PartDocument> {
        const created = new partModel({
            _id: id,
            name: dto.name,
            type: dto.type,
            parts: dto.parts,
        });
        await created.save();
        return created;
    }

    async addQuantity(part: PartDocument, quantity: number, inventoryModel: Model<InventoryDocument>): Promise<void> {
        await this.checkCircular(part.parts, inventoryModel.db.model<PartDocument>('Part'), part.name, new Set(), part._id.toString());

        const plan = new Map<string, number>();
        await this.buildConsumptionPlan(part._id.toString(), quantity, plan, inventoryModel);

        // fetch all required inventories
        const partIds = Array.from(plan.keys());
        const inventories = await inventoryModel
            .find({ _id: { $in: partIds } }, { quantity: 1 })
            .lean();

        const invMap = new Map(inventories.map(inv => [inv._id.toString(), inv]));

        // check sufficiency
        for (const [pid, reqQty] of plan.entries()) {
            const inv = invMap.get(pid);
            if (!inv || inv.quantity < reqQty) {
                throw new HttpException(
                    `Insufficient quantity of part ${pid}. Required: ${reqQty}, Available: ${inv?.quantity ?? 0}`,
                    HttpStatus.BAD_REQUEST
                );
            }
        }

        // bulk updates
        const bulkOps = [
            ...Array.from(plan.entries()).map(([pid, reqQty]) => ({
                updateOne: {
                    filter: { _id: pid },
                    update: { $inc: { quantity: -reqQty } }
                }
            })),
            {
                updateOne: {
                    filter: { _id: part._id },
                    update: { $inc: { quantity } }
                }
            }
        ];

        await inventoryModel.bulkWrite(bulkOps);
    }


    private async buildConsumptionPlan(
        assemblyId: string,
        needed: number,
        plan: Map<string, number>,
        inventoryModel: Model<InventoryDocument>
    ) {
        const partModel = inventoryModel.db.model<PartDocument>('Part');
        const assembly = await partModel.findById(assemblyId).lean();
        if (!assembly) throw new HttpException(`Part not found: ${assemblyId}`, HttpStatus.BAD_REQUEST);

        if (assembly.type === PartType.RAW) {
            plan.set(assemblyId, (plan.get(assemblyId) ?? 0) + needed);
            return;
        }

        if (assembly.type === PartType.ASSEMBLED) {
            for (const c of assembly.parts) {
                plan.set(c.id, (plan.get(c.id) ?? 0) + (c.quantity * needed));
            }
        }
    }


    private async checkCircular(
        children: { id: string; quantity: number }[],
        partModel: Model<PartDocument>,
        rootName: string,
        visited = new Set<string>(),
        rootId?: string
    ): Promise<void> {
        const childIds = children.map(c => c.id).filter(id => !visited.has(id));
        if (!childIds.length) return;

        for (const id of childIds) {
            if (id === rootId) {
                throw new HttpException(`Circular dependency detected in ${rootName}`, HttpStatus.BAD_REQUEST);
            }
            visited.add(id);
        }

        const childParts = await partModel.find(
            { _id: { $in: childIds } },
            { parts: 1 }
        ).lean();

        const nextChildren = childParts.flatMap(cp => cp.parts || []);
        if (nextChildren.length) {
            await this.checkCircular(nextChildren, partModel, rootName, visited, rootId);
        }
    }
}
