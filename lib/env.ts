import { envSchema } from "../scripts/check-env";

/**
 * Validated environment object for server-side code.
 * Loads once and provides typed, validated environment values with defaults.
 */
export const env = envSchema.parse(process.env);
