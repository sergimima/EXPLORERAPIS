'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Campo de límite con checkbox Ilimitado
function LimitField({
  label,
  value,
  onChange,
  defaultValue = 1,
  placeholder = '0'
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  defaultValue?: number;
  placeholder?: string;
}) {
  const isUnlimited = value === -1;
  return (
    <div>
      <label className="block text-sm font-medium mb-1 text-foreground">{label}</label>
      <div className="flex items-center gap-3">
        {isUnlimited ? (
          <span className="px-3 py-2 border border-input rounded-lg bg-muted/50 text-muted-foreground">∞ Ilimitado</span>
        ) : (
          <input
            type="number"
            min="0"
            value={value}
            onChange={(e) => onChange(Number(e.target.value))}
            placeholder={placeholder}
            className="flex-1 min-w-0 px-3 py-2 border border-input rounded-lg bg-background text-foreground"
          />
        )}
        <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap">
          <input
            type="checkbox"
            checked={isUnlimited}
            onChange={(e) => onChange(e.target.checked ? -1 : defaultValue)}
            className="rounded border-input"
          />
          <span className="text-sm text-foreground">Ilimitado</span>
        </label>
      </div>
    </div>
  );
}

// Card de plan arrastrable
function SortablePlanCard({
  plan,
  onEdit,
  onDelete
}: {
  plan: any;
  onEdit: (p: any) => void;
  onDelete: (p: any) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: plan.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card rounded-lg shadow p-6 border border-border ${isDragging ? 'opacity-50 shadow-lg z-50' : ''}`}
    >
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground touch-none"
            title="Arrastrar para reordenar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="5" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="19" r="1" />
              <circle cx="15" cy="5" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="19" r="1" />
            </svg>
          </button>
          <h3 className="text-xl font-bold text-card-foreground truncate">{plan.name}</h3>
        </div>
        <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs shrink-0">
          {plan.subscriptionsCount} subs
        </span>
      </div>
      <div className="text-3xl font-bold mb-4 text-card-foreground">${plan.price}<span className="text-sm text-muted-foreground">/mo</span></div>
      <div className="space-y-2 text-sm text-muted-foreground mb-4">
        <p>🪙 {plan.tokensLimit === -1 ? '∞' : plan.tokensLimit} tokens</p>
        <p>📡 {plan.apiCallsLimit === -1 ? '∞' : plan.apiCallsLimit.toLocaleString()} API calls</p>
        <p>📦 {plan.transfersLimit === -1 ? '∞' : plan.transfersLimit?.toLocaleString?.() ?? plan.transfersLimit} transfers</p>
        <p>👥 {plan.membersLimit === -1 ? '∞' : plan.membersLimit} members</p>
      </div>
      <div className="flex gap-2 pt-2 border-t border-border">
        <button
          onClick={() => onEdit(plan)}
          className="flex-1 px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          Editar
        </button>
        <button
          onClick={() => onDelete(plan)}
          disabled={plan.subscriptionsCount > 0}
          className="px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Eliminar
        </button>
      </div>
    </div>
  );
}

const defaultFormData = {
  name: '',
  slug: '',
  description: '',
  price: 0,
  currency: 'USD',
  stripePriceId: '',
  tokensLimit: 1,
  apiCallsLimit: 10000,
  transfersLimit: 10000,
  membersLimit: 1,
  features: '' as string | string[],
  sortOrder: 0,
  isActive: true,
  isPublic: true
};

export default function PlansPage() {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [formData, setFormData] = useState(defaultFormData);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch('/api/admin/plans');
      if (res.ok) {
        const data = await res.json();
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = plans.findIndex((p) => p.id === active.id);
    const newIndex = plans.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const newPlans = arrayMove(plans, oldIndex, newIndex);
    setPlans(newPlans);

    try {
      const res = await fetch('/api/admin/plans/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newPlans.map((p) => p.id) })
      });
      if (res.ok) {
        toast.success('Orden actualizado');
      } else {
        setPlans(plans);
        toast.error('Error al reordenar');
      }
    } catch (error) {
      setPlans(plans);
      toast.error('Error al reordenar');
    }
  }, [plans]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 }
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates
    })
  );

  const openEditModal = (plan: any) => {
    setEditingPlan(plan);
    const features = Array.isArray(plan.features) ? plan.features.join(', ') : plan.features || '';
    setFormData({
      ...defaultFormData,
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price: plan.price,
      currency: plan.currency || 'USD',
      stripePriceId: plan.stripePriceId || '',
      tokensLimit: plan.tokensLimit,
      apiCallsLimit: plan.apiCallsLimit,
      transfersLimit: plan.transfersLimit,
      membersLimit: plan.membersLimit,
      features,
      sortOrder: plan.sortOrder ?? 0,
      isActive: plan.isActive ?? true,
      isPublic: plan.isPublic ?? true
    });
  };

  const closeEditModal = () => {
    setEditingPlan(null);
    setFormData(defaultFormData);
  };

  const toPayload = () => {
    const featuresStr = typeof formData.features === 'string' ? formData.features : '';
    const featuresArr = featuresStr ? featuresStr.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    return {
      ...formData,
      stripePriceId: formData.stripePriceId || undefined,
      features: featuresArr,
      description: formData.description || undefined
    };
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload())
      });

      if (res.ok) {
        toast.success('Plan creado correctamente');
        setShowCreateForm(false);
        setFormData(defaultFormData);
        fetchPlans();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Error al crear plan');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al crear plan');
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;
    try {
      const res = await fetch(`/api/admin/plans/${editingPlan.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload())
      });

      if (res.ok) {
        toast.success('Plan actualizado correctamente');
        closeEditModal();
        fetchPlans();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Error al actualizar plan');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar plan');
    }
  };

  const handleDelete = async (plan: any) => {
    if (!confirm(`¿Eliminar plan "${plan.name}"? Solo se puede si no tiene suscripciones activas.`)) return;
    try {
      const res = await fetch(`/api/admin/plans/${plan.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        toast.success('Plan eliminado');
        fetchPlans();
      } else {
        toast.error(data.error || 'Error al eliminar');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al eliminar plan');
    }
  };

  if (loading) return <div className="py-12 text-center">Cargando...</div>;

  return (
    <div className="max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Plans</h1>
          <p className="text-muted-foreground mt-1">Gestiona los planes de suscripción</p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
        >
          {showCreateForm ? 'Cancelar' : '+ Crear Plan'}
        </button>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-card rounded-lg shadow p-6 mb-6 border border-border">
          <h2 className="text-xl font-bold mb-4 text-card-foreground">Crear Nuevo Plan</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Name:</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Slug:</label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium mb-1 text-foreground">Descripción (opcional):</label>
                <input
                  type="text"
                  placeholder="Ideal para equipos pequeños..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Precio:</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    className="flex-1 px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                  />
                  <select
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className="w-20 px-2 py-2 border border-input rounded-lg bg-background text-foreground"
                  >
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Stripe Price ID (opcional):</label>
                <input
                  type="text"
                  placeholder="price_xxx..."
                  value={formData.stripePriceId}
                  onChange={(e) => setFormData({ ...formData, stripePriceId: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                />
              </div>
              <LimitField
                label="Tokens Limit"
                value={formData.tokensLimit}
                onChange={(v) => setFormData({ ...formData, tokensLimit: v })}
                defaultValue={1}
              />
              <LimitField
                label="API Calls Limit"
                value={formData.apiCallsLimit}
                onChange={(v) => setFormData({ ...formData, apiCallsLimit: v })}
                defaultValue={10000}
              />
              <LimitField
                label="Transfers Limit"
                value={formData.transfersLimit}
                onChange={(v) => setFormData({ ...formData, transfersLimit: v })}
                defaultValue={10000}
              />
              <LimitField
                label="Members Limit"
                value={formData.membersLimit}
                onChange={(v) => setFormData({ ...formData, membersLimit: v })}
                defaultValue={1}
              />
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Features (separados por coma):</label>
                <input
                  type="text"
                  placeholder="webhooks, priority-support, ..."
                  value={typeof formData.features === 'string' ? formData.features : ''}
                  onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-foreground">Orden (0 = primero):</label>
                <input
                  type="number"
                  value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                />
              </div>
              <div className="col-span-2 flex gap-6 items-center pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded border-input"
                  />
                  <span className="text-sm text-foreground">Activo</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isPublic}
                    onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                    className="rounded border-input"
                  />
                  <span className="text-sm text-foreground">Público (self-service)</span>
                </label>
              </div>
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              Crear Plan
            </button>
          </form>
        </div>
      )}

      {/* Plans Grid - Arrastra para reordenar */}
      <div className="mb-2 text-sm text-muted-foreground">
        Arrastra las cards para cambiar el orden
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={plans.map((p) => p.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <SortablePlanCard
                key={plan.id}
                plan={plan}
                onEdit={openEditModal}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Edit Modal */}
      {editingPlan && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-4xl my-8 border border-border flex flex-col max-h-[calc(100vh-4rem)] overflow-hidden">
            <div className="flex justify-between items-center p-6 border-b border-border shrink-0">
              <h2 className="text-xl font-bold text-card-foreground">Editar plan: {editingPlan.name}</h2>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdate} className="flex flex-col min-h-0 flex-1">
              <div className="p-6 overflow-y-auto overflow-x-hidden min-h-0 flex-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 min-w-0">
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="block text-sm font-medium mb-1 text-foreground">Descripción (opcional):</label>
                    <input
                      type="text"
                      placeholder="Ideal para equipos pequeños..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground">Name:</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground">Slug:</label>
                    <input
                      type="text"
                      required
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground">Precio:</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        required
                        value={formData.price}
                        onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                        className="flex-1 px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                      />
                      <select
                        value={formData.currency}
                        onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                        className="w-20 px-2 py-2 border border-input rounded-lg bg-background text-foreground"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground">Stripe Price ID (opcional):</label>
                    <input
                      type="text"
                      placeholder="price_xxx..."
                      value={formData.stripePriceId}
                      onChange={(e) => setFormData({ ...formData, stripePriceId: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                    />
                  </div>
                  <LimitField
                    label="Tokens Limit"
                    value={formData.tokensLimit}
                    onChange={(v) => setFormData({ ...formData, tokensLimit: v })}
                    defaultValue={1}
                  />
                  <LimitField
                    label="API Calls Limit"
                    value={formData.apiCallsLimit}
                    onChange={(v) => setFormData({ ...formData, apiCallsLimit: v })}
                    defaultValue={10000}
                  />
                  <LimitField
                    label="Transfers Limit"
                    value={formData.transfersLimit}
                    onChange={(v) => setFormData({ ...formData, transfersLimit: v })}
                    defaultValue={10000}
                  />
                  <LimitField
                    label="Members Limit"
                    value={formData.membersLimit}
                    onChange={(v) => setFormData({ ...formData, membersLimit: v })}
                    defaultValue={1}
                  />
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground">Features (separados por coma):</label>
                    <input
                      type="text"
                      placeholder="webhooks, priority-support, ..."
                      value={typeof formData.features === 'string' ? formData.features : ''}
                      onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-foreground">Orden (0 = primero):</label>
                    <input
                      type="number"
                      value={formData.sortOrder}
                      onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })}
                      className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 flex gap-6 items-center pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded border-input"
                      />
                      <span className="text-sm text-foreground">Activo</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.isPublic}
                        onChange={(e) => setFormData({ ...formData, isPublic: e.target.checked })}
                        className="rounded border-input"
                      />
                      <span className="text-sm text-foreground">Público (self-service)</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-border flex gap-2 shrink-0">
                  <button type="submit" className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90">
                    Guardar cambios
                  </button>
                  <button type="button" onClick={closeEditModal} className="px-6 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80">
                    Cancelar
                  </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
