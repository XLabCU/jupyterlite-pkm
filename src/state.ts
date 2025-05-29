import { IDisposable } from '@lumino/disposable';
import { ISignal, Signal } from '@lumino/signaling';

/**
 * Shared state service for PKM extension
 */
export interface IPKMState {
  /**
   * Current markdown mode
   */
  markdownMode: 'edit' | 'preview';
  
  /**
   * Signal emitted when markdown mode changes
   */
  markdownModeChanged: ISignal<IPKMState, 'edit' | 'preview'>;
  
  /**
   * Set the markdown mode
   */
  setMarkdownMode(mode: 'edit' | 'preview'): void;
}

/**
 * Implementation of PKM state service
 */
export class PKMState implements IPKMState, IDisposable {
  private _markdownMode: 'edit' | 'preview' = 'edit';
  private _markdownModeChanged = new Signal<IPKMState, 'edit' | 'preview'>(this);
  private _isDisposed = false;

  get markdownMode(): 'edit' | 'preview' {
    return this._markdownMode;
  }

  get markdownModeChanged(): ISignal<IPKMState, 'edit' | 'preview'> {
    return this._markdownModeChanged;
  }

  setMarkdownMode(mode: 'edit' | 'preview'): void {
    if (this._markdownMode !== mode) {
      this._markdownMode = mode;
      this._markdownModeChanged.emit(mode);
    }
  }

  get isDisposed(): boolean {
    return this._isDisposed;
  }

  dispose(): void {
    if (this._isDisposed) {
      return;
    }
    this._isDisposed = true;
    Signal.clearData(this);
  }
}

// Create a singleton instance
export const pkmState = new PKMState();