import { useNavigate } from 'react-router-dom';
import { Video, Mic, Calendar, Film, Instagram, Camera, CheckCircle, ShieldCheck, Award, ArrowRight, MapPin } from 'lucide-react';

export function JoinAsCreator({ dark }) {
  const navigate = useNavigate();

  const textSub = dark ? 'text-charcoal-300' : 'text-gray-500';
  const cardCls = `rounded-2xl border p-6 shadow-[0_24px_80px_rgba(0,0,0,0.16)] transition-all duration-300 hover:scale-[1.02] ${
    dark ? 'bg-charcoal-900/72 border-white/[0.07] hover:border-gold-500/30' : 'bg-white border-gray-200 hover:border-gold-500/50'
  }`;

  return (
    <div className={`min-h-screen pb-20 ${dark ? 'bg-charcoal-950 bg-[radial-gradient(circle_at_50%_0%,rgba(212,169,65,0.08),transparent_34%)]' : 'bg-gray-50'}`}>
      
      {/* Hero Section */}
      <section className="relative max-w-5xl mx-auto px-4 pt-16 pb-12 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-gold-500/30 bg-gold-500/10 text-[10px] font-bold uppercase tracking-widest text-gold-400 mb-6">
          <Award size={10} /> Creator Onboarding Open
        </div>
        <h1 className={`font-display font-black text-4xl sm:text-5xl md:text-6xl tracking-tight leading-[1.08] mb-6 max-w-3xl mx-auto ${dark ? 'text-white' : 'text-gray-900'}`}>
          Get Paid for the Work <br />
          <span className="bg-gradient-to-r from-gold-400 via-gold-500 to-gold-300 bg-clip-text text-transparent">
            You Already Do.
          </span>
        </h1>
        <p className={`text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-8 font-light ${textSub}`}>
          We connect videographers, podcast producers, event coverage crews, brand film directors, and social media content creators directly with clients in need of professional media production.
        </p>
        <button
          onClick={() => navigate('/register')}
          className="px-8 py-4 rounded-full bg-gold-500 hover:bg-gold-600 text-charcoal-950 font-bold text-sm transition-all shadow-[0_4px_24px_rgba(212,169,65,0.3)] hover:scale-105 inline-flex items-center gap-2"
        >
          Apply as a Creator <ArrowRight size={16} />
        </button>
      </section>

      {/* Niches We Serve */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className={`font-display font-bold text-2xl sm:text-3xl mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
            Niches We Serve
          </h2>
          <p className={`text-xs ${textSub}`}>We specialize in professional freelance content production categories.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className={cardCls}>
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 text-gold-400 flex items-center justify-center mb-4">
              <Video size={20} />
            </div>
            <h3 className={`font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Video Production</h3>
            <p className={`text-xs leading-relaxed ${textSub}`}>From raw clips to fully edited social videos and product spots.</p>
          </div>
          <div className={cardCls}>
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 text-gold-400 flex items-center justify-center mb-4">
              <Mic size={20} />
            </div>
            <h3 className={`font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Podcast Production</h3>
            <p className={`text-xs leading-relaxed ${textSub}`}>Professional audio capture, editing, mastering, and episode formatting.</p>
          </div>
          <div className={cardCls}>
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 text-gold-400 flex items-center justify-center mb-4">
              <Calendar size={20} />
            </div>
            <h3 className={`font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Corporate Event Coverage</h3>
            <p className={`text-xs leading-relaxed ${textSub}`}>On-site photography and highlights to document summits, panels, and events.</p>
          </div>
          <div className={cardCls}>
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 text-gold-400 flex items-center justify-center mb-4">
              <Film size={20} />
            </div>
            <h3 className={`font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Brand Films</h3>
            <p className={`text-xs leading-relaxed ${textSub}`}>Cinematic founder stories, documentaries, and overview profiles.</p>
          </div>
          <div className={cardCls}>
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 text-gold-400 flex items-center justify-center mb-4">
              <Instagram size={20} />
            </div>
            <h3 className={`font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Social Media Content</h3>
            <p className={`text-xs leading-relaxed ${textSub}`}>Optimized vertical reels, TikTok clips, captions, and platform-native stills.</p>
          </div>
          <div className={cardCls}>
            <div className="w-10 h-10 rounded-xl bg-gold-500/10 text-gold-400 flex items-center justify-center mb-4">
              <Camera size={20} />
            </div>
            <h3 className={`font-bold text-base mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Photography</h3>
            <p className={`text-xs leading-relaxed ${textSub}`}>High-resolution portrait headshots, commercial products, and lifestyle imagery.</p>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h2 className={`font-display font-bold text-2xl sm:text-3xl mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>
            How It Works
          </h2>
          <p className={`text-xs ${textSub}`}>A straightforward matching and payment experience from start to finish.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={`${cardCls} relative overflow-hidden`}>
            <div className="absolute top-4 right-4 text-3xl font-black text-gold-500/10">01</div>
            <h3 className={`font-bold text-base mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>Register & Get Verified</h3>
            <p className={`text-xs leading-relaxed ${textSub}`}>
              Submit your portfolio and service rates. Pass review to enter the Launch, Proven, Elite, or Signature reputation tiers.
            </p>
          </div>
          <div className={`${cardCls} relative overflow-hidden`}>
            <div className="absolute top-4 right-4 text-3xl font-black text-gold-500/10">02</div>
            <h3 className={`font-bold text-base mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>Get Matched</h3>
            <p className={`text-xs leading-relaxed ${textSub}`}>
              Receive direct quote requests and review available client project board briefs tailored to your skills.
            </p>
          </div>
          <div className={`${cardCls} relative overflow-hidden`}>
            <div className="absolute top-4 right-4 text-3xl font-black text-gold-500/10">03</div>
            <h3 className={`font-bold text-base mb-2 ${dark ? 'text-white' : 'text-gray-900'}`}>Quote & Get Paid</h3>
            <p className={`text-xs leading-relaxed ${textSub}`}>
              Submit project scopes and secure contract budgets through Stripe Connect payouts, split 50/50 automatically.
            </p>
          </div>
        </div>
      </section>

      {/* What You Earn */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <div className={`rounded-2xl border p-8 grid grid-cols-1 md:grid-cols-2 gap-8 items-center ${
          dark ? 'bg-charcoal-900/40 border-white/[0.07]' : 'bg-white border-gray-200'
        }`}>
          <div>
            <h2 className={`font-display font-bold text-2xl sm:text-3xl mb-4 leading-tight ${dark ? 'text-white' : 'text-gray-900'}`}>
              Earn More with the <br />
              <span className="text-gold-400">Loyalty Fee Program</span>
            </h2>
            <p className={`text-xs leading-relaxed mb-4 ${textSub}`}>
              CreatorBridge keeps fees low so you retain more revenue. Launch tier creators keep 90% of every project budget, increasing to 95% at the Elite and Signature tiers as you build your rating.
            </p>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-gold-400 shrink-0" />
                <span>50% upfront retainer paid when client accepts quote</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-gold-400 shrink-0" />
                <span>50% final payment paid instantly on project approval</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle size={14} className="text-gold-400 shrink-0" />
                <span>No platform subscription or bidding credits required</span>
              </li>
            </ul>
          </div>
          <div className={`p-6 rounded-xl border ${dark ? 'bg-charcoal-950/65 border-white/[0.08]' : 'bg-gray-50 border-gray-200'}`}>
            <h3 className={`font-bold text-xs uppercase tracking-wider mb-4 ${dark ? 'text-gold-400' : 'text-gold-600'}`}>Payout Comparison Example</h3>
            <div className="space-y-3 font-mono text-xs">
              <div className="flex justify-between border-b border-gray-800/40 pb-2">
                <span>Client Project Budget</span>
                <span className="font-bold text-white">$1,000.00</span>
              </div>
              <div className="flex justify-between border-b border-gray-800/40 pb-2 text-charcoal-300">
                <span>Launch Payout (90%)</span>
                <span>$900.00</span>
              </div>
              <div className="flex justify-between border-b border-gray-800/40 pb-2 text-charcoal-300">
                <span>Signature Payout (95%)</span>
                <span>$950.00</span>
              </div>
              <p className={`text-[10px] leading-relaxed pt-2 ${textSub}`}>
                Payouts are routed directly to your connected bank account through Stripe Connect. Platform fees automatically decrease as you complete projects.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Signals */}
      <section className="max-w-5xl mx-auto px-4 py-12 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 text-center">
        <div className="p-4">
          <div className="w-8 h-8 rounded-full bg-gold-500/10 text-gold-400 flex items-center justify-center mx-auto mb-3">
            <MapPin size={16} />
          </div>
          <h4 className={`font-bold text-xs mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Phoenix Based</h4>
          <p className={`text-[10px] ${textSub}`}>Operating and serving teams from Phoenix, AZ.</p>
        </div>
        <div className="p-4">
          <div className="w-8 h-8 rounded-full bg-gold-500/10 text-gold-400 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck size={16} />
          </div>
          <h4 className={`font-bold text-xs mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Stripe Secured</h4>
          <p className={`text-[10px] ${textSub}`}>Secure payment hold & Express onboarding.</p>
        </div>
        <div className="p-4">
          <div className="w-8 h-8 rounded-full bg-gold-500/10 text-gold-400 flex items-center justify-center mx-auto mb-3">
            <Award size={16} />
          </div>
          <h4 className={`font-bold text-xs mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>Reputation Tiers</h4>
          <p className={`text-[10px] ${textSub}`}>Verify experience with clear user ratings.</p>
        </div>
        <div className="p-4">
          <div className="w-8 h-8 rounded-full bg-gold-500/10 text-gold-400 flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={16} />
          </div>
          <h4 className={`font-bold text-xs mb-1 ${dark ? 'text-white' : 'text-gray-900'}`}>No Subscriptions</h4>
          <p className={`text-[10px] ${textSub}`}>Free registration. We only succeed when you do.</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className={`font-display font-bold text-3xl sm:text-4xl mb-3 ${dark ? 'text-white' : 'text-gray-900'}`}>
          Apply Today
        </h2>
        <p className={`text-sm max-w-md mx-auto mb-6 ${textSub}`}>
          Registration is free. Your first production match is waiting.
        </p>
        <button
          onClick={() => navigate('/register')}
          className="px-8 py-4 rounded-full bg-gold-500 hover:bg-gold-600 text-charcoal-950 font-bold text-sm transition-all shadow-[0_4px_24px_rgba(212,169,65,0.3)] hover:scale-105"
        >
          Apply as a Creator
        </button>
      </section>

    </div>
  );
}
