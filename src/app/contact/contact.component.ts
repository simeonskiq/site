import { Component, OnInit, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import * as L from 'leaflet';

@Component({
  selector: 'app-contact',
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.css'],
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule]
})
export class ContactComponent implements OnInit, AfterViewInit {
  private map: L.Map | null = null;
  private marker: L.Marker | null = null;
  
  center = {
    lat: 42.6977,
    lng: 23.3219
  };
  
  contactInfo = {
    address: '123 Hotel Street, City, Country',
    phone: '+1 234 567 890',
    email: 'info@yourhotel.com'
  };

  selectedPosition = this.center;

  ngOnInit() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        this.center = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        this.selectedPosition = this.center;
        if (this.map) {
          this.map.setView([this.center.lat, this.center.lng], 15);
          this.updateMarker();
        }
      });
    }
  }

  ngAfterViewInit() {
    this.initMap();
  }

  private initMap() {
    this.map = L.map('map').setView([this.center.lat, this.center.lng], 15);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(this.map);

    this.marker = L.marker([this.center.lat, this.center.lng], {
      draggable: true
    }).addTo(this.map);

    this.marker.on('dragend', (event) => {
      const marker = event.target;
      const position = marker.getLatLng();
      this.selectedPosition = {
        lat: position.lat,
        lng: position.lng
      };
    });
  }

  private updateMarker() {
    if (this.marker && this.map) {
      this.marker.setLatLng([this.center.lat, this.center.lng]);
      this.map.setView([this.center.lat, this.center.lng], 15);
    }
  }
}
