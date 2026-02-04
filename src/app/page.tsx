'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

export default function Home() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-white relative overflow-hidden">
      {/* 3D Cylinder Spiral Background */}
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center" style={{ perspective: '2000px' }}>
        <div
          className="relative w-full h-full"
          style={{
            transformStyle: 'preserve-3d',
            transform: `rotateY(${scrollY * 0.1}deg)`,
            transition: 'transform 0.05s ease-out'
          }}
        >
          {/* Screen 1 */}
          <div
            className="absolute w-[400px] h-[250px] bg-gradient-to-br from-[#6366F1]/25 to-[#8B5CF6]/25 rounded-2xl border border-white/10 shadow-2xl"
            style={{
              top: '20%',
              left: '50%',
              marginLeft: '-200px',
              transform: `rotateY(0deg) translateZ(400px)`,
              transformStyle: 'preserve-3d'
            }}
          >
            <div className="w-full h-full p-6 bg-[#0A0B0D]/50 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-2">📊</div>
                <div className="text-sm text-[#A78BFA]">TokenLens</div>
              </div>
            </div>
          </div>

          {/* Screen 2 */}
          <div
            className="absolute w-[400px] h-[250px] bg-gradient-to-br from-[#10B981]/25 to-[#059669]/25 rounded-2xl border border-white/10 shadow-2xl"
            style={{
              top: '25%',
              left: '50%',
              marginLeft: '-200px',
              transform: `rotateY(72deg) translateZ(400px)`,
              transformStyle: 'preserve-3d'
            }}
          >
            <div className="w-full h-full p-6 bg-[#0A0B0D]/50 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-2">🔒</div>
                <div className="text-sm text-[#10B981]">Vesting Monitor</div>
              </div>
            </div>
          </div>

          {/* Screen 3 */}
          <div
            className="absolute w-[400px] h-[250px] bg-gradient-to-br from-[#F59E0B]/25 to-[#D97706]/25 rounded-2xl border border-white/10 shadow-2xl"
            style={{
              top: '30%',
              left: '50%',
              marginLeft: '-200px',
              transform: `rotateY(144deg) translateZ(400px)`,
              transformStyle: 'preserve-3d'
            }}
          >
            <div className="w-full h-full p-6 bg-[#0A0B0D]/50 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-2">🐋</div>
                <div className="text-sm text-[#F59E0B]">Whale Tracking</div>
              </div>
            </div>
          </div>

          {/* Screen 4 */}
          <div
            className="absolute w-[400px] h-[250px] bg-gradient-to-br from-[#EC4899]/25 to-[#BE185D]/25 rounded-2xl border border-white/10 shadow-2xl"
            style={{
              top: '35%',
              left: '50%',
              marginLeft: '-200px',
              transform: `rotateY(216deg) translateZ(400px)`,
              transformStyle: 'preserve-3d'
            }}
          >
            <div className="w-full h-full p-6 bg-[#0A0B0D]/50 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-2">📈</div>
                <div className="text-sm text-[#EC4899]">Live Charts</div>
              </div>
            </div>
          </div>

          {/* Screen 5 */}
          <div
            className="absolute w-[400px] h-[250px] bg-gradient-to-br from-[#8B5CF6]/25 to-[#6366F1]/25 rounded-2xl border border-white/10 shadow-2xl"
            style={{
              top: '40%',
              left: '50%',
              marginLeft: '-200px',
              transform: `rotateY(288deg) translateZ(400px)`,
              transformStyle: 'preserve-3d'
            }}
          >
            <div className="w-full h-full p-6 bg-[#0A0B0D]/50 backdrop-blur-md rounded-2xl flex items-center justify-center">
              <div className="text-center">
                <div className="text-4xl mb-2">💎</div>
                <div className="text-sm text-[#8B5CF6]">Portfolio</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content - Now with relative positioning to appear above background */}
      <div className="relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-[120px] py-6">
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo_white.png"
              alt="TokenLens Logo"
              width={40}
              height={40}
              className="object-contain h-10 w-auto"
              priority
            />
            <div className="flex flex-col justify-center">
              <span className="text-xl font-bold tracking-tight leading-none text-white">TokenLens</span>
              <span className="text-[10px] font-medium tracking-wide text-white/60 uppercase">Know Your Holders, Grow Your Token</span>
            </div>
          </div>

          <nav className="flex gap-12">
            <a href="#features" className="text-base text-[#A0A0B0] hover:text-white transition-colors">Features</a>
            <a href="/dashboard" className="text-base text-[#A0A0B0] hover:text-white transition-colors">Dashboard</a>
            <a href="/docs" className="text-base text-[#A0A0B0] hover:text-white transition-colors">Docs</a>
          </nav>

          <a href="/dashboard" className="px-7 py-3 bg-[#6366F1] hover:bg-[#5558E3] text-white text-[15px] font-semibold rounded-lg transition-all shadow-lg shadow-[#6366F1]/30">
            Launch App
          </a>
        </header>

        {/* Hero Section */}
        <section className="flex flex-col items-center px-[120px] py-[120px] gap-9 bg-gradient-to-b from-[#2D1B69]/20 via-[#1E1B4B]/40 to-[#0A0B0D]">
          {/* Badge */}
          <div className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-[#A78BFA]/20 rounded-full shadow-lg shadow-[#8B5CF6]/20">
            <span className="text-sm">✨</span>
            <span className="text-[13px] font-medium text-[#A78BFA]">Advanced Blockchain Analytics Platform</span>
          </div>

          {/* Headline */}
          <h1 className="text-[72px] font-bold leading-[1.05] tracking-[-0.125rem] text-center max-w-5xl bg-gradient-to-b from-white to-[#A78BFA] bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(139,92,246,0.4)]">
            Analytics for Your<br />ERC20 Tokens
          </h1>

          {/* Subheadline */}
          <p className="text-xl text-[#9CA3AF] text-center leading-[1.5] max-w-3xl">
            Track tokens, monitor vesting contracts, analyze whale movements,<br />
            and get actionable intelligence on your blockchain assets.
          </p>

          {/* CTA Buttons */}
          <div className="flex gap-4 mt-4">
            <a href="/dashboard" className="px-9 py-[18px] bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] hover:from-[#5558E3] hover:to-[#7C3AED] text-white text-[17px] font-semibold rounded-xl transition-all shadow-xl shadow-[#6366F1]/40">
              Launch Dashboard →
            </a>
            <a href="/docs" className="px-9 py-[18px] bg-white/10 hover:bg-white/15 border border-white/20 text-white text-[17px] font-semibold rounded-xl transition-all shadow-lg shadow-white/10">
              View Docs
            </a>
          </div>

          {/* Trust Badge */}
          <div className="mt-10 text-xs font-medium tracking-[0.125rem] text-[#6B7280]">
            TRUSTED BY BLOCKCHAIN INVESTORS
          </div>

          {/* Dashboard Preview */}
          <div className="w-[900px] h-[400px] mt-6 bg-white/[0.02] border-[1.5px] border-white/10 rounded-3xl flex items-center justify-center shadow-2xl shadow-[#8B5CF6]/20">
            <div className="w-full h-full p-8 bg-gradient-to-br from-[#6366F1]/10 via-[#8B5CF6]/10 to-[#EC4899]/10 rounded-[20px] flex flex-col gap-5">
              <div className="text-[11px] font-semibold tracking-[0.125rem] text-[#A78BFA] text-center">
                LIVE DASHBOARD PREVIEW
              </div>

              {/* Metric Cards */}
              <div className="flex-1 flex flex-col gap-4">
                <div className="flex items-center justify-between px-4 py-4 bg-[#6366F1]/10 rounded-xl shadow-lg shadow-[#6366F1]/10">
                  <span className="text-xs font-medium text-[#9CA3AF]">WHALE ALERTS</span>
                  <span className="text-lg font-bold text-[#6366F1]">24 Active</span>
                </div>
                <div className="flex items-center justify-between px-4 py-4 bg-[#10B981]/10 rounded-xl shadow-lg shadow-[#10B981]/10">
                  <span className="text-xs font-medium text-[#9CA3AF]">VESTING TRACKED</span>
                  <span className="text-lg font-bold text-[#10B981]">8 Contracts</span>
                </div>
                <div className="flex items-center justify-between px-4 py-4 bg-[#F59E0B]/10 rounded-xl shadow-lg shadow-[#F59E0B]/10">
                  <span className="text-xs font-medium text-[#9CA3AF]">HOLDERS</span>
                  <span className="text-lg font-bold text-[#F59E0B]">2,847</span>
                </div>
              </div>
            </div>
          </div>

          {/* Hero Stats Pills */}
          <div className="flex gap-10 mt-8 px-8 py-5 bg-white/5 border border-white/10 rounded-2xl">
            <div className="flex flex-col items-center gap-1">
              <span className="text-[13px] font-bold text-[#6366F1]">Real-Time</span>
              <span className="text-[11px] text-[#9CA3AF]">Updates</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[13px] font-bold text-[#10B981]">Multi-Chain</span>
              <span className="text-[11px] text-[#9CA3AF]">Support</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-[13px] font-bold text-[#F59E0B]">API Access</span>
              <span className="text-[11px] text-[#9CA3AF]">Included</span>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="flex flex-col items-center px-[120px] py-[100px] gap-[72px]">
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-5xl font-bold tracking-tight text-center drop-shadow-[0_4px_24px_rgba(255,255,255,0.1)]">
              Everything You Need to Track Blockchain Assets
            </h2>
            <p className="text-lg text-[#9CA3AF] text-center">
              Powerful analytics and monitoring tools built for serious blockchain investors and teams.
            </p>
          </div>

          <div className="w-full flex gap-6">
            {/* Feature 1 */}
            <div className="flex-1 flex flex-col gap-5 p-8 bg-gradient-to-b from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-xl shadow-[#6366F1]/25">
              <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-[#6366F1] to-[#8B5CF6] rounded-xl shadow-lg shadow-[#6366F1]/30">
                <span className="text-[28px]">📊</span>
              </div>
              <h3 className="text-2xl font-bold">TokenLens Analytics</h3>
              <p className="text-[15px] text-[#9CA3AF] leading-[1.6]">
                Real-time tracking of token balances, transfers, and supply metrics across Base network.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="flex-1 flex flex-col gap-5 p-8 bg-gradient-to-b from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-xl shadow-[#10B981]/25">
              <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-[#10B981] to-[#059669] rounded-xl shadow-lg shadow-[#10B981]/30">
                <span className="text-[28px]">🔒</span>
              </div>
              <h3 className="text-2xl font-bold">Vesting Monitor</h3>
              <p className="text-[15px] text-[#9CA3AF] leading-[1.6]">
                Track vesting contracts, beneficiaries, and unlock schedules with multi-contract support.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="flex-1 flex flex-col gap-5 p-8 bg-gradient-to-b from-white/8 to-white/3 border border-white/10 rounded-2xl shadow-xl shadow-[#F59E0B]/25">
              <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-[#F59E0B] to-[#D97706] rounded-xl shadow-lg shadow-[#F59E0B]/30">
                <span className="text-[28px]">🐋</span>
              </div>
              <h3 className="text-2xl font-bold">Whale Tracking</h3>
              <p className="text-[15px] text-[#9CA3AF] leading-[1.6]">
                Monitor large transfers, holder distribution, and exchange flows with automated alerts.
              </p>
            </div>
          </div>
        </section>

        {/* Analytics Showcase */}
        <section className="flex flex-col items-center px-[120px] py-[100px] gap-14 bg-gradient-to-b from-transparent via-[#1E1B4B]/20 to-transparent">
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-5xl font-bold tracking-tight text-center drop-shadow-[0_4px_24px_rgba(255,255,255,0.1)]">
              Advanced Analytics Dashboard
            </h2>
            <p className="text-lg text-[#9CA3AF] text-center">
              Get comprehensive insights with real-time data visualization and intelligent alerts.
            </p>
          </div>

          <div className="w-full h-[500px] bg-white/5 border-2 border-white/10 rounded-[20px] flex items-center justify-center shadow-2xl shadow-[#6366F1]/20">
            <div className="w-full h-full p-12 bg-gradient-to-br from-[#6366F1]/8 to-[#8B5CF6]/8 rounded-[20px] flex flex-col items-center justify-center gap-6">
              <p className="text-xl text-[#6B7280] text-center leading-[1.8]">
                Dashboard Screenshot Placeholder<br />
                [Charts, Analytics, Whale Movements]
              </p>

              {/* Chart Bars */}
              <div className="flex flex-col gap-4 w-full max-w-2xl">
                <div className="h-2 bg-gradient-to-r from-[#6366F1] to-[#8B5CF6] rounded w-[600px]" />
                <div className="h-2 bg-gradient-to-r from-[#10B981] to-[#059669] rounded w-[400px]" />
                <div className="h-2 bg-gradient-to-r from-[#F59E0B] to-[#D97706] rounded w-[500px]" />
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="flex justify-center gap-20 px-[120px] py-20 bg-gradient-to-b from-[#0A0B0D] via-[#1E1B4B]/20 to-[#0A0B0D]">
          <div className="flex flex-col items-center gap-2">
            <div className="text-[56px] font-bold tracking-[-0.125rem] drop-shadow-[0_2px_16px_rgba(99,102,241,0.25)]">10M+</div>
            <div className="text-base text-[#9CA3AF]">Transactions Tracked</div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="text-[56px] font-bold tracking-[-0.125rem] drop-shadow-[0_2px_16px_rgba(16,185,129,0.25)]">99.9%</div>
            <div className="text-base text-[#9CA3AF]">Uptime Reliability</div>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="text-[56px] font-bold tracking-[-0.125rem] drop-shadow-[0_2px_16px_rgba(245,158,11,0.25)]">&lt;5s</div>
            <div className="text-base text-[#9CA3AF]">Average Load Time</div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="flex flex-col items-center px-[120px] py-[100px] gap-9 mx-[120px] my-20 bg-gradient-to-br from-[#6366F1] via-[#8B5CF6] to-[#EC4899] rounded-[32px] shadow-2xl shadow-[#6366F1]/30">
          <h2 className="text-5xl font-bold tracking-tight text-center drop-shadow-[0_4px_24px_rgba(255,255,255,0.1)]">
            Ready to Unlock Blockchain Intelligence?
          </h2>
          <p className="text-xl text-white/90 text-center">
            Join leading investors and teams who trust our platform for real-time blockchain analytics.
          </p>
          <a href="/dashboard" className="px-12 py-5 bg-white hover:bg-gray-100 text-[#6366F1] text-lg font-bold rounded-xl transition-all shadow-xl shadow-black/25">
            Launch Dashboard →
          </a>
        </section>

        {/* Footer */}
        <footer className="px-[120px] py-[60px] flex flex-col gap-12 bg-gradient-to-b from-[#0A0B0D] via-[#1E1B4B]/30 to-[#0A0B0D]">
          <div className="flex justify-between">
            {/* Brand */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-2">
                <Image
                  src="/images/logo_white.png"
                  alt="TokenLens Logo"
                  width={32}
                  height={32}
                  className="object-contain h-8 w-auto"
                />
                <div className="flex flex-col justify-center">
                  <span className="text-lg font-bold tracking-tight leading-none text-white">TokenLens</span>
                  <span className="text-[9px] font-medium tracking-wide text-white/50 uppercase">Know Your Holders, Grow Your Token</span>
                </div>
              </div>
              <p className="text-sm text-[#6B7280] leading-[1.6]">
                Advanced token analytics<br />
                for ERC20 tokens
              </p>
            </div>

            {/* Links */}
            <div className="flex gap-20">
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold">Product</h4>
                <a href="#features" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">Features</a>
                <a href="/dashboard" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">Dashboard</a>
                <a href="/docs" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">Documentation</a>
              </div>
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold">Company</h4>
                <a href="#" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">About</a>
                <a href="#" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">Blog</a>
                <a href="#" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">Contact</a>
              </div>
              <div className="flex flex-col gap-4">
                <h4 className="text-sm font-semibold">Legal</h4>
                <a href="#" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">Privacy Policy</a>
                <a href="#" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">Terms of Service</a>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/10" />

          {/* Bottom */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-[#6B7280]">© 2025 TokenLens. All rights reserved.</p>
            <div className="flex gap-6">
              <a href="#" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">Twitter</a>
              <a href="#" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">GitHub</a>
              <a href="#" className="text-sm text-[#9CA3AF] hover:text-white transition-colors">Discord</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
