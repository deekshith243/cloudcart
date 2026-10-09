import { useEffect, useState, type ReactNode } from 'react';
import { resolveImageSource } from './image-utils';

export const ProductImage = ({
  productId,
  imageReference,
  alt,
  fallback,
}: {
  productId: string;
  imageReference: string | null;
  alt: string;
  fallback: ReactNode;
}) => {
  const imageKey = `${productId}:${imageReference ?? ''}`;
  const [resolved, setResolved] = useState<{ key: string; url: string | null }>({
    key: imageKey,
    url: null,
  });

  useEffect(() => {
    let active = true;
    void resolveImageSource(productId, imageReference)
      .then((url) => {
        if (active) setResolved({ key: imageKey, url });
      })
      .catch(() => {
        if (active) setResolved({ key: imageKey, url: null });
      });
    return () => {
      active = false;
    };
  }, [productId, imageReference, imageKey]);

  const source = resolved.key === imageKey ? resolved.url : null;
  return source ? <img src={source} alt={alt} /> : fallback;
};
