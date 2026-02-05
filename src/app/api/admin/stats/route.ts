import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireSuperAdmin } from '@/lib/auth-helpers';

/**
 * GET /api/admin/stats
 *
 * Estadísticas para gráficos del dashboard admin
 * Solo accesible para SUPER_ADMIN
 */
export async function GET() {
  const session = await requireSuperAdmin();
  if (!session) {
    return NextResponse.json(
      { error: 'Forbidden: SUPER_ADMIN required' },
      { status: 403 }
    );
  }

  try {
    const now = new Date();
    const monthsBack = 12;

    // Generar array de últimos N meses
    const monthLabels: string[] = [];
    const monthStarts: Date[] = [];
    const monthEnds: Date[] = [];

    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthLabels.push(d.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' }));
      monthStarts.push(new Date(d.getFullYear(), d.getMonth(), 1));
      monthEnds.push(new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59));
    }

    // 1. Nuevas organizaciones por mes
    const orgs = await prisma.organization.findMany({
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' }
    });

    const orgsByMonth = monthLabels.map((label, i) => {
      const start = monthStarts[i].getTime();
      const end = monthEnds[i].getTime();
      const count = orgs.filter(
        (o) => o.createdAt.getTime() >= start && o.createdAt.getTime() <= end
      ).length;
      return { month: label, count };
    });

    // 2. Cancelaciones por mes (subscriptions con status CANCELED, por canceledAt)
    const subscriptions = await prisma.subscription.findMany({
      where: { status: 'CANCELED', canceledAt: { not: null } },
      select: { canceledAt: true }
    });

    const cancelationsByMonth = monthLabels.map((label, i) => {
      const start = monthStarts[i].getTime();
      const end = monthEnds[i].getTime();
      const count = subscriptions.filter((s) => {
        const t = s.canceledAt?.getTime();
        return t != null && t >= start && t <= end;
      }).length;
      return { month: label, count };
    });

    // 3. Evolución del MRR por mes
    // Para cada mes: sumar price de subs activas (creadas antes del fin de mes, no canceladas antes del inicio)
    const subsWithPlan = await prisma.subscription.findMany({
      where: { planId: { not: null } },
      include: {
        planRelation: true
      }
    });

    const mrrByMonth = monthLabels.map((label, i) => {
      const monthStart = monthStarts[i].getTime();
      const monthEnd = monthEnds[i].getTime();

      let mrr = 0;
      for (const sub of subsWithPlan) {
        const plan = sub.planRelation;
        if (!plan) continue;

        const created = sub.createdAt.getTime();
        const canceled = sub.canceledAt?.getTime();

        // Activa en este mes si: creada antes del fin del mes Y (no cancelada O cancelada después del inicio del mes)
        const wasActive = created <= monthEnd && (canceled == null || canceled > monthStart);
        if (wasActive) {
          mrr += Number(plan.price);
        }
      }

      return { month: label, mrr: Math.round(mrr * 100) / 100 };
    });

    return NextResponse.json({
      orgsByMonth,
      cancelationsByMonth,
      mrrByMonth
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
