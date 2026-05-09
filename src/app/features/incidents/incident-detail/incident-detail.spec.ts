import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { ComponentRef } from '@angular/core';
import { IncidentDetail } from './incident-detail';

describe('IncidentDetail', () => {
  let component: IncidentDetail;
  let fixture: ComponentFixture<IncidentDetail>;
  let componentRef: ComponentRef<IncidentDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncidentDetail],
      providers: [
        provideRouter([{ path: 'incidents', children: [] }]),
        provideHttpClient()
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentDetail);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;

    componentRef.setInput('id', 'test-incident-id');

    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});