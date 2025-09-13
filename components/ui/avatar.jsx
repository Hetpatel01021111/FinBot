'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const Avatar = React.forwardRef(({ className, src, alt, fallback, ...props }, ref) => {
  const [imgSrc, setImgSrc] = React.useState(src);
  const [error, setError] = React.useState(false);

  // Fallback to a default avatar if image fails to load
  const handleError = () => {
    setError(true);
    setImgSrc('/default-avatar.png');
  };

  // If we have a fallback and the image failed to load, show the fallback
  if (error && fallback) {
    return (
      <div
        className={cn(
          'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
          className
        )}
        {...props}
      >
        {fallback}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
        className
      )}
      {...props}
    >
      <Image
        src={imgSrc}
        alt={alt || 'User avatar'}
        fill
        className="object-cover"
        onError={handleError}
        unoptimized={process.env.NODE_ENV !== 'production'}
      />
    </div>
  );
});

Avatar.displayName = 'Avatar';

export { Avatar };
