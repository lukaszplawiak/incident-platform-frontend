import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IncidentDetail } from './incident-detail';

describe('IncidentDetail', () => {
  let component: IncidentDetail;
  let fixture: ComponentFixture<IncidentDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncidentDetail],
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
