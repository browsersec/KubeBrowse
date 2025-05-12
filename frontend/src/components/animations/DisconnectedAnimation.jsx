import { motion } from 'framer-motion';

export default function DisconnectedAnimation() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-r from-red-600 to-pink-800 overflow-hidden">
      <div className="absolute w-full h-full">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-6 h-1 bg-red-200 opacity-40 rounded-full"
            animate={{
              x: [Math.random() * window.innerWidth, Math.random() * window.innerWidth],
              y: [Math.random() * window.innerHeight, Math.random() * window.innerHeight],
              rotate: [0, 180],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 8 + Math.random() * 12,
              repeat: Infinity,
              ease: "easeInOut",
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
            className="w-16 h-16 rounded-full bg-red-500/30 flex items-center justify-center mb-4"
            animate={{ 
              scale: [1, 1.1, 1],
              boxShadow: [
                "0 0 0 0 rgba(239, 68, 68, 0.4)",
                "0 0 0 20px rgba(239, 68, 68, 0)",
                "0 0 0 0 rgba(239, 68, 68, 0.4)"
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.div>
          <p className="text-white text-xl font-semibold">Disconnected</p>
          <p className="text-white/70 mt-2">Connection to the server has been lost</p>
          <motion.button
            className="mt-6 px-6 py-2 bg-white/20 hover:bg-white/30 text-white rounded-full font-medium"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.history.back()}
          >
            Return to Dashboard
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
} 