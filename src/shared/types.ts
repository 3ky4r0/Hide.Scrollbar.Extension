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

export interface TabInfo {
  id?: number;
  url?: string;
  title?: string;
}

