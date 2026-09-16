import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ComponentRef, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { IncidentDetail } from './incident-detail';
import { IncidentService } from '../../../core/services/incident.service';
import { TeamService } from '../../../core/services/team.service';
import { AuthService } from '../../../core/services/auth.service';
import { LoggerService } from '../../../core/services/logger.service';
import { Incident } from '../../../core/models/incident.model';
import { Team, TeamMember } from '../../../core/models/team.model';

function buildIncident(overrides: Partial<Incident> = {}): Incident {
  return {
    id: 'i-1',
    title: 'Test incident',
    description: 'Something is wrong',
    severity: 'HIGH',
    status: 'OPEN',
    tenantId: 'acme-corp',
    source: 'prometheus',
    sourceType: 'OPS',
    alertId: 'alert-1',
    teamId: null,
    alertFiredAt: null,
    createdAt: '2026-01-01T00:00:00Z',
    acknowledgedAt: null,
    resolvedAt: null,
    closedAt: null,
    mttaMinutes: null,
    mttrMinutes: null,
    assignedTo: null,
    escalationLevel: 0,
    allowedTransitions: [],
    ...overrides,
  };
}

/**
 * Covers backlog #7 — incident/team assignment UI. See
 * incident.service.ts/incident-detail.ts's own comments for the full
 * account of the two design decisions this tests: no optimistic update
 * (unlike updateStatus), and team-members-as-candidate-list rather than
 * a tenant-wide user list (which would 403 for a plain RESPONDER, and
 * has no page-size limit to silently truncate against).
 */
describe('IncidentDetail', () => {
  let component: IncidentDetail;
  let fixture: ComponentFixture<IncidentDetail>;
  let componentRef: ComponentRef<IncidentDetail>;

  let mockIncidentService: {
    selectedIncident: ReturnType<typeof signal<Incident | null>>;
    loading: ReturnType<typeof signal<boolean>>;
    error: ReturnType<typeof signal<string | null>>;
    auditEvents: ReturnType<typeof signal<unknown[]>>;
    auditLoading: ReturnType<typeof signal<boolean>>;
    postmortem: ReturnType<typeof signal<unknown | null>>;
    postmortemLoading: ReturnType<typeof signal<boolean>>;
    loadIncident: ReturnType<typeof vi.fn>;
    loadAuditLog: ReturnType<typeof vi.fn>;
    loadPostmortem: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    assignIncident: ReturnType<typeof vi.fn>;
    assignTeam: ReturnType<typeof vi.fn>;
    unassignTeam: ReturnType<typeof vi.fn>;
    updatePostmortemContent: ReturnType<typeof vi.fn>;
    markPostmortemReviewed: ReturnType<typeof vi.fn>;
  };

  let mockTeamService: {
    listTeams: ReturnType<typeof vi.fn>;
    listMembers: ReturnType<typeof vi.fn>;
  };

  let mockAuthService: {
    canManageIncidents: ReturnType<typeof signal<boolean>>;
  };

  const TEAM_A: Team = {
    id: 'team-a', tenantId: 'acme-corp', name: 'Platform',
    description: null, createdAt: '2026-01-01T00:00:00Z',
  };
  const TEAM_B: Team = {
    id: 'team-b', tenantId: 'acme-corp', name: 'Networking',
    description: null, createdAt: '2026-01-01T00:00:00Z',
  };
  const MEMBER: TeamMember = {
    userId: 'user-1', email: 'alice@acme.com', teamRole: 'RESPONDER',
    joinedAt: '2026-01-01T00:00:00Z',
  };

  beforeEach(async () => {
    mockIncidentService = {
      selectedIncident: signal<Incident | null>(null),
      loading: signal(false),
      error: signal<string | null>(null),
      auditEvents: signal([]),
      auditLoading: signal(false),
      postmortem: signal(null),
      postmortemLoading: signal(false),
      loadIncident: vi.fn(),
      loadAuditLog: vi.fn(),
      loadPostmortem: vi.fn(),
      updateStatus: vi.fn(),
      assignIncident: vi.fn(),
      assignTeam: vi.fn(),
      unassignTeam: vi.fn(),
      updatePostmortemContent: vi.fn(),
      markPostmortemReviewed: vi.fn(),
    };

    mockTeamService = {
      listTeams: vi.fn().mockReturnValue(of([TEAM_A, TEAM_B])),
      listMembers: vi.fn().mockReturnValue(of([MEMBER])),
    };

    mockAuthService = {
      canManageIncidents: signal(true),
    };

    await TestBed.configureTestingModule({
      imports: [IncidentDetail],
      providers: [
        provideRouter([{ path: 'incidents', children: [] }]),
        { provide: IncidentService, useValue: mockIncidentService },
        { provide: TeamService, useValue: mockTeamService },
        { provide: AuthService, useValue: mockAuthService },
        { provide: LoggerService, useValue: { info: vi.fn(), debug: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(IncidentDetail);
    component = fixture.componentInstance;
    componentRef = fixture.componentRef;
    componentRef.setInput('id', 'i-1');
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  describe('team members loading (effect)', () => {
    it('does not call listMembers when the incident has no team', () => {
      mockIncidentService.selectedIncident.set(buildIncident({ teamId: null }));
      fixture.detectChanges();

      expect(mockTeamService.listMembers).not.toHaveBeenCalled();
      expect(component.teamMembers()).toEqual([]);
    });

    it('calls listMembers with the incident\'s team once it has one', () => {
      mockIncidentService.selectedIncident.set(buildIncident({ teamId: 'team-a' }));
      fixture.detectChanges();

      expect(mockTeamService.listMembers).toHaveBeenCalledWith('team-a');
      expect(component.teamMembers()).toEqual([MEMBER]);
    });

    /**
       * The actual regression test for the optimization in
     * incident-detail.ts's own comment on incidentTeamId: the effect
     * must react to the team id changing, not to every incident update
     * (status change, WebSocket refresh, etc.) — _selectedIncident.set()
     * always sets a new object reference even when teamId is unchanged,
     * so an effect reading incident() directly would re-fetch on every
     * single update regardless of whether the team actually changed.
     */
    it('does not re-fetch members when the incident updates but the team id is unchanged', () => {
      mockIncidentService.selectedIncident.set(buildIncident({ teamId: 'team-a', status: 'OPEN' }));
      fixture.detectChanges();
      expect(mockTeamService.listMembers).toHaveBeenCalledTimes(1);

      // A new object reference, same teamId — e.g. an acknowledge action.
      mockIncidentService.selectedIncident.set(buildIncident({ teamId: 'team-a', status: 'ACKNOWLEDGED' }));
      fixture.detectChanges();

      expect(mockTeamService.listMembers).toHaveBeenCalledTimes(1);
    });

    it('re-fetches members when the team id actually changes', () => {
      mockIncidentService.selectedIncident.set(buildIncident({ teamId: 'team-a' }));
      fixture.detectChanges();
      expect(mockTeamService.listMembers).toHaveBeenCalledTimes(1);

      mockIncidentService.selectedIncident.set(buildIncident({ teamId: 'team-b' }));
      fixture.detectChanges();

      expect(mockTeamService.listMembers).toHaveBeenCalledTimes(2);
      expect(mockTeamService.listMembers).toHaveBeenLastCalledWith('team-b');
    });

    it('clears teamMembers when the team is unassigned', () => {
      mockIncidentService.selectedIncident.set(buildIncident({ teamId: 'team-a' }));
      fixture.detectChanges();
      expect(component.teamMembers()).toEqual([MEMBER]);

      mockIncidentService.selectedIncident.set(buildIncident({ teamId: null }));
      fixture.detectChanges();

      expect(component.teamMembers()).toEqual([]);
    });
  });

  describe('onAssign', () => {
    beforeEach(() => {
      mockIncidentService.selectedIncident.set(buildIncident({ teamId: 'team-a' }));
      fixture.detectChanges();
    });

    it('calls assignIncident with the selected user id', () => {
      component.selectedAssigneeId.set('user-1');
      component.onAssign();

      expect(mockIncidentService.assignIncident).toHaveBeenCalledWith('i-1', { userId: 'user-1' });
    });

    it('resets selectedAssigneeId after assigning', () => {
      component.selectedAssigneeId.set('user-1');
      component.onAssign();

      expect(component.selectedAssigneeId()).toBe('');
    });

    it('does not call assignIncident when no user is selected', () => {
      component.selectedAssigneeId.set('');
      component.onAssign();

      expect(mockIncidentService.assignIncident).not.toHaveBeenCalled();
    });
  });

  describe('onAssignTeam', () => {
    beforeEach(() => {
      mockIncidentService.selectedIncident.set(buildIncident({ teamId: null }));
      fixture.detectChanges();
    });

    it('calls assignTeam with the selected team id', () => {
      component.selectedTeamId.set('team-a');
      component.onAssignTeam();

      expect(mockIncidentService.assignTeam).toHaveBeenCalledWith('i-1', { teamId: 'team-a' });
    });

    it('resets selectedTeamId after assigning', () => {
      component.selectedTeamId.set('team-a');
      component.onAssignTeam();

      expect(component.selectedTeamId()).toBe('');
    });

    it('does not call assignTeam when no team is selected', () => {
      component.selectedTeamId.set('');
      component.onAssignTeam();

      expect(mockIncidentService.assignTeam).not.toHaveBeenCalled();
    });
  });

  describe('onUnassignTeam', () => {
    it('calls unassignTeam for the current incident', () => {
      mockIncidentService.selectedIncident.set(buildIncident({ teamId: 'team-a' }));
      fixture.detectChanges();

      component.onUnassignTeam();

      expect(mockIncidentService.unassignTeam).toHaveBeenCalledWith('i-1');
    });
  });

  describe('canManageIncidents', () => {
    it('reflects AuthService.canManageIncidents', () => {
      mockAuthService.canManageIncidents.set(false);
      fixture.detectChanges();

      expect(component.canManageIncidents()).toBe(false);
    });
  });

  describe('teamName', () => {
    it('resolves a known team id to its name', () => {
      mockIncidentService.selectedIncident.set(buildIncident());
      fixture.detectChanges();

      expect(component.teamName('team-a')).toBe('Platform');
    });

    it('returns a dash for null', () => {
      expect(component.teamName(null)).toBe('—');
    });

    it('returns a dash for an unrecognized team id', () => {
      expect(component.teamName('unknown-team')).toBe('—');
    });
  });

  describe('assigneeName', () => {
    it('resolves a member of the current team to their email', () => {
      mockIncidentService.selectedIncident.set(buildIncident({ teamId: 'team-a' }));
      fixture.detectChanges();

      expect(component.assigneeName('user-1')).toBe('alice@acme.com');
    });

    it('returns a dash for null', () => {
      expect(component.assigneeName(null)).toBe('—');
    });

    it('returns a dash when the assignee is not in the current team member list', () => {
      mockIncidentService.selectedIncident.set(buildIncident({ teamId: 'team-a' }));
      fixture.detectChanges();

      expect(component.assigneeName('someone-else')).toBe('—');
    });
  });

  describe('onPostmortemSave', () => {
    it('calls updatePostmortemContent with the incident id and new content', () => {
      fixture.detectChanges();

      component.onPostmortemSave('Edited content');

      expect(mockIncidentService.updatePostmortemContent).toHaveBeenCalledWith(
        'i-1', { content: 'Edited content' }
      );
    });
  });

  describe('onPostmortemMarkReviewed', () => {
    it('calls markPostmortemReviewed with the incident id', () => {
      fixture.detectChanges();

      component.onPostmortemMarkReviewed();

      expect(mockIncidentService.markPostmortemReviewed).toHaveBeenCalledWith('i-1');
    });
  });
});