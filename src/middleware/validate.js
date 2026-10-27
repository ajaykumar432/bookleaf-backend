/** Validates req[source] against a zod schema and replaces it with the parsed (coerced, stripped) value. */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const parsed = schema.safeParse(req[source]);
  if (!parsed.success) return next(parsed.error);
  req[source] = parsed.data;
  next();
};
