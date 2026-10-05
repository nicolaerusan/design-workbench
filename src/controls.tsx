import { Button } from './ui/button.tsx';
import { Input } from './ui/input.tsx';
import { Textarea } from './ui/textarea.tsx';
import { Checkbox } from './ui/checkbox.tsx';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select.tsx';
import { forwardRef, type ComponentProps, type ComponentType, type ReactElement } from 'react';

export type ControlButtonProps = ComponentProps<'button'> & {
  variant?: 'default' | 'outline' | 'ghost';
};
export interface ControlSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  'aria-label': string;
}
/** Supply your own design-system primitives (for example shadcn/ui). */
export interface WorkbenchControls {
  Button: ComponentType<ControlButtonProps>;
  Input: ComponentType<ComponentProps<'input'>>;
  Textarea: ComponentType<ComponentProps<'textarea'>>;
  Select: ComponentType<ControlSelectProps>;
  Checkbox?: ComponentType<{ checked: boolean; onCheckedChange: (value: boolean | 'indeterminate') => void; 'aria-label': string }>;
  /** Optional host hover-card integration for lazy sidebar previews. */
  NavigationPreview?: ComponentType<NavigationPreviewProps>;
}
export interface NavigationPreviewProps {
  children: ReactElement;
  title: string;
  description: string;
  url: string;
  width: number;
  disabled?: boolean;
}
export const defaultControls: WorkbenchControls = {
  Button: forwardRef<HTMLButtonElement, ControlButtonProps>(function ControlButton({ variant = 'outline', type = 'button', ...props }, ref) { return <Button ref={ref} type={type} variant={variant} data-variant={variant} {...props} />; }),
  Input,
  Textarea,
  Checkbox,
  Select: ({ options, onValueChange, value, 'aria-label': label }) => <Select value={value} onValueChange={onValueChange}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent>{options.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>,
};
