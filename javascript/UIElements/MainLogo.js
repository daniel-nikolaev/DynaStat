import { Image } from '@aws-amplify/ui-react';

export const DefaultImageExample = () => {
  return (
    <Image
      alt="DynaStat Logo"
      src="/Pictures/Pictures/Dynastat.png"
      objectFit="initial"
      objectPosition="50% 50%"
      backgroundColor="initial"
      height="75%"
      width="75%"
      opacity="100%"
      onClick={() => alert('HEALTHCARE!!!')}
    />
  );
};

