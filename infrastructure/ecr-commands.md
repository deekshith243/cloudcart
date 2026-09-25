# ECR Commands

Set placeholders in your shell first:

```powershell
$AWS_REGION = '<AWS_REGION>'
$AWS_ACCOUNT_ID = '<AWS_ACCOUNT_ID>'
$IMAGE_TAG = '<IMAGE_TAG>'
$REGISTRY = "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"
```

Authenticate and create repositories:

```powershell
aws sts get-caller-identity
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $REGISTRY
aws ecr create-repository --repository-name cloudcart-backend --region $AWS_REGION
aws ecr create-repository --repository-name cloudcart-worker --region $AWS_REGION
aws ecr create-repository --repository-name cloudcart-frontend --region $AWS_REGION
```

Build, tag, and push:

```powershell
docker build -f backend/Dockerfile -t cloudcart-backend:$IMAGE_TAG backend
docker build -f worker/Dockerfile -t cloudcart-worker:$IMAGE_TAG worker
docker build -f frontend/Dockerfile -t cloudcart-frontend:$IMAGE_TAG frontend

docker tag cloudcart-backend:$IMAGE_TAG $REGISTRY/cloudcart-backend:$IMAGE_TAG
docker tag cloudcart-worker:$IMAGE_TAG $REGISTRY/cloudcart-worker:$IMAGE_TAG
docker tag cloudcart-frontend:$IMAGE_TAG $REGISTRY/cloudcart-frontend:$IMAGE_TAG

docker push $REGISTRY/cloudcart-backend:$IMAGE_TAG
docker push $REGISTRY/cloudcart-worker:$IMAGE_TAG
docker push $REGISTRY/cloudcart-frontend:$IMAGE_TAG
```

These commands require configured AWS CLI credentials and an AWS account. No account ID or image has been assumed by this repository.
