'use client';

import { useState } from "react";
import { useAppStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signIn } from "next-auth/react";
import {
  Bot,
  Shield,
  Database,
  Smartphone,
  Zap,
  Layers,
  Rocket,
  Check,
  Loader2,
  ArrowRight,
  Sparkles,
  MessageSquare,
  Globe,
} from "lucide-react";
import { motion } from "framer-motion";

export function LandingView() {
  const { setView, setUser, setIsAuthenticated } = useAppStore();
  const [showAuth, setShowAuth] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAuth = async () => {
    setLoading(true);
    setError("");

    try {
      if (isSignUp) {
        // Register
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Registration failed");
          setLoading(false);
          return;
        }
      }

      // Sign in via NextAuth
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid credentials");
        setLoading(false);
        return;
      }

      // Get user data from our login endpoint
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (loginRes.ok) {
        const userData = await loginRes.json();
        setUser({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          plan: userData.plan,
        });
        setIsAuthenticated(true);
        setView("dashboard");
        setShowAuth(false);
      } else {
        setError("Login failed");
      }
    } catch (err) {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setLoading(true);
    try {
      // Try to create demo user first
      await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Demo User",
          email: "demo@agentforge.io",
          password: "demo123",
        }),
      });

      // Sign in via NextAuth
      await signIn("credentials", {
        email: "demo@agentforge.io",
        password: "demo123",
        redirect: false,
      });

      // Get user data
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "demo@agentforge.io", password: "demo123" }),
      });

      if (loginRes.ok) {
        const userData = await loginRes.json();
        setUser({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          plan: userData.plan,
        });
        setIsAuthenticated(true);
        setView("dashboard");
      }
    } catch (err) {
      setError("Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAdminLogin = async () => {
    setLoading(true);
    try {
      await signIn("credentials", {
        email: "admin@agentforge.io",
        password: "admin123",
        redirect: false,
      });

      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@agentforge.io", password: "admin123" }),
      });

      if (loginRes.ok) {
        const userData = await loginRes.json();
        setUser({
          id: userData.id,
          name: userData.name,
          email: userData.email,
          role: userData.role,
          plan: userData.plan,
        });
        setIsAuthenticated(true);
        setView("dashboard");
      }
    } catch (err) {
      setError("Admin login failed");
    } finally {
      setLoading(false);
    }
  };

  const features = [
    {
      icon: <Shield className="w-6 h-6" />,
      title: "Isolated Sandboxes",
      description:
        "Each agent runs in its own secure container with full isolation and resource limits.",
    },
    {
      icon: <Database className="w-6 h-6" />,
      title: "Knowledge Base",
      description:
        "Upload documents, URLs, and text to give your agents custom knowledge and context.",
    },
    {
      icon: <Smartphone className="w-6 h-6" />,
      title: "Telegram Integration",
      description:
        "Connect agents to Telegram bots with one click. Your AI is just a message away.",
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: "Multi-Model Support",
      description:
        "Choose from Groq, NVIDIA NIM, and more. Switch models to match your needs and budget.",
    },
    {
      icon: <Layers className="w-6 h-6" />,
      title: "6-Layer Architecture",
      description:
        "Built on a robust stack: Load Balancer, API Gateway, Orchestration, Agent Runtime, Sandbox, and Storage.",
    },
    {
      icon: <MessageSquare className="w-6 h-6" />,
      title: "Live Chat Preview",
      description:
        "Test your agent in real-time as you configure it. See changes instantly in the preview panel.",
    },
  ];

  const plans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Get started with one agent",
      features: ["1 Agent", "Basic models", "100 messages/day", "Community support"],
      cta: "Get Started Free",
      popular: false,
    },
    {
      name: "Pro",
      price: "$29",
      period: "/month",
      description: "For power users and small teams",
      features: [
        "10 Agents",
        "All Groq + NVIDIA NIM models",
        "Unlimited messages",
        "Telegram integration",
        "Knowledge base (50MB)",
        "Priority support",
      ],
      cta: "Start Pro Trial",
      popular: true,
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For organizations at scale",
      features: [
        "Unlimited Agents",
        "Custom model endpoints",
        "SSO / SAML",
        "Dedicated infrastructure",
        "SLA guarantee",
        "24/7 support",
      ],
      cta: "Contact Sales",
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-background to-emerald-50/50 dark:from-emerald-950/20 dark:via-background dark:to-emerald-950/10" />
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-200/30 dark:bg-emerald-800/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-100/30 dark:bg-emerald-900/10 rounded-full blur-3xl translate-y-1/4 -translate-x-1/4" />

        <div className="relative max-w-6xl mx-auto px-4 py-20 md:py-32">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-sm font-medium mb-6">
              <Sparkles className="w-4 h-4" />
              Self-hosted AI Agent Builder
            </div>
            <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
              Build Your Own
              <br />
              <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">
                AI Agents
              </span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Create, configure, and deploy custom AI agents with isolated sandboxes,
              knowledge bases, and Telegram integration — all self-hosted.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-700 gap-2 px-8"
                onClick={() => {
                  setIsSignUp(true);
                  setShowAuth(true);
                }}
              >
                <Rocket className="w-5 h-5" />
                Get Started Free
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="gap-2 px-8"
                onClick={handleDemoLogin}
                disabled={loading}
              >
                <Globe className="w-5 h-5" />
                View Demo
              </Button>
            </div>

            {/* Quick login hint */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <span className="text-xs text-muted-foreground">Quick access:</span>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={handleDemoLogin}
                disabled={loading}
              >
                Demo User
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7"
                onClick={handleAdminLogin}
                disabled={loading}
              >
                Admin User
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-3">
              Everything you need to build AI agents
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              A complete platform for creating, deploying, and managing custom AI
              agents at any scale.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-shadow duration-300 hover:border-emerald-200 dark:hover:border-emerald-800">
                  <CardHeader>
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                      {feature.icon}
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold mb-3">6-Layer Architecture</h2>
            <p className="text-muted-foreground mb-8">
              Built on a robust, scalable infrastructure designed for production workloads.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-w-lg mx-auto">
              {[
                "Load Balancer",
                "API Gateway",
                "Orchestration",
                "Agent Runtime",
                "Sandbox",
                "Storage",
              ].map((layer, i) => (
                <motion.div
                  key={layer}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="bg-background rounded-lg p-3 border border-border hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors"
                >
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium mb-1">
                    Layer {i + 1}
                  </div>
                  <div className="text-sm font-semibold">{layer}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-3">Simple Pricing</h2>
            <p className="text-muted-foreground">
              Start free and scale as you grow.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card
                  className={`h-full relative ${
                    plan.popular
                      ? "border-emerald-300 dark:border-emerald-700 shadow-lg"
                      : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-emerald-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-4xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground text-sm">
                        {plan.period}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.description}
                    </p>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter>
                    <Button
                      className={`w-full ${
                        plan.popular
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : ""
                      }`}
                      variant={plan.popular ? "default" : "outline"}
                      onClick={() => {
                        if (plan.name === "Enterprise") return;
                        setIsSignUp(true);
                        setShowAuth(true);
                      }}
                    >
                      {plan.cta}
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-foreground">AgentForge</span>
          </div>
          <p>© 2025 AgentForge. Self-hosted AI agent builder.</p>
        </div>
      </footer>

      {/* Auth Dialog */}
      <Dialog open={showAuth} onOpenChange={setShowAuth}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isSignUp ? "Create an Account" : "Welcome Back"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAuth()}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <Button
              onClick={handleAuth}
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {isSignUp ? "Create Account" : "Sign In"}
            </Button>
            <div className="text-center text-sm text-muted-foreground">
              {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
              <button
                className="text-emerald-600 hover:underline font-medium"
                onClick={() => {
                  setIsSignUp(!isSignUp);
                  setError("");
                }}
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
