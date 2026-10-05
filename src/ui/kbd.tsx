// Adapted from shadcn/ui (MIT), new-york-v4/kbd. Namespaced styles for embedding.
import type { ComponentProps } from 'react';
import { cn } from './utils.ts';

function Kbd({ className, ...props }: ComponentProps<'kbd'>) {
  return <kbd data-slot="kbd" className={cn('db-kbd', className)} {...props} />;
}
function KbdGroup({ className, ...props }: ComponentProps<'kbd'>) {
  return <kbd data-slot="kbd-group" className={cn('db-kbd-group', className)} {...props} />;
}
export { Kbd, KbdGroup };
