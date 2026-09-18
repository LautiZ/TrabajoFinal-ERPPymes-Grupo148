import * as Joi from 'joi';

export function validateEnvs<T>(
  schema: Joi.ObjectSchema<T>,
  env: NodeJS.ProcessEnv,
): T {
  const result = schema.validate(env, { allowUnknown: true });
  if (result.error) {
    throw new Error(`Config validation error: ${result.error.message}`);
  }
  return result.value;
}
