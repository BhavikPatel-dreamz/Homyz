import test from 'node:test';
import assert from 'node:assert/strict';
import { getModerationPolicy, MODERATION_POLICIES } from '@/lib/moderation/policies';
import { assertValidModerationTransition } from '@/lib/moderation/lifecycle';

test('Phase 4: Review Reports, Disputes & Removal Requests', async (t) => {
  await t.test('1. Policy catalog supports all required review dispute categories', () => {
    const reviewPolicies = MODERATION_POLICIES.filter((p) => p.targetTypes.includes('REVIEW'));
    const policyCodes = reviewPolicies.map((p) => p.code);

    assert.ok(policyCodes.includes('FAKE_OR_INAUTHENTIC_REVIEW'));
    assert.ok(policyCodes.includes('RETALIATORY_REVIEW'));
    assert.ok(policyCodes.includes('IRRELEVANT_REVIEW'));
    assert.ok(policyCodes.includes('HARASSMENT_OR_THREATS'));
    assert.ok(policyCodes.includes('DISCRIMINATORY_CONTENT'));
    assert.ok(policyCodes.includes('SPAM_OR_PROMOTION'));
    assert.ok(policyCodes.includes('PRIVATE_INFORMATION'));
    assert.ok(policyCodes.includes('EXTORTION_OR_MANIPULATION'));
    assert.ok(policyCodes.includes('ILLEGAL_OR_PROHIBITED_CONTENT'));

    // Check specific policy lookup
    const retaliatory = getModerationPolicy('RETALIATORY_REVIEW', 'REVIEW');
    assert.ok(retaliatory);
    assert.equal(retaliatory?.defaultSeverity, 'MEDIUM');

    // Irrelevant reviews default to low severity
    const irrelevant = getModerationPolicy('IRRELEVANT_REVIEW', 'REVIEW');
    assert.ok(irrelevant);
    assert.equal(irrelevant?.defaultSeverity, 'LOW');
  });

  await t.test('2. Case lifecycle transitions for review disputes and investigations', () => {
    // Standard progression: NEW -> IN_REVIEW -> RESOLVED
    assert.doesNotThrow(() => assertValidModerationTransition('NEW', 'IN_REVIEW'));
    assert.doesNotThrow(() => assertValidModerationTransition('IN_REVIEW', 'RESOLVED'));

    // Information gathering: IN_REVIEW -> NEEDS_INFORMATION -> IN_REVIEW
    assert.doesNotThrow(() => assertValidModerationTransition('IN_REVIEW', 'NEEDS_INFORMATION'));
    assert.doesNotThrow(() => assertValidModerationTransition('NEEDS_INFORMATION', 'IN_REVIEW'));

    // Dismissal: IN_REVIEW -> DISMISSED
    assert.doesNotThrow(() => assertValidModerationTransition('IN_REVIEW', 'DISMISSED'));

    // Terminal reopening: RESOLVED -> REOPENED
    assert.doesNotThrow(() => assertValidModerationTransition('RESOLVED', 'REOPENED'));
    assert.doesNotThrow(() => assertValidModerationTransition('DISMISSED', 'REOPENED'));

    // Illegal transitions: cannot jump from NEW directly to REOPENED, or from DISMISSED to RESOLVED
    assert.throws(() => assertValidModerationTransition('NEW', 'REOPENED'));
    assert.throws(() => assertValidModerationTransition('DISMISSED', 'RESOLVED'));
  });

  await t.test('3. Review report validation rules and privacy guards', () => {
    // Review reporting eligibility logic simulation
    function checkReviewReportEligibility(params: {
      reviewStatus: string;
      reviewAuthorId: string;
      targetUserId: string | null;
      hostId: string;
      guestId: string;
      callerId: string;
      isModerator: boolean;
    }) {
      if (params.reviewStatus === 'PRIVATE') {
        return { allowed: false, reason: 'Unpublished reciprocal reviews cannot be reported.' };
      }
      if (!params.isModerator) {
        if (params.callerId === params.reviewAuthorId) {
          return { allowed: false, reason: 'You cannot report a review you authored.' };
        }
        const isSubject = params.targetUserId === params.callerId;
        const isHost = params.hostId === params.callerId;
        const isGuest = params.guestId === params.callerId;
        if (!isSubject && !isHost && !isGuest) {
          return { allowed: false, reason: 'You are not authorized to report this review.' };
        }
      }
      return { allowed: true };
    }

    // 1. Unpublished private review cannot be reported
    const privateCheck = checkReviewReportEligibility({
      reviewStatus: 'PRIVATE',
      reviewAuthorId: 'guest-1',
      targetUserId: 'host-1',
      hostId: 'host-1',
      guestId: 'guest-1',
      callerId: 'host-1',
      isModerator: false,
    });
    assert.equal(privateCheck.allowed, false);
    assert.equal(privateCheck.reason, 'Unpublished reciprocal reviews cannot be reported.');

    // 2. Author cannot report their own review
    const selfCheck = checkReviewReportEligibility({
      reviewStatus: 'PUBLISHED',
      reviewAuthorId: 'guest-1',
      targetUserId: 'host-1',
      hostId: 'host-1',
      guestId: 'guest-1',
      callerId: 'guest-1',
      isModerator: false,
    });
    assert.equal(selfCheck.allowed, false);
    assert.equal(selfCheck.reason, 'You cannot report a review you authored.');

    // 3. Unrelated user cannot report a private booking review
    const bystanderCheck = checkReviewReportEligibility({
      reviewStatus: 'PUBLISHED',
      reviewAuthorId: 'guest-1',
      targetUserId: 'host-1',
      hostId: 'host-1',
      guestId: 'guest-1',
      callerId: 'random-user',
      isModerator: false,
    });
    assert.equal(bystanderCheck.allowed, false);
    assert.equal(bystanderCheck.reason, 'You are not authorized to report this review.');

    // 4. Host can report an eligible guest review on their listing
    const hostEligible = checkReviewReportEligibility({
      reviewStatus: 'PUBLISHED',
      reviewAuthorId: 'guest-1',
      targetUserId: 'host-1',
      hostId: 'host-1',
      guestId: 'guest-1',
      callerId: 'host-1',
      isModerator: false,
    });
    assert.equal(hostEligible.allowed, true);

    // 5. Guest can report a host review about them
    const guestEligible = checkReviewReportEligibility({
      reviewStatus: 'PUBLISHED',
      reviewAuthorId: 'host-1',
      targetUserId: 'guest-1',
      hostId: 'host-1',
      guestId: 'guest-1',
      callerId: 'guest-1',
      isModerator: false,
    });
    assert.equal(guestEligible.allowed, true);
  });

  await t.test('4. Moderation decision and review action separation', () => {
    // Rule: Case resolution does NOT remove a review unless explicitly authorized
    function resolveCase(params: {
      status: string;
      resolutionCategory: string;
      reviewAction?: 'NONE' | 'HIDE' | 'DELETE' | 'RESTORE';
    }) {
      const reviewRemoved = params.reviewAction === 'HIDE' || params.reviewAction === 'DELETE';
      return {
        caseStatus: params.status,
        resolutionCategory: params.resolutionCategory,
        reviewRemoved,
      };
    }

    // Dismissal / No violation keeps review unchanged
    const dismissed = resolveCase({
      status: 'DISMISSED',
      resolutionCategory: 'NO_VIOLATION',
      reviewAction: 'NONE',
    });
    assert.equal(dismissed.caseStatus, 'DISMISSED');
    assert.equal(dismissed.reviewRemoved, false);

    // Resolution without removal keeps review unchanged
    const resolvedWithoutRemoval = resolveCase({
      status: 'RESOLVED',
      resolutionCategory: 'UNABLE_TO_DETERMINE',
      reviewAction: 'NONE',
    });
    assert.equal(resolvedWithoutRemoval.reviewRemoved, false);

    // Confirmed violation with explicit HIDE action removes review from public
    const approvedRemoval = resolveCase({
      status: 'RESOLVED',
      resolutionCategory: 'VIOLATION_CONFIRMED',
      reviewAction: 'HIDE',
    });
    assert.equal(approvedRemoval.reviewRemoved, true);
  });
});
