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
  const [resolved, setResolved] = useState<{ key: string; url: string | null; failed: boolean }>({
    key: imageKey,
    url: null,
    failed: false,
  });

  useEffect(() => {
    let active = true;
    void resolveImageSource(productId, imageReference)
      .then((url) => {
        if (active) setResolved({ key: imageKey, url, failed: false });
      })
      .catch(() => {
        if (active) setResolved({ key: imageKey, url: null, failed: true });
      });
    return () => {
      active = false;
    };
  }, [productId, imageReference, imageKey]);

  const source = resolved.key === imageKey ? resolved.url : null;
  const failed = resolved.key === imageKey && resolved.failed;
  if (!source && !failed) return <span className="product-image-loading" aria-label="Loading product image" />;
  if (failed) {
    if (import.meta.env.DEV) console.warn(`Product image failed to load: ${productId}`);
    return fallback;
  }
  return (
    <img
      src={source ?? undefined}
      alt={alt}
      onError={(event) => {
        if (import.meta.env.DEV) console.warn(`Product image failed to load: ${event.currentTarget.src}`);
        setResolved({ key: imageKey, url: null, failed: true });
      }}
    />
  );
};
