import { useState, useEffect } from 'react';

interface CoverImageProps {
  src: string | undefined;
  alt?: string;
  className?: string;
  fallbackSrc?: string;
}

export function CoverImage({
  src,
  alt = 'Cover',
  className = '',
  fallbackSrc = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&q=80',
}: CoverImageProps) {
  const [currentSrc, setCurrentSrc] = useState<string>(fallbackSrc);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);

  useEffect(() => {
    if (!src) {
      setCurrentSrc(fallbackSrc);
      setIsLoading(false);
      setIsError(true);
      return;
    }

    setIsLoading(true);
    setIsError(false);

    const img = new Image();
    img.src = src;

    // Optional safety timeout for slow networks (5 seconds)
    const timeoutId = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      setCurrentSrc(fallbackSrc);
      setIsLoading(false);
      setIsError(true);
    }, 5000);

    img.onload = () => {
      clearTimeout(timeoutId);
      setCurrentSrc(src);
      setIsLoading(false);
      setIsError(false);
    };

    img.onerror = () => {
      clearTimeout(timeoutId);
      setCurrentSrc(fallbackSrc);
      setIsLoading(false);
      setIsError(true);
    };

    return () => {
      clearTimeout(timeoutId);
      img.onload = null;
      img.onerror = null;
    };
  }, [src, fallbackSrc]);

  return (
    <div className={`relative overflow-hidden bg-neutral-100 flex items-center justify-center ${className}`}>
      {/* Dynamic Background Skeleton/Blur */}
      {isLoading && (
        <div className="absolute inset-0 bg-neutral-100 dark:bg-neutral-800 animate-pulse flex items-center justify-center">
          <div className="w-1/3 h-1/3 rounded-full bg-neutral-300 dark:bg-neutral-700 animate-bounce" />
        </div>
      )}

      {/* Actual Image Element with graceful fade in transition */}
      <img
        src={currentSrc}
        alt={alt}
        referrerPolicy="no-referrer"
        className={`w-full h-full object-cover transition-all duration-300 ${
          isLoading ? 'opacity-0 scale-95 blur-sm' : 'opacity-100 scale-100 blur-0'
        }`}
      />
    </div>
  );
}
