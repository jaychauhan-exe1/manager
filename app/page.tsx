import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck, Zap, Globe } from "lucide-react";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-background selection:bg-primary/30">
      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-8">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
          </span>
          Next-Gen Authentication Ready
        </div>
        
        <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
          Manage Everything <br /> <span className="text-primary italic">Faster.</span>
        </h1>
        
        <p className="max-w-2xl text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
          The ultimate boilerplate for project managers. Secured by Better Auth, powered by Neon DB, and styled with stunning HSL colors.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/register">
            <Button size="lg" className="h-14 px-8 text-lg font-semibold bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              Get Started Free
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          <Link href="/login">
            <Button size="lg" variant="outline" className="h-14 px-8 text-lg font-semibold border-primary/20">
              Sign In
            </Button>
          </Link>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 max-w-5xl w-full">
          {[
            { icon: <ShieldCheck className="w-8 h-8 text-primary" />, title: "Secure by Design", desc: "Better Auth handles the heavy lifting of security so you don't have to." },
            { icon: <Zap className="w-8 h-8 text-primary" />, title: "Lightning Fast", desc: "Optimized for performance with Next.js App Router and Edge-ready Neon DB." },
            { icon: <Globe className="w-8 h-8 text-primary" />, title: "Modern Styling", desc: "Crafted with HSL colors and shadcn/ui for a premium look and feel." }
          ].map((feature, i) => (
            <div key={i} className="flex flex-col items-center p-6 rounded-2xl border border-border bg-card">
              <div className="mb-4 p-3 rounded-xl bg-muted">{feature.icon}</div>
              <h3 className="text-xl font-bold mb-2 text-foreground">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50 bg-card/30 animate-fade-in-up [animation-delay:400ms]">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary" />
            <span className="font-bold tracking-tight">Manager.</span>
          </div>
          <p className="text-sm text-muted-foreground">
            &copy; 2026 Antigravity Labs. All rights reserved.
          </p>
          <div className="flex gap-6 text-sm text-muted-foreground">
            <Link href="#" className="hover:text-primary transition-colors">Privacy</Link>
            <Link href="#" className="hover:text-primary transition-colors">Terms</Link>
            <Link href="#" className="hover:text-primary transition-colors">Github</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

