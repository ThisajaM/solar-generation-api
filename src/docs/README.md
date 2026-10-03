# OpenAPI notes

The OpenAPI 3.0.3 document is defined in `openapi.js` and served as:

- Swagger UI: `/docs`
- Raw spec: `/openapi.json`

Use **Authorize** in Swagger UI and paste only the JWT token; Swagger adds `Bearer` automatically. Login returns it at `data.token`.
