import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/admin/stripe/webhook
 *
 * Webhook de Stripe para procesar eventos de subscriptions
 * STUB: Implementar en Sprint 4.5+ cuando se integre Stripe
 *
 * Eventos a manejar:
 * - checkout.session.completed: Nueva subscription creada
 * - customer.subscription.updated: Subscription actualizada
 * - customer.subscription.deleted: Subscription cancelada
 * - invoice.payment_succeeded: Pago exitoso
 * - invoice.payment_failed: Pago fallido
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    console.log('📥 Stripe webhook received');
    console.log('   Signature:', signature ? '***present***' : 'missing');
    console.log('   Body length:', body.length);

    // TODO: Implementar verificación de firma con Stripe
    // const event = stripe.webhooks.constructEvent(
    //   body,
    //   signature,
    //   process.env.STRIPE_WEBHOOK_SECRET
    // );

    // TODO: Procesar eventos según el tipo
    // switch (event.type) {
    //   case 'checkout.session.completed':
    //     // Crear nueva subscription en BD
    //     break;
    //   case 'customer.subscription.updated':
    //     // Actualizar subscription existente
    //     break;
    //   case 'customer.subscription.deleted':
    //     // Cancelar subscription
    //     break;
    //   case 'invoice.payment_succeeded':
    //     // Marcar pago como exitoso, resetear contador de API calls
    //     break;
    //   case 'invoice.payment_failed':
    //     // Marcar subscription como PAST_DUE
    //     break;
    // }

    // Por ahora, simplemente retornar 200 OK
    return NextResponse.json({
      received: true,
      message: 'Webhook received (stub - not processed)'
    });

  } catch (error) {
    console.error('Error processing Stripe webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 400 }
    );
  }
}
