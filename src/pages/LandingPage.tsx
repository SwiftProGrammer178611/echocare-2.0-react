import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Heart, Mic, Video, Brain, Shield, Users, ChevronRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { ThemeToggle } from '../components/theme-toggle'

export default function LandingPage() {
  const [currentDemo, setCurrentDemo] = useState(0)
  
  const demos = [
    { icon: Mic, title: 'Voice AI Companion', desc: 'Natural conversations with empathetic AI' },
    { icon: Video, title: 'AI Avatar Chat', desc: 'Face-to-face interaction with realistic avatars' },
    { icon: Brain, title: 'Emotion Detection', desc: 'Real-time emotional state monitoring' },
    { icon: Heart, title: 'Health Insights', desc: 'Proactive wellness monitoring' },
  ]

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDemo((prev) => (prev + 1) % demos.length)
    }, 3000)
    return () => clearInterval(timer)
  }, [])

  const features = [
    {
      icon: Mic,
      title: 'AI Voice Companion',
      description: 'Natural, empathetic conversations powered by advanced AI that understands context and emotion.',
      color: 'bg-blue-600',
    },
    {
      icon: Video,
      title: 'Realistic AI Avatar',
      description: 'Face-to-face interactions with lifelike AI avatars using cutting-edge Tavus technology.',
      color: 'bg-teal-600',
    },
    {
      icon: Brain,
      title: 'Emotion Detection',
      description: 'Real-time analysis of emotional state through voice patterns and facial expressions.',
      color: 'bg-cyan-600',
    },
    {
      icon: Heart,
      title: 'Health Monitoring',
      description: 'Proactive wellness tracking with AI-powered insights and emergency assistance.',
      color: 'bg-emerald-600',
    },
    {
      icon: Shield,
      title: 'Blockchain Security',
      description: 'HIPAA-compliant data protection with blockchain-secured health records.',
      color: 'bg-blue-700',
    },
    {
      icon: Users,
      title: 'Family Connection',
      description: 'Secure sharing of health insights and digital keepsakes with loved ones.',
      color: 'bg-teal-700',
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Heart className="w-8 h-8 text-red-500" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">EchoCare 2.0</span>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <Link to="/auth/signin">
                <Button variant="outline" className="border-gray-300 dark:border-gray-600">
                  Sign In
                </Button>
              </Link>
              <Link to="/auth/signup">
                <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                  Get Started
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 pt-32 pb-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <Badge className="mb-4 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 hover:bg-blue-200 dark:hover:bg-blue-800/50">
                <Sparkles className="w-4 h-4 mr-1" />
                EchoCare 2.0 - Now Available
              </Badge>
              <h1 className="text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white mb-6">
                AI-Powered
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-600">
                  {' '}Elderly Care
                </span>
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-8 leading-relaxed">
                Revolutionary companion technology combining voice AI, emotion detection, 
                and blockchain security to provide comprehensive elderly care and support.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/auth/signup">
                  <Button size="lg" className="w-full sm:w-auto btn-calm-gradient text-white">
                    Start Your Journey
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/auth/signin">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                    Sign In
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="glass-card p-8 rounded-2xl bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 shadow-xl">
                <div className="text-center mb-6">
                  <h3 className="text-2xl font-semibold mb-2 text-gray-900 dark:text-white">Live Demo Preview</h3>
                  <p className="text-gray-600 dark:text-gray-400">Experience our advanced AI capabilities</p>
                </div>
                
                <div className="space-y-4">
                  {demos.map((demo, index) => (
                    <motion.div
                      key={index}
                      className={`flex items-center p-4 rounded-lg transition-all duration-300 ${
                        index === currentDemo 
                          ? 'bg-blue-100 dark:bg-blue-900/50 border-2 border-blue-300 dark:border-blue-700' 
                          : 'bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600'
                      }`}
                      animate={index === currentDemo ? { scale: 1.02 } : { scale: 1 }}
                    >
                      <demo.icon className={`w-6 h-6 mr-3 ${
                        index === currentDemo ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'
                      }`} />
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">{demo.title}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{demo.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-gray-50 dark:bg-gray-800/50">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Comprehensive Care Technology
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Our advanced AI platform combines multiple cutting-edge technologies 
              to provide unparalleled elderly care and support.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-lg transition-all duration-300 hover:-translate-y-1 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4`}>
                      <feature.icon className="w-6 h-6 text-white" />
                    </div>
                    <CardTitle className="text-xl text-gray-900 dark:text-white">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base leading-relaxed text-gray-600 dark:text-gray-300">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 via-teal-600 to-emerald-600">
        <div className="mx-auto max-w-7xl">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center text-white"
          >
            <h2 className="text-4xl font-bold mb-4">
              Transforming Elderly Care Worldwide
            </h2>
            <p className="text-xl mb-12 opacity-90">
              Join thousands of families already using EchoCare 2.0
            </p>
            
            <div className="grid md:grid-cols-4 gap-8">
              {[
                { number: '10,000+', label: 'Happy Users' },
                { number: '95%', label: 'Satisfaction Rate' },
                { number: '24/7', label: 'AI Availability' },
                { number: '50+', label: 'Health Metrics' },
              ].map((stat, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="text-center"
                >
                  <div className="text-4xl font-bold mb-2">{stat.number}</div>
                  <div className="text-lg opacity-90">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
              Ready to Experience the Future of Elderly Care?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Join EchoCare 2.0 today and provide your loved ones with the most advanced 
              AI-powered care companion available.
            </p>
            <Link to="/auth/signup">
              <Button size="lg" className="btn-calm-gradient text-white">
                Get Started Now
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </div>
  )
}