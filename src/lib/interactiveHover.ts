export const subtleAccentOutlineHover = "hover:!bg-accent/10 hover:!text-warning hover:!border-warning/40";
export const subtleAccentSurfaceHover = "hover:bg-accent/10 hover:text-accent";
export const subtleAccentSurfaceFocus = "focus:bg-accent/10 focus:text-accent";
export const subtleAccentSurfaceOpen = "data-[state=open]:bg-accent/10 data-[state=open]:text-accent";

// Dropdown-specific interactions:
// - neutral trigger hover when collapsed
// - light orange hover for open list items
// - darker orange selected treatment with white text
export const dropdownTriggerNeutralHover = "hover:bg-background hover:text-foreground hover:border-input";
export const dropdownTriggerEmphasisBorder = "data-[state=open]:border-warning focus:border-warning";
export const dropdownItemHover =
  "data-[highlighted]:bg-accent/15 data-[highlighted]:text-foreground focus:bg-accent/15 focus:text-foreground";
export const dropdownItemOpen = "data-[state=open]:bg-accent/15 data-[state=open]:text-foreground";
export const dropdownItemSelected =
  "[&[data-state=checked]]:bg-warning [&[data-state=checked]]:text-warning-foreground [&[data-state=checked]]:font-medium [&[data-state=checked][data-highlighted]]:bg-warning [&[data-state=checked][data-highlighted]]:text-warning-foreground";
