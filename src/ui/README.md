# UI source
Source-copied shadcn/ui New York components from https://ui.shadcn.com/r/styles/new-york/ (2026-10-05), under the adjacent MIT license. Kbd/KbdGroup use the new-york-v4/kbd registry source, adapted to the same namespaced styles.

Local adaptations replace Tailwind utility lists with namespaced db-* classes in ../ui.css. This preserves the Radix behavior, component APIs, refs, and Lucide icons while allowing Design Bench to ship ordinary CSS without requiring consumers to configure Tailwind or applying global resets to host apps.

Resizable uses the compatible react-resizable-panels 3.x API from this registry. Components are owned and editable here. Host WorkbenchControls adapters remain supported.
