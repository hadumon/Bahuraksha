import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  Waves,
  Mountain,
  ArrowRight,
  Newspaper,
  TrendingUp,
  Users,
  Activity,
  Radio,
  Droplets,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PublicNavbar } from "@/components/layout/PublicNavbar";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const blogPosts = [
  {
    id: 1,
    title: "The Devastating Impact of Monsoon Floods in Nepal",
    excerpt:
      "Every year, monsoon floods affect thousands of families across Nepal's river basins. In 2024 alone, over 250 people lost their lives and property damage exceeded NPR 5 billion.",
    image: "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=800&q=80",
    category: "Floods",
    date: "2024",
    stats: "250+ Lives Lost",
    color: "from-ocean-400 to-ocean-600",
  },
  {
    id: 2,
    title: "Landslides: Nepal's Silent Killer During Rains",
    excerpt:
      "Nepal's mountainous terrain makes it highly susceptible to landslides. During the 2023 monsoon, over 400 landslide events were recorded, destroying homes and infrastructure in rural communities.",
    image: "https://images.unsplash.com/photo-1523990096895-a0e9f4e45c9e?w=800&q=80",
    category: "Landslides",
    date: "2023",
    stats: "400+ Events",
    color: "from-risk-watch to-risk-warning",
  },
  {
    id: 3,
    title: "Glacial Lake Outburst Floods (GLOF) Threat",
    excerpt:
      "With over 2,000 glacial lakes in Nepal, 21 are identified as potentially dangerous. The 1985 Dig Tsho GLOF destroyed the Namche Hydel Project and caused massive downstream damage.",
    image: "https://images.unsplash.com/photo-1517021897933-0e0319cfbc28?w=800&q=80",
    category: "GLOF",
    date: "Ongoing Risk",
    stats: "21 Dangerous Lakes",
    color: "from-ocean-300 to-ocean-500",
  },
  {
    id: 4,
    title: "Earthquakes: Nepal's Seismic Reality",
    excerpt:
      "The 2015 Gorkha earthquake killed nearly 9,000 people and injured over 22,000. Nepal lies in one of the most seismically active regions of the world, making earthquake preparedness critical.",
    image: "https://images.unsplash.com/photo-1454789548728-85d2696cfbaf?w=800&q=80",
    category: "Earthquakes",
    date: "2015",
    stats: "9,000 Lives Lost",
    color: "from-risk-evacuate to-risk-warning",
  },
];

const yearlyStats = [
  {
    icon: Waves,
    value: "1,500+",
    label: "Annual Flood Events",
    description: "Average yearly flood incidents across Nepal",
    color: "bg-ocean-400/20 text-ocean-400",
  },
  {
    icon: Mountain,
    value: "400+",
    label: "Landslides per Year",
    description: "During monsoon season alone",
    color: "bg-risk-watch/20 text-risk-watch",
  },
  {
    icon: AlertTriangle,
    value: "NPR 10B+",
    label: "Economic Loss",
    description: "Annual damage from disasters",
    color: "bg-risk-warning/20 text-risk-warning",
  },
  {
    icon: Users,
    value: "500K+",
    label: "People Affected",
    description: "Yearly disaster impact",
    color: "bg-risk-safe/20 text-risk-safe",
  },
];

const features = [
  {
    icon: Activity,
    title: "Real-time Monitoring",
    description: "Live data from 25+ river gauge stations across Bagmati Basin",
    gradient: "from-ocean-400/20 to-ocean-500/10",
    iconBg: "bg-ocean-400/20 text-ocean-400",
  },
  {
    icon: Shield,
    title: "Risk Assessment",
    description: "AI-powered flood and landslide risk prediction models",
    gradient: "from-risk-safe/20 to-risk-safe/10",
    iconBg: "bg-risk-safe/20 text-risk-safe",
  },
  {
    icon: Newspaper,
    title: "Citizen Reporting",
    description: "Community-powered ground truth verification system",
    gradient: "from-ocean-300/20 to-ocean-400/10",
    iconBg: "bg-ocean-300/20 text-ocean-300",
  },
  {
    icon: TrendingUp,
    title: "48h Predictions",
    description: "Advanced forecasting with 87% model accuracy",
    gradient: "from-risk-watch/20 to-risk-watch/10",
    iconBg: "bg-risk-watch/20 text-risk-watch",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PublicNavbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-44 lg:pb-32 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]" />
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-ocean-400/10 rounded-full blur-[120px] animate-pulse-slow" />
          <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-ocean-600/10 rounded-full blur-[100px]" />
          <div className="absolute inset-0 opacity-50" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%230ea5e9' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="text-center max-w-4xl mx-auto"
          >
            <motion.div
              variants={fadeInUp}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ocean-400/10 border border-ocean-400/20 text-ocean-400 text-sm font-medium mb-6"
            >
              <Radio className="w-4 h-4 animate-pulse" />
              Live Monitoring Active
            </motion.div>

            <motion.h1
              variants={fadeInUp}
              className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6"
            >
              Disaster Intelligence for{" "}
              <span className="bg-gradient-to-r from-ocean-400 to-ocean-300 bg-clip-text text-transparent">
                Bagmati Basin
              </span>
            </motion.h1>

            <motion.p
              variants={fadeInUp}
              className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
            >
              Real-time flood and landslide monitoring powered by AI, satellite
              imagery, and community reports. Protecting over{" "}
              <span className="text-foreground font-medium">2.7 million lives</span>{" "}
              across Nepal's most vulnerable river basin.
            </motion.p>

            <motion.div
              variants={fadeInUp}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            >
              <Link to="/dashboard">
                <Button size="lg" className="text-base gap-2 px-8 shadow-glow">
                  <Droplets className="w-4 h-4" />
                  View Live Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="/#about">
                <Button size="lg" variant="outline" className="text-base px-8">
                  Learn More
                </Button>
              </a>
            </motion.div>

            {/* Live Stats */}
            <motion.div
              variants={fadeInUp}
              className="mt-16 flex flex-wrap items-center justify-center gap-8 text-sm"
            >
              {[
                { label: "Active Stations", value: "25+" },
                { label: "Model Accuracy", value: "87%" },
                { label: "Response Time", value: "Real-time" },
              ].map((stat) => (
                <div key={stat.label} className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-ocean-400 animate-pulse" />
                  <span className="text-muted-foreground">{stat.label}:</span>
                  <span className="font-semibold text-foreground">{stat.value}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="about" className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ocean-400/5 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">The Cost of Disasters in Nepal</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every year, natural disasters claim hundreds of lives and cause
              billions in economic damage across Nepal's vulnerable communities.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {yearlyStats.map((stat, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="group relative rounded-2xl p-6 border border-border/50 bg-gradient-to-br from-card to-secondary/30 hover:border-ocean-400/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-ocean-400/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                <div className={cn("relative w-12 h-12 rounded-xl flex items-center justify-center mb-4", stat.color)}>
                  <stat.icon className="w-6 h-6" />
                </div>

                <div className="relative">
                  <div className="text-3xl font-bold mb-1 bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                    {stat.value}
                  </div>
                  <div className="text-sm font-medium text-foreground mb-1">
                    {stat.label}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stat.description}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl font-bold mb-4">How Bahuraksha Helps</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our platform combines satellite data, weather forecasts, and
              community reports to provide early warning and real-time monitoring.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {features.map((feature, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="group relative rounded-2xl p-6 border border-border/50 bg-gradient-to-br from-card to-secondary/30 hover:border-ocean-400/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-elevated overflow-hidden"
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity", feature.gradient)} />

                <div className="relative">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center mb-4 transition-colors", feature.iconBg)}>
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-semibold mb-2 text-foreground">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Blog Section */}
      <section id="blog" className="py-20 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ocean-400/5 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-4"
          >
            <div>
              <h2 className="text-3xl font-bold mb-4">Disaster Stories</h2>
              <p className="text-muted-foreground max-w-xl">
                Understanding Nepal's vulnerability to natural disasters through
                real events and data-driven insights.
              </p>
            </div>
            <Link
              to="/blog"
              className="text-ocean-400 font-medium hover:text-ocean-300 flex items-center gap-1 transition-colors group"
            >
              View All Stories
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {blogPosts.map((post, index) => (
              <motion.article
                key={post.id}
                variants={fadeInUp}
                className="group relative rounded-2xl overflow-hidden border border-border/50 bg-card hover:border-ocean-400/30 transition-all duration-300 hover:shadow-elevated"
              >
                <div className="relative h-56 overflow-hidden">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/50 to-transparent" />

                  <div className="absolute top-4 left-4">
                    <span className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r shadow-lg",
                      post.color
                    )}>
                      {post.category}
                    </span>
                  </div>

                  <div className="absolute bottom-4 right-4">
                    <span className="px-3 py-1.5 rounded-full bg-card/90 backdrop-blur text-foreground text-xs font-medium border border-border">
                      {post.stats}
                    </span>
                  </div>
                </div>

                <div className="p-6">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
                    <span className="px-2 py-0.5 rounded bg-secondary/50">{post.date}</span>
                  </div>

                  <h3 className="text-xl font-semibold mb-3 group-hover:text-ocean-400 transition-colors line-clamp-2">
                    {post.title}
                  </h3>

                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {post.excerpt}
                  </p>

                  <button className="text-sm font-medium text-ocean-400 flex items-center gap-1 group/btn hover:text-ocean-300 transition-colors">
                    Read More
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl p-8 md:p-12 lg:p-16 overflow-hidden"
          >
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-gradient-to-br from-ocean-500 to-ocean-700" />
              <div className="absolute inset-0 opacity-30" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='%23ffffff' fill-opacity='0.05'/%3E%3C/svg%3E")` }} />
              <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-white/10 rounded-full blur-[150px]" />
              <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/5 rounded-full blur-[100px]" />
            </div>

            <div className="relative max-w-2xl">
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Ready to Protect Your Community?
              </h2>
              <p className="text-ocean-100 mb-8 text-lg">
                Join thousands of citizens and emergency responders using Bahuraksha
                to stay informed and prepared for natural disasters in Nepal.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/dashboard">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="text-base w-full sm:w-auto gap-2"
                  >
                    Access Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-base w-full sm:w-auto border-white/30 text-white hover:bg-white/10"
                  >
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2 group">
              <img 
                src="/Bahuraksha%20logo.svg" 
                alt="Bahuraksha Logo" 
                className="w-8 h-8 object-contain group-hover:scale-105 transition-transform"
              />
              <span className="font-bold">BAHURAKSHA</span>
            </Link>

            <p className="text-sm text-muted-foreground text-center">
              © 2024 Bahuraksha. Protecting Nepal's communities through disaster
              intelligence.
            </p>

            <div className="flex items-center gap-6">
              <Link
                to="/about"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                About
              </Link>
              <Link
                to="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
