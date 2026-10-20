import { errorResponse } from '../utils/response.js';

export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }
      next();
    } catch (error) {
      if (error.errors) {
        const formattedErrors = error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message
        }));
        return errorResponse(res, 'Validation failed', 422, formattedErrors);
      }
      return errorResponse(res, 'Invalid request data: ' + error.message, 400);
    }
  };
};
