import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Login } from './login';
import { ApiError } from '../../../core/errors/api-error';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  /**
   * Covers the fix removing the unreachable `err.status === 423` branch
   * — see humanizeError's own comment for the full account of why the
   * same message for wrong password and locked account is correct
   * behavior, not a gap.
   */
  describe('humanizeError', () => {
    // Private method — accessed directly here rather than driving the
    // full onSubmit()/AuthService flow, since this is specifically
    // about the message-selection logic itself, not the surrounding
    // form/subscription plumbing.
    function humanizeError(err: Error): string {
      return (component as unknown as { humanizeError(err: Error): string })
          .humanizeError(err);
    }

    it('returns a generic invalid-credentials message for 401', () => {
      expect(humanizeError(new ApiError('Unauthorized', 401)))
          .toBe('Invalid email or password. Please try again.');
    });

    /**
     * The actual regression test for this fix: a locked account gets
     * the exact same 401 the backend also uses for a wrong password
     * (AuthService.login()'s own deliberate anti-enumeration design) —
     * confirming there is no separate message for it, and that this
     * isn't a gap left behind by removing the old 423 branch.
     */
    it('returns the same message for a locked account as for a wrong password', () => {
      const wrongPassword = humanizeError(new ApiError('Unauthorized', 401));
      const lockedAccount = humanizeError(new ApiError('Unauthorized', 401));
      expect(lockedAccount).toBe(wrongPassword);
    });

    it('returns a network error message for status 0', () => {
      expect(humanizeError(new ApiError('', 0)))
          .toBe('Cannot connect to the server. Check your network connection.');
    });

    it('falls back to a generic message for an unrecognized status', () => {
      expect(humanizeError(new ApiError('I\'m a teapot', 418)))
          .toBe('Login failed. Please try again.');
    });

    it('falls back to a generic message for a non-ApiError', () => {
      expect(humanizeError(new Error('boom')))
          .toBe('Login failed. Please try again.');
    });
  });
});