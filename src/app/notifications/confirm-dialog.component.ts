import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConfirmDialogRequest, ConfirmDialogService } from './confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.css']
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  open = false;
  req: ConfirmDialogRequest | null = null;
  private sub: Subscription | null = null;

  constructor(private confirmDialogService: ConfirmDialogService) {}

  ngOnInit(): void {
    this.sub = this.confirmDialogService.requests$.subscribe((r) => {
      this.req = r;
      this.open = true;
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  cancel(): void {
    if (!this.req) return;
    const r = this.req;
    this.req = null;
    this.open = false;
    r.resolve(false);
  }

  confirm(): void {
    if (!this.req) return;
    const r = this.req;
    this.req = null;
    this.open = false;
    r.resolve(true);
  }
}


