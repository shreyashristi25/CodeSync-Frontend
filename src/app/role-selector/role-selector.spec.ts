import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RoleSelectorComponent as RoleSelector } from './role-selector';

describe('RoleSelector', () => {
  let component: RoleSelector;
  let fixture: ComponentFixture<RoleSelector>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RoleSelector],
    }).compileComponents();

    fixture = TestBed.createComponent(RoleSelector);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
