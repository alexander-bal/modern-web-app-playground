import { describe, expect, it } from 'vitest';
import { CONSTRAINTS, PostgresErrorCode, type PostgresError } from './database-errors.js';
import { transformDatabaseError, ValidationError } from './error-transformers.js';

function pgError(code: string, fields: Partial<PostgresError> = {}): PostgresError {
  return Object.assign(new Error(fields.message ?? 'postgres failure'), { code }, fields);
}

describe('ValidationError', () => {
  it('carries the message and details it was constructed with', () => {
    const error = new ValidationError('Bad input', { field: 'email' });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('Bad input');
    expect(error.details).toEqual({ field: 'email' });
  });

  it('leaves details undefined when none is supplied', () => {
    expect(new ValidationError('Bad input').details).toBeUndefined();
  });
});

describe('transformDatabaseError', () => {
  it.each([
    ['a plain Error', new Error('nope')],
    ['a string', 'nope'],
    ['null', null],
    ['undefined', undefined],
    ['an object with a non-string code', { code: 23505 }],
  ])('returns null for %s', (_label, input) => {
    expect(transformDatabaseError(input)).toBeNull();
  });

  it('unwraps a postgres error nested in the cause chain', () => {
    const wrapped = new Error('query failed', {
      cause: pgError(PostgresErrorCode.UNIQUE_VIOLATION, {
        constraint_name: CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE,
      }),
    });

    expect(transformDatabaseError(wrapped)).toMatchObject({
      message: 'Duplicate order number',
      details: 'An order with this number already exists',
    });
  });

  describe('foreign key violations', () => {
    it('falls back to a generic reference message for an unmapped constraint', () => {
      const result = transformDatabaseError(
        pgError(PostgresErrorCode.FOREIGN_KEY_VIOLATION, {
          constraint_name: 'orders_user_id_foreign',
        })
      );

      expect(result).toBeInstanceOf(ValidationError);
      expect(result).toMatchObject({
        message: 'Invalid reference',
        details: 'Referenced entity does not exist',
      });
    });

    it('falls back to a generic reference message when no constraint is named', () => {
      expect(
        transformDatabaseError(pgError(PostgresErrorCode.FOREIGN_KEY_VIOLATION))
      ).toMatchObject({ message: 'Invalid reference' });
    });
  });

  describe('unique violations', () => {
    it('maps a known constraint to its user-facing message', () => {
      expect(
        transformDatabaseError(
          pgError(PostgresErrorCode.UNIQUE_VIOLATION, {
            constraint_name: CONSTRAINTS.ORDERS_ORDER_NUMBER_UNIQUE,
          })
        )
      ).toMatchObject({
        message: 'Duplicate order number',
        details: 'An order with this number already exists',
      });
    });

    it('falls back to a generic duplicate message for an unmapped constraint', () => {
      expect(
        transformDatabaseError(
          pgError(PostgresErrorCode.UNIQUE_VIOLATION, {
            constraint_name: 'users_email_unique',
          })
        )
      ).toMatchObject({ message: 'Duplicate value', details: 'This value already exists' });
    });

    it('falls back to a generic duplicate message when no constraint is named', () => {
      expect(transformDatabaseError(pgError(PostgresErrorCode.UNIQUE_VIOLATION))).toMatchObject({
        message: 'Duplicate value',
      });
    });
  });

  describe('not-null violations', () => {
    it('names the offending column in the details', () => {
      expect(
        transformDatabaseError(
          pgError(PostgresErrorCode.NOT_NULL_VIOLATION, {
            column_name: 'total_amount',
          })
        )
      ).toMatchObject({
        message: 'Missing required field',
        details: "Field 'total_amount' is required and cannot be null",
      });
    });

    it("reports the column as 'unknown' when the driver omits it", () => {
      expect(transformDatabaseError(pgError(PostgresErrorCode.NOT_NULL_VIOLATION))).toMatchObject({
        details: "Field 'unknown' is required and cannot be null",
      });
    });
  });

  describe('check violations', () => {
    it('maps a known constraint to its user-facing message', () => {
      expect(
        transformDatabaseError(
          pgError(PostgresErrorCode.CHECK_VIOLATION, {
            constraint_name: CONSTRAINTS.ORDERS_STATUS_CHECK,
          })
        )
      ).toMatchObject({
        message: 'Invalid order status',
        details:
          'Status must be one of: draft, confirmed, processing, shipped, fulfilled, paid, cancelled, cart',
      });
    });

    it('falls back to a generic invalid-value message for an unmapped constraint', () => {
      expect(
        transformDatabaseError(
          pgError(PostgresErrorCode.CHECK_VIOLATION, {
            constraint_name: 'orders_currency_check',
          })
        )
      ).toMatchObject({
        message: 'Invalid value',
        details: 'Value does not meet validation requirements',
      });
    });

    it('falls back to a generic invalid-value message when no constraint is named', () => {
      expect(transformDatabaseError(pgError(PostgresErrorCode.CHECK_VIOLATION))).toMatchObject({
        message: 'Invalid value',
      });
    });
  });

  it('reports an unrecognized postgres code as a generic database failure', () => {
    expect(
      transformDatabaseError(pgError('42P01', { message: 'relation does not exist' }))
    ).toMatchObject({
      message: 'Database operation failed',
      details: 'Database error: relation does not exist',
    });
  });
});
