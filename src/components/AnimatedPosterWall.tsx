import React from "react";
import { motion } from "motion/react";

// Curated selection of beautiful, fast-loading Unsplash images for sports, series, movies, and IPTV channels
const COLUMN_1_IMAGES = [
  "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=350&q=80", // Football / Sports Live
  "https://images.unsplash.com/photo-1593305841991-05c297ba4575?auto=format&fit=crop&w=350&q=80", // Home television screen
  "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=350&q=80", // Cinema interior seats
  "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=350&q=80", // Athlete running
  "https://images.unsplash.com/photo-1574375927938-d5a98e8edd86?auto=format&fit=crop&w=350&q=80", // Dark Netflix-style screen
];

const COLUMN_2_IMAGES = [
  "https://images.unsplash.com/photo-1518063319789-7217e6706b04?auto=format&fit=crop&w=350&q=80", // Soccer field
  "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=350&q=80", // Film clapper & lens
  "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=350&q=80", // F1 Racing / Sports Car
  "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=350&q=80", // Gaming neon console
  "https://images.unsplash.com/photo-1618336753974-aae8e04506aa?auto=format&fit=crop&w=350&q=80", // Fantasy dragon sword
];

const COLUMN_3_IMAGES = [
  "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=350&q=80", // Martial arts / boxing ring
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=350&q=80", // High tech network glow
  "https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=350&q=80", // Theatre glowing lights
  "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=350&q=80", // Nature / high peak adventure
  "https://images.unsplash.com/photo-1635805737707-575885ab0820?auto=format&fit=crop&w=350&q=80", // Spiderman/superhero costume vibe
];

const COLUMN_4_IMAGES = [
  "https://images.unsplash.com/photo-1578496479914-7235024ac427?auto=format&fit=crop&w=350&q=80", // Cinema Popcorn box
  "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=350&q=80", // Retro synthwave / cyberpunk neon
  "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=350&q=80", // Concert stage live event
  "https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&w=350&q=80", // Wildlife nature documentary lion
  "https://images.unsplash.com/photo-1505635552518-3448ff116af3?auto=format&fit=crop&w=350&q=80", // Mystery / thriller dark tunnel
];

interface ScrollColumnProps {
  images: string[];
  direction: "up" | "down";
  speed: number;
}

function ScrollColumn({ images, direction, speed }: ScrollColumnProps) {
  // Duplicate images list to ensure continuous looping without visual seams
  const extendedImages = [...images, ...images, ...images];
  
  const initialY = direction === "up" ? 0 : -800;
  const targetY = direction === "up" ? -800 : 0;

  return (
    <div className="w-full flex flex-col gap-4 overflow-hidden h-[120vh]">
      <motion.div
        animate={{ y: [initialY, targetY] }}
        transition={{
          ease: "linear",
          duration: speed,
          repeat: Infinity,
        }}
        className="flex flex-col gap-4"
      >
        {extendedImages.map((src, idx) => (
          <div 
            key={idx} 
            className="aspect-[2/3] w-full rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shadow-md group relative"
          >
            <img
              src={src}
              alt="Movie Poster Background"
              className="w-full h-full object-cover select-none pointer-events-none opacity-85 hover:opacity-100 transition-opacity duration-300"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 to-transparent" />
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default function AnimatedPosterWall() {
  return (
    <div 
      className="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0 select-none" 
      id="animated-poster-wall-bg"
    >
      {/* 3D Tilted Wrapper Grid */}
      <div className="absolute inset-0 w-full h-full origin-center rotate-[6deg] scale-[1.12] translate-y-[-5%] translate-x-[2%] opacity-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full h-full max-w-7xl mx-auto px-4">
          <ScrollColumn images={COLUMN_1_IMAGES} direction="up" speed={45} />
          <ScrollColumn images={COLUMN_2_IMAGES} direction="down" speed={55} />
          <ScrollColumn images={COLUMN_3_IMAGES} direction="up" speed={50} />
          <ScrollColumn images={COLUMN_4_IMAGES} direction="down" speed={40} />
        </div>
      </div>

      {/* Luxury Cinematic Glassmorphism Overlays */}
      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-950/92 to-violet-950/80 z-10" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/60 to-slate-950 z-10" />
      <div className="absolute inset-0 backdrop-blur-[6px] z-10" />

      {/* Accent Lights */}
      <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] rounded-full bg-violet-600/15 blur-[130px] z-20 pointer-events-none" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[60%] h-[60%] rounded-full bg-amber-500/10 blur-[130px] z-20 pointer-events-none" />
    </div>
  );
}
