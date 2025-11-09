import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavBarComponent } from './nav-bar/nav-bar.component';
import { routeAnimations } from './animations';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavBarComponent],
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
