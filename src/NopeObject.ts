import { Validatable, Rule, ShapeErrors } from './types';
import { pathToArray, getFromPath } from './utils';

interface ObjectShape {
  [key: string]: Validatable<any> | NopeObject;
}

type ValidateOptions = {
  abortEarly: boolean;
};

class NopeObject {
  private objectShape: ObjectShape;
  private validationRules: Rule<Record<string | number, unknown>>[] = [];
  protected _type = 'object';

  public constructor(objectShape?: ObjectShape) {
    this.objectShape = objectShape || {};
  }

  public getType() {
    return this._type;
  }

  public shape(shape: ObjectShape) {
    Object.assign(this.objectShape, shape);

    return this;
  }

  public extend(Base: NopeObject) {
    Object.assign(this.objectShape, Base.objectShape);

    return this;
  }

  public noUnknown(message = 'Input contains invalid keys') {
    const rule: Rule<Record<string | number, unknown>> = (entry) => {
      let objectIsDefined = false;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for (const _ in this.objectShape) {
        objectIsDefined = true;
        break;
      }

      if (!objectIsDefined) {
        throw Error('noUnknown must be used with a schema');
      }

      let unknownKeys = false;

      for (const key in entry) {
        unknownKeys = unknownKeys || !(key in this.objectShape);
      }

      if (unknownKeys) {
        return message;
      }
    };

    this.validationRules.push(rule);

    return this;
  }

  public validate(
    entry: Record<string | number, any>,
    context?: Record<string | number, any> | undefined | null,
    options?: ValidateOptions,
  ) {
    for (const rule of this.validationRules) {
      const localErrors = rule(entry);

      if (localErrors) {
        return localErrors;
      }
    }

    const errors: ShapeErrors = {};
    let areErrors = false;
    const abortEarly = options?.abortEarly;

    for (const key in this.objectShape) {
      const rule = this.objectShape[key];

      const error = rule.validate(entry[key], { ...entry, ___parent: context }, options);

      if (error && (typeof error === 'string' || typeof error === 'object')) {
        areErrors = true;
        errors[key] = error as string;

        if (abortEarly) {
          return errors;
        }
      }
    }

    if (areErrors) {
      return errors;
    }

    return undefined;
  }

  public validateAt(path: string, entry: Record<string | number, any>) {
    const arrayPath = pathToArray(path);

    let validator: any = this.objectShape;

    for (const p of arrayPath) {
      if (!isNaN(parseInt(p, 10))) {
        continue;
      }

      if (validator[p]?.objectShape) {
        validator = validator[p].objectShape;
      } else if (validator[p]?.ofShape) {
        validator = validator[p].ofShape.objectShape || validator[p].ofShape;
      } else {
        validator = validator[p];
      }
    }

    const parentValue = getFromPath(path, entry, true);
    const value = getFromPath(path, entry);

    return validator.validate(value, parentValue);
  }
}

export default NopeObject;
