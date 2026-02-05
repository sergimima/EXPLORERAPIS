'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface SystemSettings {
  basescanApiKey?: string;
  etherscanApiKey?: string;
  moralisApiKey?: string;
  quicknodeUrl?: string;
  routescanApiKey?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  stripeSecretKey?: string;
  stripePublishableKey?: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
  appName?: string;
  appUrl?: string;
  supportEmail?: string;
}

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'api' | 'email' | 'stripe' | 'cloudinary' | 'general'>('api');
  const [formData, setFormData] = useState<SystemSettings>({});

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/admin/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(data.settings);
        setFormData(data.settings);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        toast.success('Settings saved successfully');
        await fetchSettings();
      } else {
        toast.error('Error saving settings');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'api' as const, label: 'API Keys', icon: '🔑' },
    { id: 'email' as const, label: 'Email', icon: '📧' },
    { id: 'stripe' as const, label: 'Stripe', icon: '💳' },
    { id: 'cloudinary' as const, label: 'Cloudinary', icon: '🖼️' },
    { id: 'general' as const, label: 'General', icon: '⚙️' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">System Settings</h1>
        <p className="text-muted-foreground mt-1">Configuración global de la plataforma</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-3 font-medium text-sm transition-colors
              ${activeTab === tab.id
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
              }
            `}
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-card rounded-lg shadow p-6">
        {/* API Keys Tab */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-4">Blockchain API Keys</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">BaseScan API Key:</label>
                  <input
                    type="text"
                    value={formData.basescanApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, basescanApiKey: e.target.value })}
                    placeholder="Enter BaseScan API key"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for contract ABIs and verification on Base network
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Etherscan API Key:</label>
                  <input
                    type="text"
                    value={formData.etherscanApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, etherscanApiKey: e.target.value })}
                    placeholder="Enter Etherscan API key"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for transfer history via Etherscan V2 API
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Moralis API Key:</label>
                  <input
                    type="text"
                    value={formData.moralisApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, moralisApiKey: e.target.value })}
                    placeholder="Enter Moralis API key"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for real-time holder data and token ownership
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">QuickNode RPC URL:</label>
                  <input
                    type="text"
                    value={formData.quicknodeUrl || ''}
                    onChange={(e) => setFormData({ ...formData, quicknodeUrl: e.target.value })}
                    placeholder="https://your-endpoint.base-mainnet.quiknode.pro/..."
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    RPC provider for blockchain interactions and price data
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Routescan API Key:</label>
                  <input
                    type="text"
                    value={formData.routescanApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, routescanApiKey: e.target.value })}
                    placeholder="Enter Routescan API key"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Used for multi-chain blockchain data and contract verification
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Email Tab */}
        {activeTab === 'email' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-4">Email Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Resend API Key:</label>
                  <input
                    type="text"
                    value={formData.resendApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, resendApiKey: e.target.value })}
                    placeholder="re_..."
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    API key from Resend for sending transactional emails
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">From Email:</label>
                  <input
                    type="email"
                    value={formData.resendFromEmail || ''}
                    onChange={(e) => setFormData({ ...formData, resendFromEmail: e.target.value })}
                    placeholder="noreply@yourdomain.com"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Sender email address for invitations and notifications
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stripe Tab */}
        {activeTab === 'stripe' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-4">Stripe Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Secret Key:</label>
                  <input
                    type="password"
                    value={formData.stripeSecretKey || ''}
                    onChange={(e) => setFormData({ ...formData, stripeSecretKey: e.target.value })}
                    placeholder="sk_test_... or sk_live_..."
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Stripe secret key for server-side operations
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Publishable Key:</label>
                  <input
                    type="text"
                    value={formData.stripePublishableKey || ''}
                    onChange={(e) => setFormData({ ...formData, stripePublishableKey: e.target.value })}
                    placeholder="pk_test_... or pk_live_..."
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Stripe publishable key for client-side checkout
                  </p>
                </div>

                <div className="bg-warning/10 border border-warning rounded-lg p-4">
                  <p className="text-sm text-warning">
                    ⚠️ <strong>Important:</strong> Use test keys during development. Switch to live keys only in production.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cloudinary Tab */}
        {activeTab === 'cloudinary' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-4">Cloudinary Configuration</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Configura tu cuenta de Cloudinary para subir logos de organizaciones y tokens. Free tier: 25 GB storage, 25 GB bandwidth/mes.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Cloud Name:</label>
                  <input
                    type="text"
                    value={formData.cloudinaryCloudName || ''}
                    onChange={(e) => setFormData({ ...formData, cloudinaryCloudName: e.target.value })}
                    placeholder="tu-cloud-name"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lo encuentras en el dashboard de Cloudinary
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">API Key:</label>
                  <input
                    type="text"
                    value={formData.cloudinaryApiKey || ''}
                    onChange={(e) => setFormData({ ...formData, cloudinaryApiKey: e.target.value })}
                    placeholder="123456789012345"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    API Key desde el dashboard
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">API Secret:</label>
                  <input
                    type="password"
                    value={formData.cloudinaryApiSecret || ''}
                    onChange={(e) => setFormData({ ...formData, cloudinaryApiSecret: e.target.value })}
                    placeholder="••••••••••••••••••••"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background text-foreground"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    API Secret (mantener privado)
                  </p>
                </div>

                <div className="bg-accent border border-border rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">Obtener credenciales:</strong> Crea una cuenta gratis en{' '}
                    <a href="https://cloudinary.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                      cloudinary.com
                    </a>
                    . En el Dashboard verás Cloud Name, API Key y API Secret.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold mb-4">General Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Application Name:</label>
                  <input
                    type="text"
                    value={formData.appName || ''}
                    onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                    placeholder="TokenLens"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Displayed in emails and branding
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Application URL:</label>
                  <input
                    type="url"
                    value={formData.appUrl || ''}
                    onChange={(e) => setFormData({ ...formData, appUrl: e.target.value })}
                    placeholder="https://tokenlens.com"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Base URL for links in emails and invitations
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Support Email:</label>
                  <input
                    type="email"
                    value={formData.supportEmail || ''}
                    onChange={(e) => setFormData({ ...formData, supportEmail: e.target.value })}
                    placeholder="support@tokenlens.com"
                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Contact email for user support and inquiries
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save Button */}
        <div className="mt-6 pt-6 border-t border-border">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>
      </div>

      {/* Info Panel */}
      <div className="mt-6 bg-accent border border-border rounded-lg p-4">
        <h3 className="font-medium text-card-foreground mb-2">ℹ️ Security Note</h3>
        <p className="text-sm text-muted-foreground">
          API keys are stored securely in the database. When viewing settings, sensitive values are masked for security.
          Only update keys when necessary and never share them publicly.
        </p>
      </div>
    </div>
  );
}
