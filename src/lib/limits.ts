import { prisma } from './db';

/**
 * Check if organization can add more tokens based on their plan
 */
export async function checkTokenLimit(organizationId: string): Promise<{ allowed: boolean; message?: string }> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: { planRelation: true }
  });

  if (!subscription || !subscription.planRelation) {
    return { allowed: false, message: 'No subscription found' };
  }

  const tokensCount = await prisma.token.count({
    where: { organizationId }
  });

  const limit = subscription.planRelation.tokensLimit;

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true };
  }

  if (tokensCount >= limit) {
    return {
      allowed: false,
      message: `Token limit reached (${limit}). Upgrade your plan to add more tokens.`
    };
  }

  return { allowed: true };
}

/**
 * Check if organization can invite more members based on their plan
 */
export async function checkMembersLimit(organizationId: string): Promise<{ allowed: boolean; message?: string }> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: { planRelation: true }
  });

  if (!subscription || !subscription.planRelation) {
    return { allowed: false, message: 'No subscription found' };
  }

  const membersCount = await prisma.organizationMember.count({
    where: { organizationId }
  });

  const limit = subscription.planRelation.membersLimit;

  // -1 means unlimited
  if (limit === -1) {
    return { allowed: true };
  }

  if (membersCount >= limit) {
    return {
      allowed: false,
      message: `Member limit reached (${limit}). Upgrade your plan to invite more members.`
    };
  }

  return { allowed: true };
}

/**
 * Increment API call counter for organization
 * This should be called on every API request that consumes resources
 */
export async function incrementApiCalls(organizationId: string): Promise<void> {
  await prisma.subscription.update({
    where: { organizationId },
    data: {
      apiCallsThisMonth: { increment: 1 }
    }
  });
}

/**
 * Check if organization has exceeded API call limits
 * Returns warning but doesn't block (soft limit)
 */
export async function checkApiCallsLimit(organizationId: string): Promise<{ warning?: string }> {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: { planRelation: true }
  });

  if (!subscription || !subscription.planRelation) {
    return {};
  }

  const current = subscription.apiCallsThisMonth;
  const limit = subscription.planRelation.apiCallsLimit;

  // -1 means unlimited
  if (limit === -1) {
    return {};
  }

  // Warning at 80%
  if (current >= limit * 0.8 && current < limit) {
    return {
      warning: `You've used ${current}/${limit} API calls this month (${Math.round((current / limit) * 100)}%). Consider upgrading your plan.`
    };
  }

  // Hard limit reached
  if (current >= limit) {
    return {
      warning: `API call limit exceeded (${limit}/month). Some features may be restricted. Please upgrade your plan.`
    };
  }

  return {};
}

/**
 * Get usage stats for an organization
 */
export async function getUsageStats(organizationId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { organizationId },
    include: { planRelation: true }
  });

  if (!subscription || !subscription.planRelation) {
    return null;
  }

  const tokensCount = await prisma.token.count({
    where: { organizationId }
  });

  const membersCount = await prisma.organizationMember.count({
    where: { organizationId }
  });

  const plan = subscription.planRelation;

  return {
    tokens: {
      current: tokensCount,
      limit: plan.tokensLimit,
      percentage: plan.tokensLimit === -1 ? 0 : (tokensCount / plan.tokensLimit) * 100
    },
    members: {
      current: membersCount,
      limit: plan.membersLimit,
      percentage: plan.membersLimit === -1 ? 0 : (membersCount / plan.membersLimit) * 100
    },
    apiCalls: {
      current: subscription.apiCallsThisMonth,
      limit: plan.apiCallsLimit,
      percentage: plan.apiCallsLimit === -1 ? 0 : (subscription.apiCallsThisMonth / plan.apiCallsLimit) * 100
    }
  };
}
