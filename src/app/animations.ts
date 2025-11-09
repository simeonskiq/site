import { trigger, transition, style, query, animateChild, group, animate } from '@angular/animations';

export const routeAnimations = trigger('routeAnimations', [
  transition('* <=> *', [
    // Set a default style for enter and leave
    query(':enter, :leave', [
      style({
        position: 'relative',
        width: '100%',
        opacity: 0,
        transform: 'translateY(20px)'
      })
    ], { optional: true }),
    // Animate the new page in
    query(':enter', [
      animate('600ms cubic-bezier(0.4, 0, 0.2, 1)',
        style({ opacity: 1, transform: 'translateY(0)' })
      )
    ], { optional: true })
  ])
]);

export const fadeInUp = trigger('fadeInUp', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(30px)' }),
    animate('600ms cubic-bezier(0.4, 0, 0.2, 1)', 
      style({ opacity: 1, transform: 'translateY(0)' })
    )
  ])
]);

export const slideInLeft = trigger('slideInLeft', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(-50px)' }),
    animate('600ms cubic-bezier(0.4, 0, 0.2, 1)', 
      style({ opacity: 1, transform: 'translateX(0)' })
    )
  ])
]);

export const slideInRight = trigger('slideInRight', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateX(50px)' }),
    animate('600ms cubic-bezier(0.4, 0, 0.2, 1)', 
      style({ opacity: 1, transform: 'translateX(0)' })
    )
  ])
]);

export const scaleIn = trigger('scaleIn', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.8)' }),
    animate('500ms cubic-bezier(0.4, 0, 0.2, 1)', 
      style({ opacity: 1, transform: 'scale(1)' })
    )
  ])
]);

