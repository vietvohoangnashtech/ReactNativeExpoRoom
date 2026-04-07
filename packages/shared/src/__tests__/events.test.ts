import {
  EVENT_TYPES,
  OUTBOX_STATUS,
  type EventType,
  type OutboxStatus,
  type EventEnvelope,
  type SessionStartedPayload,
  type SessionEndedPayload,
  type MemberRegisteredPayload,
  type PaymentRecordedPayload,
  type WeightRecordedPayload,
  type TodoCreatedPayload,
} from '../events';

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('events module', () => {
  // ── EVENT_TYPES ────────────────────────────────────────────────────────

  describe('EVENT_TYPES', () => {
    it('should define SESSION_STARTED as "SessionStarted"', () => {
      expect(EVENT_TYPES.SESSION_STARTED).toBe('SessionStarted');
    });

    it('should define SESSION_ENDED as "SessionEnded"', () => {
      expect(EVENT_TYPES.SESSION_ENDED).toBe('SessionEnded');
    });

    it('should define MEMBER_REGISTERED as "MemberRegistered"', () => {
      expect(EVENT_TYPES.MEMBER_REGISTERED).toBe('MemberRegistered');
    });

    it('should define MEMBER_IDENTIFIED as "MemberIdentified"', () => {
      expect(EVENT_TYPES.MEMBER_IDENTIFIED).toBe('MemberIdentified');
    });

    it('should define PAYMENT_RECORDED as "PaymentRecorded"', () => {
      expect(EVENT_TYPES.PAYMENT_RECORDED).toBe('PaymentRecorded');
    });

    it('should define WEIGHT_RECORDED as "WeightRecorded"', () => {
      expect(EVENT_TYPES.WEIGHT_RECORDED).toBe('WeightRecorded');
    });

    it('should define AWARD_GRANTED as "AwardGranted"', () => {
      expect(EVENT_TYPES.AWARD_GRANTED).toBe('AwardGranted');
    });

    it('should define TODO_CREATED as "TodoCreated"', () => {
      expect(EVENT_TYPES.TODO_CREATED).toBe('TodoCreated');
    });

    it('should define TODO_UPDATED as "TodoUpdated"', () => {
      expect(EVENT_TYPES.TODO_UPDATED).toBe('TodoUpdated');
    });

    it('should define TODO_DELETED as "TodoDeleted"', () => {
      expect(EVENT_TYPES.TODO_DELETED).toBe('TodoDeleted');
    });

    it('should contain exactly 10 event types', () => {
      expect(Object.keys(EVENT_TYPES)).toHaveLength(10);
    });

    it('should have all values as non-empty strings', () => {
      Object.values(EVENT_TYPES).forEach((value) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });

    it('should have all values be unique', () => {
      const values = Object.values(EVENT_TYPES);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });

    it('should use PascalCase for all event type values', () => {
      Object.values(EVENT_TYPES).forEach((value) => {
        expect(value).toMatch(/^[A-Z][A-Za-z]+$/);
      });
    });
  });

  // ── OUTBOX_STATUS ────────────────────────────────────────────────────────

  describe('OUTBOX_STATUS', () => {
    it('should define PENDING as "Pending"', () => {
      expect(OUTBOX_STATUS.PENDING).toBe('Pending');
    });

    it('should define DEVICE_SYNCED as "DeviceSynced"', () => {
      expect(OUTBOX_STATUS.DEVICE_SYNCED).toBe('DeviceSynced');
    });

    it('should define BACKEND_SYNCED as "BackendSynced"', () => {
      expect(OUTBOX_STATUS.BACKEND_SYNCED).toBe('BackendSynced');
    });

    it('should define FAILED as "Failed"', () => {
      expect(OUTBOX_STATUS.FAILED).toBe('Failed');
    });

    it('should contain exactly 4 statuses', () => {
      expect(Object.keys(OUTBOX_STATUS)).toHaveLength(4);
    });

    it('should have all values be unique', () => {
      const values = Object.values(OUTBOX_STATUS);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  // ── Type compatibility checks ────────────────────────────────────────────

  describe('EventType type', () => {
    it('should accept any EVENT_TYPES value as an EventType', () => {
      const types: EventType[] = Object.values(EVENT_TYPES);
      expect(types).toHaveLength(10);
    });
  });

  describe('OutboxStatus type', () => {
    it('should accept any OUTBOX_STATUS value as an OutboxStatus', () => {
      const statuses: OutboxStatus[] = Object.values(OUTBOX_STATUS);
      expect(statuses).toHaveLength(4);
    });
  });

  // ── EventEnvelope shape ──────────────────────────────────────────────────

  describe('EventEnvelope shape', () => {
    it('should be constructable with required fields', () => {
      const envelope: EventEnvelope = {
        eventId: 'evt-001',
        deviceId: 'dev-001',
        sessionId: 'sess-001',
        eventType: EVENT_TYPES.SESSION_STARTED,
        occurredAt: new Date().toISOString(),
        payload: { groupId: 'g-1', consultantId: 'c-1', startedAt: '2026-01-01' },
        idempotencyKey: 'idem-001',
        correlationId: 'corr-001',
      };

      expect(envelope.eventId).toBe('evt-001');
      expect(envelope.eventType).toBe('SessionStarted');
    });
  });

  // ── Payload shapes ───────────────────────────────────────────────────────

  describe('SessionStartedPayload', () => {
    it('should be constructable with required fields', () => {
      const payload: SessionStartedPayload = {
        groupId: 'group-alpha',
        consultantId: 'consultant-001',
        startedAt: new Date().toISOString(),
      };

      expect(payload.groupId).toBe('group-alpha');
    });
  });

  describe('SessionEndedPayload', () => {
    it('should be constructable with required fields', () => {
      const payload: SessionEndedPayload = {
        endedAt: new Date().toISOString(),
        memberCount: 5,
        eventCount: 12,
      };

      expect(payload.memberCount).toBe(5);
    });
  });

  describe('MemberRegisteredPayload', () => {
    it('should be constructable with required fields', () => {
      const payload: MemberRegisteredPayload = {
        memberId: 'member-001',
        name: 'Jane Doe',
      };

      expect(payload.memberId).toBe('member-001');
    });

    it('should accept optional email and nfcCardId', () => {
      const payload: MemberRegisteredPayload = {
        memberId: 'member-002',
        name: 'John Smith',
        email: 'john@example.com',
        nfcCardId: 'NFC-ABC123',
      };

      expect(payload.email).toBe('john@example.com');
      expect(payload.nfcCardId).toBe('NFC-ABC123');
    });
  });

  describe('PaymentRecordedPayload', () => {
    it('should be constructable with required fields', () => {
      const payload: PaymentRecordedPayload = {
        paymentId: 'pay-001',
        memberId: 'member-001',
        amount: 100,
        currency: 'THB',
        type: 'cash',
      };

      expect(payload.amount).toBe(100);
      expect(payload.type).toBe('cash');
    });
  });

  describe('WeightRecordedPayload', () => {
    it('should be constructable with required fields', () => {
      const payload: WeightRecordedPayload = {
        recordId: 'rec-001',
        memberId: 'member-001',
        weight: 65.4,
        source: 'scale',
      };

      expect(payload.weight).toBe(65.4);
      expect(payload.source).toBe('scale');
    });
  });

  describe('TodoCreatedPayload', () => {
    it('should be constructable with required fields', () => {
      const payload: TodoCreatedPayload = {
        todoId: 'todo-001',
        title: 'Buy groceries',
      };

      expect(payload.todoId).toBe('todo-001');
    });
  });
});
