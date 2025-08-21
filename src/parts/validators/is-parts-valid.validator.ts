import {
    ValidatorConstraint,
    ValidatorConstraintInterface,
    ValidationArguments,
} from 'class-validator';
import { PartType } from 'src/parts/parts-type.enum';
import { CreatePartDto } from 'src/parts/dto/create-part.dto';

@ValidatorConstraint({ async: false })
export class IsPartsValidConstraint implements ValidatorConstraintInterface {
    validate(parts: any, args: ValidationArguments) {
        const obj = args.object as CreatePartDto;

        if (obj.type === PartType.ASSEMBLED) {
            // Check if parts is undefined, null, or not an array.
            // Returning false will trigger the specific messages in defaultMessage.
            if (parts === undefined || parts === null || !Array.isArray(parts) || parts.length === 0) {
                return false;
            }
        }

        if (obj.type === PartType.RAW) {
            // Check if parts field is present and not an empty array
            if (parts !== undefined && parts !== null && Array.isArray(parts) && parts.length > 0) {
                return false;
            }
        }

        return true;
    }

    defaultMessage(args: ValidationArguments) {
        const obj = args.object as CreatePartDto;

        if (obj.type === PartType.ASSEMBLED) {
            const parts = args.value;
            if (parts === undefined || parts === null) {
                return 'The "parts" field is required when the type is ASSEMBLED.';
            }
            if (!Array.isArray(parts)) {
                return 'The "parts" field must be an array when the type is ASSEMBLED.';
            }
            if (parts.length === 0) {
                return 'The "parts" array cannot be empty when the type is ASSEMBLED.';
            }
        }

        if (obj.type === PartType.RAW) {
            return 'The "parts" field must not be provided when the type is RAW.';
        }

        return 'Invalid parts field.';
    }
}