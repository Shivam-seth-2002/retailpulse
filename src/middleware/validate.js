const Joi = require('joi');
const ApiError = require('../utils/ApiError');

function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      return next(ApiError.validation('Validation failed', details));
    }

    // Replace the request object property with the validated value
    req[source] = value;
    next();
  };
}

module.exports = validate;
