import { ComponentFixture, TestBed } from '@angular/core/testing';


import { BookingComponent } from './booking.component';

describe('BookingComponent', () => {
  let component: BookingComponent;
  let fixture: ComponentFixture<BookingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BookingComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should set minimum checkout date to day after checkin', () => {
    const checkinDate = new Date('2024-01-18');
    component.onCheckinDateChange(checkinDate);
    
    const expectedMinCheckout = new Date('2024-01-19');
    expect(component.minCheckoutDate?.getDate()).toBe(expectedMinCheckout.getDate());
  });

  it('should reset checkout date if it becomes invalid after checkin change', () => {
    const checkinDate = new Date('2024-01-18');
    component.checkoutDate = new Date('2024-01-18'); // Same day checkout
    
    component.onCheckinDateChange(checkinDate);
    expect(component.checkoutDate).toBeNull();
  });

  it('should prevent search with invalid date combination', () => {
    spyOn(window, 'alert');
    
    component.checkinDate = new Date('2024-01-18');
    component.checkoutDate = new Date('2024-01-18');
    
    component.searchRooms();
    
    expect(window.alert).toHaveBeenCalledWith('Check-out date must be at least one day after check-in date');
    expect(component.checkoutDate).toBeNull();
  });
});
