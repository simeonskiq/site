import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface ConfirmDialogRequest {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  resolve: (result: boolean) => void;
}

@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
  private readonly requestSubject = new Subject<ConfirmDialogRequest>();
  readonly requests$ = this.requestSubject.asObservable();

  confirm(message: string, opts?: Partial<Omit<ConfirmDialogRequest, 'message' | 'resolve'>>): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      this.requestSubject.next({
        title: opts?.title ?? 'Confirm',
        message,
        confirmText: opts?.confirmText ?? 'Yes',
        cancelText: opts?.cancelText ?? 'Cancel',
        resolve
      });
    });
  }
}


