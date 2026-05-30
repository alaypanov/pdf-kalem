export enum PageSize {
  A4 = 'A4',
  A3 = 'A3',
  A5 = 'A5',
  LETTER = 'LETTER',
}

export const PDFDocSize = {
  A4: [595, 842], // A4 size in points
  A3: [842, 1191], // A3 size in points
  A5: [420, 595], // A5 size in points
  LETTER: [612, 792], // Letter size in points,
}; // Use 'as const' for type safety