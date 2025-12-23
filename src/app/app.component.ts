import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavBarComponent } from './nav-bar/nav-bar.component';
import { routeAnimations } from './animations';
import { SiteNoticeComponent } from './site-notice/site-notice.component';
import { ToastContainerComponent } from './notifications/toast-container.component';
import { ConfirmDialogComponent } from './notifications/confirm-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavBarComponent, SiteNoticeComponent, ToastContainerComponent, ConfirmDialogComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  animations: [routeAnimations]
})
export class AppComponent {
  title = 'Aurora Hotel';

  prepareRoute(outlet: RouterOutlet) {
    return outlet?.activatedRouteData?.['animation'] || 'HomePage';
  }
}
