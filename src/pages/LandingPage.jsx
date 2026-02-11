import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import CoffeeScene from '../components/CoffeeScene';
import LoadingScreen from '../components/LoadingScreen';
import coffeeBeanLogo from '../assets/logo.png';
import backgroundImage from '../assets/background.png';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import '../styles/landing.css';

gsap.registerPlugin(ScrollTrigger);

const LandingPage = () => {
  const [activeCard, setActiveCard] = useState(null);
  // Removed isLoading state
  // Ref for the hero section
  const heroRef = useRef(null);

  useEffect(() => {
    // New GSAP animation: staggered fade in for each hero content element
    if (heroRef.current) {
      gsap.fromTo(
        heroRef.current.children,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1.1, ease: 'power4.out', stagger: 0.18 }
      );
    }

    // Scroll animations for cards with permanent visibility
    gsap.from('.feature-card', {
      scrollTrigger: {
        trigger: '.feature-card',
        start: 'top center+=100',
        toggleActions: 'play none none none', // Changed to prevent reversal
      },
      opacity: 0,
      y: 100,
      duration: 1,
      stagger: 0.2,
      ease: 'power3.out',
    });

    // Stats counter animation
    const statsTimeline = gsap.timeline({
      scrollTrigger: {
        trigger: '.stats-section',
        start: 'top center+=100',
        toggleActions: 'play none none none', // Changed to prevent reversal
      }
    });

    statsTimeline.from('.stat-number', {
      textContent: 0,
      duration: 2,
      ease: 'power1.out',
      snap: { textContent: 1 },
      stagger: 0.2,
    });

    // Animate the hero text gradient
    gsap.to('.gradient-text', {
      backgroundPosition: '200% center',
      duration: 15,
      repeat: -1,
      ease: 'none',
    });

    return () => {
      // Clear all ScrollTrigger instances when component unmounts
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  const handleCardHover = (index) => {
    setActiveCard(index);
    gsap.to(`.card-${index}`, {
      scale: 1.05,
      duration: 0.3,
      ease: 'power2.out'
    });
  };

  const handleCardLeave = (index) => {
    setActiveCard(null);
    gsap.to(`.card-${index}`, {
      scale: 1,
      duration: 0.3,
      ease: 'power2.out'
    });
  };

  return (
    <>
      <div className="relative min-h-screen overflow-hidden transition-opacity duration-500 opacity-100">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat z-0"
          style={{ backgroundImage: `url(${backgroundImage})` }}
        />
        <div className="absolute inset-0 bg-black/40 z-0" />
        
        {/* Content overlay */}
        <div className="relative z-10">
          {/* Navigation */}
          <nav className="bg-[#0a0605]/90 backdrop-blur-md border-b border-white/20 sticky top-0">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex-shrink-0 flex items-center">
                  <img src={coffeeBeanLogo} alt="Coffee Bean Logo" className="h-8 w-8 mr-2" />
                  <h1 className="text-2xl font-bold text-white tracking-wider hover:scale-105 transition-transform duration-300">
                    i<span className="text-green-400">Kape</span>
                  </h1>
                </div>
                <div className="flex items-center space-x-6">
                  <Link
                    to="/login"
                    className="text-white hover:text-green-400 px-4 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:scale-105 relative after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-0 hover:after:w-full after:bg-green-400 after:transition-all after:duration-300"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    className="bg-green-500 text-white hover:bg-green-400 px-6 py-2 rounded-md text-sm font-medium transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-green-500/30 border border-green-400/30"
                  >
                    Sign Up
                  </Link>
                </div>
              </div>
            </div>
          </nav>

          {/* Hero Section */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24">
            <div className="text-center" ref={heroRef}>
              <h1 className="gradient-text text-6xl md:text-7xl font-extrabold mb-8 tracking-tight drop-shadow-2xl">
              Welcome to iKape
              </h1>
              <p className="text-xl md:text-2xl text-white mb-12 max-w-3xl mx-auto leading-relaxed font-medium drop-shadow-lg">
              Your smart partner in growing better coffee.
              Track harvests, improve quality, and get real advice - all in one place.
              </p>
              

              {/* CTA Section */}
              <div className="mt-20">
                <Link
                  to="/register"
                  className="group inline-flex items-center px-8 py-4 text-lg font-bold rounded-full bg-gradient-to-r from-green-500 to-green-400 text-white hover:from-green-400 hover:to-green-300 transition-all duration-300 hover:scale-105 hover:shadow-xl hover:shadow-green-500/30 border border-green-400/30"
                >
                  Get Started
                  <svg className="w-5 h-5 ml-2 transform transition-transform duration-300 group-hover:translate-x-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <p className="mt-4 text-white/80 font-medium">
                  Join hundreds of successful coffee farmers today
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
};

export default LandingPage;