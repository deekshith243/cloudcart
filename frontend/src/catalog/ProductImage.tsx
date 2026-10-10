import { useEffect, useRef, useState, type ReactNode } from 'react';
import { resolveImageSource } from './image-utils';

const IMAGE_LOAD_TIMEOUT_MS = 10_000;

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
  const [resolved, setResolved] = useState<{
    key: string;
    url: string | null;
    status: 'loading' | 'ready' | 'failed';
  }>({
    key: imageKey,
    url: null,
    status: 'loading',
  });
  const imageLoadTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void resolveImageSource(productId, imageReference)
      .then((url) => {
        if (active) setResolved({ key: imageKey, url, status: url ? 'loading' : 'failed' });
      })
      .catch(() => {
        if (active) setResolved({ key: imageKey, url: null, status: 'failed' });
      });
    return () => {
      active = false;
    };
  }, [productId, imageReference, imageKey]);

  const isCurrent = resolved.key === imageKey;
  const source = isCurrent ? resolved.url : null;
  const status = isCurrent ? resolved.status : 'loading';

  useEffect(() => {
    if (imageLoadTimer.current !== null) {
      window.clearTimeout(imageLoadTimer.current);
      imageLoadTimer.current = null;
    }
    if (!source || status !== 'loading') return;

    imageLoadTimer.current = window.setTimeout(() => {
      if (import.meta.env.DEV) console.warn(`Product image timed out: ${productId}`);
      setResolved((current) =>
        current.key === imageKey ? { ...current, status: 'failed' } : current,
      );
    }, IMAGE_LOAD_TIMEOUT_MS);

    return () => {
      if (imageLoadTimer.current !== null) {
        window.clearTimeout(imageLoadTimer.current);
        imageLoadTimer.current = null;
      }
    };
  }, [imageKey, productId, source, status]);

  if (status === 'failed') {
    if (import.meta.env.DEV) console.warn(`Product image failed to load: ${productId}`);
    return fallback;
  }
  if (!source) {
    return <span className="product-image-loading" aria-label="Loading product image" />;
  }

  return (
    <>
      <img
        className={status === 'loading' ? 'product-image-pending' : undefined}
        src={source}
        alt={alt}
        onLoad={() => {
          if (imageLoadTimer.current !== null) {
            window.clearTimeout(imageLoadTimer.current);
            imageLoadTimer.current = null;
          }
          setResolved((current) =>
            current.key === imageKey ? { ...current, status: 'ready' } : current,
          );
        }}
        onError={(event) => {
          if (import.meta.env.DEV) {
            console.warn(`Product image failed to load: ${event.currentTarget.src}`);
          }
          setResolved((current) =>
            current.key === imageKey ? { ...current, status: 'failed' } : current,
          );
        }}
      />
      {status === 'loading' && (
        <span className="product-image-loading" aria-label="Loading product image" />
      )}
    </>
  );
};
