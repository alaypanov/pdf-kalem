export const justifyStart = 'flex-start' as const;
export const justifyCenter = 'center' as const;
export const justifyEnd = 'flex-end' as const;
export const justifyBetween = 'space-between' as const;
export const justifyAround = 'space-around' as const;
export const justifyEvenly = 'space-evenly' as const;

export const alignAuto = 'auto' as const;
export const alignStart = 'flex-start' as const;
export const alignCenter = 'center' as const;
export const alignEnd = 'flex-end' as const;
export const alignStretch = 'stretch' as const;

export const Justify = {
  FlexStart: justifyStart,
  Center: justifyCenter,
  FlexEnd: justifyEnd,
  SpaceBetween: justifyBetween,
  SpaceAround: justifyAround,
  SpaceEvenly: justifyEvenly,
} as const;

export const Align = {
  Auto: alignAuto,
  FlexStart: alignStart,
  Center: alignCenter,
  FlexEnd: alignEnd,
  Stretch: alignStretch,
} as const;

export type JustifyValue =
  | typeof justifyStart
  | typeof justifyCenter
  | typeof justifyEnd
  | typeof justifyBetween
  | typeof justifyAround
  | typeof justifyEvenly;

export type AlignValue =
  | typeof alignAuto
  | typeof alignStart
  | typeof alignCenter
  | typeof alignEnd
  | typeof alignStretch;

export const FlexAlignment = {
  justifyStart,
  justifyCenter,
  justifyEnd,
  justifyBetween,
  justifyAround,
  justifyEvenly,
  alignAuto,
  alignStart,
  alignCenter,
  alignEnd,
  alignStretch,
} as const;