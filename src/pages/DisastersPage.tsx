import { motion } from "framer-motion";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
import { Waves, Mountain, AlertTriangle, Users, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
};

const staggerContainer = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
    },
  },
};

const disasterTypes = [
  {
    title: "Floods",
    icon: Waves,
    description: "Monsoon rains frequently cause major rivers to overflow, impacting lowland regions and causing widespread agricultural damage.",
    color: "from-ocean-400 to-ocean-600",
    iconBg: "bg-ocean-400/20 text-ocean-400",
    stats: [
      { label: "Annual Events", value: "1,500+" },
      { label: "High Risk Zones", value: "Terai Region" },
    ]
  },
  {
    title: "Landslides",
    icon: Mountain,
    description: "The steep, fragile topography of the hills and mountains makes Nepal highly susceptible to landslides, particularly during the monsoon.",
    color: "from-risk-watch to-risk-warning",
    iconBg: "bg-risk-watch/20 text-risk-watch",
    stats: [
      { label: "Yearly Incidents", value: "400+" },
      { label: "Vulnerable Areas", value: "Hilly Regions" },
    ]
  },
  {
    title: "Glacial Lake Outbursts",
    icon: AlertTriangle,
    description: "Rapid melting of glaciers forms lakes that can burst, sending catastrophic flash floods downstream with little warning.",
    color: "from-ocean-300 to-ocean-500",
    iconBg: "bg-ocean-300/20 text-ocean-300",
    stats: [
      { label: "Dangerous Lakes", value: "21" },
      { label: "Primary Threat", value: "Himalayas" },
    ]
  },
  {
    title: "Earthquakes",
    icon: Users,
    description: "Located on a major fault line, Nepal experiences frequent seismic activity requiring constant preparedness.",
    color: "from-risk-evacuate to-risk-warning",
    iconBg: "bg-risk-evacuate/20 text-risk-evacuate",
    stats: [
      { label: "Major Quakes", value: "Every ~80 yrs" },
      { label: "Impact", value: "Nationwide" },
    ]
  }
];

export default function DisastersPage() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <PublicNavbar />

      <main className="pt-24 pb-20">
        <section className="relative pt-12 pb-16 lg:pt-20 lg:pb-24">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.1),transparent)]" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
                Understanding <span className="bg-gradient-to-r from-ocean-400 to-ocean-300 bg-clip-text text-transparent">Vulnerabilities</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed mb-8">
                Nepal's unique geography makes it susceptible to a variety of natural hazards. Learn about the primary threats and how we monitor them.
              </p>
              
              <Link to="/dashboard">
                <Button size="lg" className="text-base gap-2 px-8 shadow-glow">
                  View Live Monitoring
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 lg:grid-cols-2 gap-8"
          >
            {disasterTypes.map((disaster, index) => (
              <motion.div
                key={index}
                variants={fadeInUp}
                className="group relative rounded-3xl p-8 border border-border/50 bg-gradient-to-br from-card to-secondary/30 hover:border-ocean-400/50 transition-all duration-300 overflow-hidden hover:shadow-elevated"
              >
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity", disaster.color)} />
                
                <div className="flex flex-col sm:flex-row gap-6 relative">
                  <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shrink-0", disaster.iconBg)}>
                    <disaster.icon className="w-8 h-8" />
                  </div>
                  
                  <div>
                    <h3 className="text-2xl font-bold mb-3">{disaster.title}</h3>
                    <p className="text-muted-foreground mb-6 leading-relaxed">
                      {disaster.description}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-4 pt-6 border-t border-border/50">
                      {disaster.stats.map((stat, i) => (
                        <div key={i}>
                          <div className="text-sm text-muted-foreground mb-1">{stat.label}</div>
                          <div className="font-semibold text-lg">{stat.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      </main>
    </div>
  );
}
