import { motion } from 'framer-motion';

export default function ConnectingAnimation() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-800 overflow-hidden">
      <div className="absolute w-full h-full">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-4 h-4 rounded-full bg-blue-200 opacity-40"
            animate={{
              x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth],
              y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight],
              scale: [0.2, 1.5, 0.2],
            }}
            transition={{
              duration: 10 + Math.random() * 20,
              repeat: Infinity,
              ease: "linear",
            }}
            style={{
              left: Math.random() * window.innerWidth,
              top: Math.random() * window.innerHeight,
            }}
          />
        ))}
      </div>
      
      <motion.div
        className="z-10 p-8 bg-white/10 backdrop-blur-md rounded-xl shadow-2xl"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col items-center">
          <motion.div 
            className="w-16 h-16 border-4 border-t-blue-500 border-r-transparent border-b-blue-500 border-l-transparent rounded-full mb-4"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
          <p className="text-white text-xl font-semibold">Connecting...</p>
          <p className="text-white/70 mt-2">Establishing secure connection to your server</p>
        </div>
      </motion.div>
    </div>
  );
} 