

import Image from 'next/image';

interface LogoProps {
  className?: string;
}

export function Logo({ className }: LogoProps) {
  return (
    <Image
      src="/bus.png" // Path to your logo image in the `public` directory
      alt="Logo"
      width={120} // Set the desired width
      height={120} // Set the desired height
      className={className}
    />
  );
}

    