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
  Button: forwardRef<HTMLButtonElement, ControlButtonProps>(function ControlButton({ variant = 'outline', type = 'button', ...props }, ref) { return <button ref={ref} type={type} data-variant={variant} {...props} />; }),
  Input: forwardRef<HTMLInputElement, ComponentProps<'input'>>(function ControlInput(props, ref) { return <input ref={ref} {...props} />; }),
  Textarea: (props) => <textarea {...props} />,
  Select: ({ options, onValueChange, ...props }) => <select {...props} onChange={(event) => onValueChange(event.target.value)}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>,
};
