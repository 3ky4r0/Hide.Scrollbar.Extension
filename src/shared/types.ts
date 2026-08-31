/**
 * Type definitions for Hide Scrollbar Extension
 */

export type ThemeMode = 'system' | 'light' | 'dark';

export interface StorageData {
  scrollbarHidden?: boolean;
  whitelist?: string[];
  theme?: ThemeMode;
}

export type StorageChangeHandler = (
  changes: { [key: string]: chrome.storage.StorageChange },
  areaName: string
) => void;

export type RulerMode = 'selection' | 'inspect';

export interface SelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResizeStartState extends SelectionRect {
  mx: number;
  my: number;
}

export interface CornerPosition {
  bottom?: string;
  left?: string;
  top?: string;
  right?: string;
  transform?: string;
}

export interface TabInfo {
  id?: number;
  url?: string;
  title?: string;
}

export type DrawToolMode = 'pen' | 'highlighter' | 'rect' | 'circle' | 'arrow' | 'line' | 'text' | 'eraser';

export interface DrawPoint {
  x: number;
  y: number;
}

export interface DrawStroke {
  tool: DrawToolMode;
  color: string;
  size: number;
  opacity: number;
  points?: DrawPoint[];
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  endX?: number;
  endY?: number;
}

