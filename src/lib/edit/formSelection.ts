import {
  PDFArray, PDFContext, PDFDict, PDFName, PDFObject, PDFPageLeaf,
  PDFPageTree, PDFRef, PDFStream, type PDFDocument,
} from 'pdf-lib';
import type { Widget } from '../Widget';

// Internal metadata shared by LoadedPage and the save walk, not a public seam.
export const loadedPageOrigins = new WeakMap<Widget, { source: PDFDocument; index: number }>();

export interface FormSelection {
  context: PDFContext;
  form: PDFDict;
  widgets: Map<number, PDFRef[]>;
}

export const formSelections = new WeakMap<PDFDocument, Map<PDFDocument, FormSelection>>();

export async function prepareFormSelections(output: PDFDocument, pages: readonly Widget[]): Promise<void> {
  const sources = new Map<PDFDocument, number[]>();
  for (const page of pages) {
    const origin = loadedPageOrigins.get(page);
    if (!origin) continue;
    const indices = sources.get(origin.source) ?? [];
    indices.push(origin.index);
    sources.set(origin.source, indices);
  }
  const formSources = [...sources].filter(([source]) => loadedForm(source));
  if (formSources.length > 1) {
    throw new Error('Cannot save pages from multiple loaded PDFs with AcroForms; merging loaded forms is not supported.');
  }
  const selections = new Map<PDFDocument, FormSelection>();
  for (const [source, indices] of sources) {
    if (loadedForm(source)) await source.flush();
    const selection = selectForm(source, indices);
    if (selection) selections.set(source, selection);
  }
  formSelections.set(output, selections);
}

const name = PDFName.of;
const get = (dict: PDFDict, key: string) => dict.get(name(key), true);
const unsupported = (reason: string): never => {
  throw new Error(`Cannot save selected pages from loaded PDF: unsupported AcroForm (${reason}).`);
};

/** An empty AcroForm must not replace a form registered by another source. */
export function loadedForm(source: PDFDocument): PDFObject | undefined {
  const raw = get(source.catalog, 'AcroForm');
  const form = source.context.lookup(raw);
  if (form instanceof PDFDict) {
    const fields = source.context.lookup(get(form, 'Fields'));
    if (fields instanceof PDFArray && fields.size() === 0 &&
        !['XFA', 'CO', 'SigFlags'].some((key) => get(form, key))) return;
  }
  return raw;
}

/** Build a read-only projection for the copier, before it can follow Kids or P. */
function selectForm(source: PDFDocument, indices: number[]): FormSelection | undefined {
  const rawForm = loadedForm(source);
  const pages = source.getPages();
  const selected = new Set(indices);
  if (rawForm && selected.size !== indices.length) unsupported('duplicate source page');
  if (selected.size === pages.length) return;

  const input = source.context;
  if (!rawForm) {
    for (const page of pages) {
      const annots = input.lookup(get(page.node, 'Annots'));
      if (!(annots instanceof PDFArray)) continue;
      for (const raw of annots.asArray()) {
        const annot = input.lookup(raw);
        if (annot instanceof PDFDict && get(annot, 'Subtype') === name('Widget')) {
          unsupported('unregistered widget');
        }
      }
    }
    return;
  }
  const form = input.lookup(rawForm);
  if (!(form instanceof PDFDict)) return unsupported('invalid form dictionary');
  if (['XFA', 'CO', 'SigFlags'].some((key) => get(form, key))) {
    unsupported('XFA, calculation order, or signatures');
  }
  const array = (raw: PDFObject | undefined): PDFArray => {
    const value = input.lookup(raw);
    return value instanceof PDFArray ? value : unsupported('expected an array');
  };
  const dictRef = (raw: PDFObject): [PDFRef, PDFDict] => {
    const value = input.lookup(raw);
    return raw instanceof PDFRef && value instanceof PDFDict
      ? [raw, value] : unsupported('expected an indirect dictionary');
  };
  const isWidget = (dict: PDFDict) => get(dict, 'Subtype') === name('Widget');
  const owners = new Map<PDFRef, number>();
  const seenWidgets = new Set<PDFRef>();
  const widgets = new Map<number, PDFRef[]>();
  pages.forEach((page, index) => {
    const annots = get(page.node, 'Annots');
    if (!annots) return;
    for (const raw of array(annots).asArray()) {
      const [ref, annot] = dictRef(raw);
      if (!isWidget(annot)) continue;
      const p = get(annot, 'P');
      if (owners.has(ref) || (p && p !== page.ref)) unsupported('ambiguous widget page');
      owners.set(ref, index);
    }
  });

  const context = PDFContext.create();
  for (const [ref, object] of input.enumerateIndirectObjects()) context.assign(ref, object);
  const blocked = new Set<PDFObject>([source.catalog]);
  const fields = context.obj([]);
  const seenFields = new Set<PDFRef>();
  const addWidget = (ref: PDFRef, widget: PDFDict, parent?: PDFRef): PDFDict | undefined => {
    const index = owners.get(ref);
    if (index === undefined) return unsupported('widget missing from page annotations');
    if (!isWidget(widget) || get(widget, 'Parent') !== parent || seenWidgets.has(ref) ||
        get(widget, 'AA') || get(widget, 'A')) unsupported('invalid or active widget');
    seenWidgets.add(ref);
    blocked.add(widget);
    if (!selected.has(index)) {
      blocked.add(ref);
      return;
    }
    const copy = widget.clone(context);
    copy.delete(name('P'));
    context.assign(ref, copy);
    const pageWidgets = widgets.get(index) ?? [];
    pageWidgets.push(ref);
    widgets.set(index, pageWidgets);
    return copy;
  };

  const rawFields = get(form, 'Fields');
  const originalFields = array(rawFields);
  blocked.add(originalFields);
  for (const raw of originalFields.asArray()) {
    const [ref, field] = dictRef(raw);
    const ft = get(field, 'FT');
    if (seenFields.has(ref) || get(field, 'Parent') || get(field, 'AA') ||
        !['Tx', 'Btn', 'Ch'].some((type) => ft === name(type))) {
      unsupported('expected flat terminal text, button, or choice fields');
    }
    seenFields.add(ref);
    blocked.add(field);
    const rawKids = get(field, 'Kids');
    if (isWidget(field)) {
      if (rawKids) unsupported('merged field/widget with children');
      if (addWidget(ref, field)) fields.push(ref);
    } else {
      const originalKids = array(rawKids);
      blocked.add(originalKids);
      const kids = context.obj([]);
      for (const rawKid of originalKids.asArray()) {
        const [kidRef, kid] = dictRef(rawKid);
        if (get(kid, 'Kids') || get(kid, 'FT') || get(kid, 'T') || get(kid, 'V') || get(kid, 'DV')) {
          unsupported('nested fields or mixed field/widget children');
        }
        if (addWidget(kidRef, kid, ref)) kids.push(kidRef);
      }
      if (kids.size()) {
        const copy = field.clone(context);
        copy.set(name('Kids'), kids);
        context.assign(ref, copy);
        fields.push(ref);
      } else {
        blocked.add(ref);
      }
    }
    if (blocked.has(ref)) {
      for (const key of ['V', 'DV', 'RV']) {
        const value = get(field, key);
        if (value instanceof PDFRef) blocked.add(value);
      }
    }
  }
  if (seenWidgets.size !== owners.size) unsupported('unregistered widget');

  const copy = form.clone(context);
  copy.set(name('Fields'), fields);
  blocked.add(form);
  if (rawForm instanceof PDFRef) context.assign(rawForm, copy);

  // The copier serializes every indirect object it visits, even if later
  // unlinked. Reject alternate paths into excluded objects before copying.
  const pending: PDFObject[] = [copy];
  for (const index of selected) {
    const node = pages[index].node;
    for (const [key, value] of node.entries()) {
      if (key !== name('Parent')) pending.push(value);
    }
    for (const key of PDFPageLeaf.InheritableEntries) {
      const value = node.getInheritableAttribute(name(key));
      if (value) pending.push(value);
    }
  }
  const visited = new Set<PDFObject>();
  while (pending.length) {
    const object = pending.pop()!;
    if (visited.has(object)) continue;
    visited.add(object);
    if (blocked.has(object) || object instanceof PDFPageLeaf || object instanceof PDFPageTree) {
      unsupported('reference into the original form or page tree');
    }
    if (object instanceof PDFRef) {
      const target = context.lookup(object);
      if (!target) return unsupported('dangling reference');
      pending.push(target);
    } else if (object instanceof PDFDict) {
      for (const [, value] of object.entries()) pending.push(value);
    } else if (object instanceof PDFArray) {
      for (const value of object.asArray()) pending.push(value);
    } else if (object instanceof PDFStream) {
      pending.push(object.dict);
    }
  }
  return { context, form: copy, widgets };
}
