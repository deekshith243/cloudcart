import { catalogApi } from '../auth/api';

export const resolveImageSource = async (
  productId: string,
  imageReference: string | null,
): Promise<string | null> => {
  if (!imageReference) return null;
  if (!imageReference.startsWith('s3://')) return imageReference;
  const response = await catalogApi.getProductImageUrl(productId);
  return response.data.url;
};
