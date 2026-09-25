# AWS S3 Product Images

CloudCart stores product metadata in PostgreSQL and product image objects in S3. The admin-only `POST /api/v1/products/:id/image` endpoint accepts a multipart `image` field and allows JPEG, PNG, and WebP images up to 5 MB.

Object keys are generated as `products/<product-id>/<random-id>.<extension>`. Original filenames are never used as keys. The product `imageUrl` field stores an opaque `s3://bucket/key` reference; binary data is never stored in PostgreSQL.

When replacing an image, CloudCart uploads the new object, updates the database reference, invalidates catalog caches, and then deletes the old object. If the database update fails, it attempts to delete the new object. Product deletion cleans up its referenced object after the database deletion succeeds, without weakening the existing order-history foreign-key protection.

AWS configuration comes from `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY`. The SDK client is backend-only and no credentials are exposed to React. Missing configuration produces a safe `503` only when an upload is invoked; normal API startup and tests continue without AWS.

A production bucket should be private, encrypted, restricted by IAM, and accessed through controlled backend operations or signed URLs. AWS S3 has not been deployed by this project.
