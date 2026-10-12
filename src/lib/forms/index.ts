/**
 * Form widgets (`pdf-kalem/forms`): AcroForm fields placed by the widget tree.
 *
 * PDF-typed per ADR 0001 — these widgets narrow to {@link PdfFormSurface} at
 * render time instead of widening the backend-neutral `RenderContext`.
 */
export { TextField, TextFieldWidget, type TextFieldOptions } from './TextField';
export { CheckBox, CheckBoxWidget, type CheckBoxOptions } from './CheckBox';
export { Dropdown, DropdownWidget, type DropdownOptions } from './Dropdown';
export { RadioGroup, RadioGroupWidget, type RadioGroupOptions } from './RadioGroup';
export { Radio, RadioWidget, type RadioOptions } from './Radio';
export { Button, ButtonWidget, type ButtonOptions } from './Button';
export { Signature, SignatureWidget, type SignatureOptions } from './Signature';
export { isPdfFormSurface, type PdfFormSurface } from './surface';

// The base classes appear in public signatures only as types: like `Widget`,
// the abstract classes stay non-instantiable outside the package (B20).
export type {
  FormWidget,
  PlacedFormWidget,
  FormFieldOptions,
  FormFieldAppearance,
} from './FormWidget';
