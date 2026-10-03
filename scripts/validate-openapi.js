const SwaggerParser = require('@apidevtools/swagger-parser');
SwaggerParser.validate(require('../src/docs/openapi'))
  .then(() => console.log('OpenAPI 3 document and references validated.'))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
