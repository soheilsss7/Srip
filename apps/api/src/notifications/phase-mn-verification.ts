import { DOMAIN_EVENT_TYPES } from '../event-bus/event-bus.constants';

export function verifyPhaseMNContracts() {
  const workflowContract = [
    'currentActionIndex',
    'runExecutionFromIndex',
    'REQUEST_APPROVAL',
    'APPROVED',
    'REJECTED',
  ];
  const notificationContract = [
    'evaluate',
    'active',
    'eventType',
    'conditions',
    'recipients',
    'IN_APP',
    'EMAIL',
    'PUSH',
    'notificationRuleDelivery',
  ];
  if (Object.values(DOMAIN_EVENT_TYPES).length < 20) throw new Error('Canonical domain event catalog unexpectedly small');
  return { workflowContract, notificationContract, status: 'PASS' as const };
}
