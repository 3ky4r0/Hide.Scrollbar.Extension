/**
 * Type definitions for Hide Scrollbar Extension
 */

export interface StorageData {
  enabled?: boolean;
  whitelist?: string[];
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
}

export interface TabInfo {
  id?: number;
  url?: string;
  title?: string;
}
