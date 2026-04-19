import { motion } from "framer-motion";
import { ArrowRight, Calendar, User } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicNavbar } from "@/components/layout/PublicNavbar";
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

const blogPosts = [
  {
    id: 1,
    title: "The Devastating Impact of Monsoon Floods in Nepal",
    excerpt:
      "Every year, monsoon floods affect thousands of families across Nepal's river basins. In 2024 alone, over 250 people lost their lives and property damage exceeded NPR 5 billion.",
    content: "Detailed content here...",
    image: "https://images.unsplash.com/photo-1547683905-f686c993aae5?w=1200&q=80",
    category: "Floods",
    date: "August 15, 2024",
    author: "Dr. Sharma",
    stats: "250+ Lives Lost",
    color: "from-ocean-400 to-ocean-600",
  },
  {
    id: 2,
    title: "Landslides: Nepal's Silent Killer During Rains",
    excerpt:
      "Nepal's mountainous terrain makes it highly susceptible to landslides. During the 2023 monsoon, over 400 landslide events were recorded, destroying homes and infrastructure in rural communities.",
    content: "Detailed content here...",
    image: "https://images.unsplash.com/photo-1523990096895-a0e9f4e45c9e?w=1200&q=80",
    category: "Landslides",
    date: "July 22, 2023",
    author: "Resilience Team",
    stats: "400+ Events",
    color: "from-risk-watch to-risk-warning",
  },
  {
    id: 3,
    title: "Glacial Lake Outburst Floods (GLOF) Threat",
    excerpt:
      "With over 2,000 glacial lakes in Nepal, 21 are identified as potentially dangerous. The 1985 Dig Tsho GLOF destroyed the Namche Hydel Project and caused massive downstream damage.",
    content: "Detailed content here...",
    image: "https://images.unsplash.com/photo-1517021897933-0e0319cfbc28?w=1200&q=80",
    category: "GLOF",
    date: "June 10, 2024",
    author: "Climate Research Inst.",
    stats: "21 Dangerous Lakes",
    color: "from-ocean-300 to-ocean-500",
  },
  {
    id: 4,
    title: "Earthquakes: Nepal's Seismic Reality",
    excerpt:
      "The 2015 Gorkha earthquake killed nearly 9,000 people and injured over 22,000. Nepal lies in one of the most seismically active regions of the world, making earthquake preparedness critical.",
    content: "Detailed content here...",
    image: "https://images.unsplash.com/photo-1454789548728-85d2696cfbaf?w=1200&q=80",
    category: "Earthquakes",
    date: "April 25, 2015",
    author: "Seismology Dept",
    stats: "9,000 Lives Lost",
    color: "from-risk-evacuate to-risk-warning",
  },
  {
    id: 5,
    title: "Community Early Warning Systems Save Lives",
    excerpt:
      "In the Karnali river basin, community-managed early warning systems have drastically reduced the loss of life during unexpected flash floods.",
    content: "Detailed content here...",
    image: "https://images.unsplash.com/photo-1590082873130-97eb333dfd59?w=1200&q=80",
    category: "Preparedness",
    date: "March 5, 2024",
    author: "Community NGO",
    stats: "Zero Casualties",
    color: "from-risk-safe to-ocean-400",
  },
  {
    id: 6,
    title: "Impact of Climate Change on Himalayas",
    excerpt:
      "Rising temperatures are accelerating glacial melt, changing weather patterns, and increasing the frequency of extreme weather events in the Himalayan region.",
    content: "Detailed content here...",
    image: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1200&q=80",
    category: "Climate",
    date: "January 12, 2024",
    author: "Environment Ministry",
    stats: "+1.5°C Rise",
    color: "from-ocean-500 to-risk-watch",
  }
];

export default function BlogPage() {
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
                Disaster <span className="bg-gradient-to-r from-ocean-400 to-ocean-300 bg-clip-text text-transparent">Stories & Insights</span>
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                Stay informed about natural disasters, climate change impacts, and resilience efforts across Nepal.
              </p>
            </motion.div>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {blogPosts.map((post) => (
              <motion.article
                key={post.id}
                variants={fadeInUp}
                className="group relative rounded-3xl overflow-hidden border border-border/50 bg-card hover:border-ocean-400/30 transition-all duration-300 hover:shadow-elevated flex flex-col h-full"
              >
                <div className="relative h-64 overflow-hidden shrink-0">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/20 to-transparent" />

                  <div className="absolute top-4 left-4">
                    <span className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-semibold text-white bg-gradient-to-r shadow-lg",
                      post.color
                    )}>
                      {post.category}
                    </span>
                  </div>
                </div>

                <div className="p-6 flex flex-col grow">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {post.date}
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      {post.author}
                    </div>
                  </div>

                  <h3 className="text-xl font-bold mb-3 group-hover:text-ocean-400 transition-colors line-clamp-2">
                    {post.title}
                  </h3>

                  <p className="text-sm text-muted-foreground mb-6 line-clamp-3 grow">
                    {post.excerpt}
                  </p>

                  <div className="mt-auto flex items-center justify-between pt-4 border-t border-border/50">
                    <span className="text-xs font-medium bg-secondary/50 px-2 py-1 rounded-md text-foreground">
                      {post.stats}
                    </span>
                    <button className="text-sm font-semibold text-ocean-400 flex items-center gap-1 group/btn hover:text-ocean-300 transition-colors">
                      Read Article
                      <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                  </div>
                </div>
              </motion.article>
            ))}
          </motion.div>
        </section>
      </main>
    </div>
  );
}
