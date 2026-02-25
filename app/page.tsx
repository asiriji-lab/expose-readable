import Link from "next/link";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSchool,
  faRobot,
  faCalendarCheck,
  faArrowRight,
  faCheckCircle,
  faBolt,
  faUsers,
  faChartPie,
  faQuoteLeft,
  faChevronDown,
  faStar
} from '@fortawesome/free-solid-svg-icons';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 text-foreground overflow-x-hidden selection:bg-primary/20 selection:text-primary">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">
              Schedool
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">How it Works</a>
            <a href="#ai-architecture" className="text-sm font-medium text-gray-600 hover:text-primary transition-colors">Technology</a>
            <Link href="/login">
              <button className="px-5 py-2 text-sm font-medium text-white bg-primary rounded-md hover:bg-primary/90 transition-all shadow-sm">
                Sign In
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-50 text-primary border border-blue-100 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
            </span>
            <span className="text-sm font-medium">AI-Powered Scheduling Engine v2.0</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-gray-900">
            Perfect Schedules. <br />
            <span className="text-primary">
              Zero Headaches.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Stop wasting weeks on spreadsheets. Generate conflict-free, optimized school timetables in seconds using advanced AI.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/dashboard" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-primary text-white text-lg font-semibold rounded-lg hover:bg-primary/90 transition-all shadow-md">
                Start Generating Free
                <FontAwesomeIcon icon={faArrowRight} className="w-4 h-4" />
              </button>
            </Link>
            <button className="w-full sm:w-auto px-8 py-3.5 bg-white text-gray-700 border border-gray-300 text-lg font-semibold rounded-lg hover:bg-gray-50 transition-all">
              Watch 2-min Demo
            </button>
          </div>

          <div className="mt-12 flex items-center justify-center gap-8 text-sm text-gray-500">
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 w-5 h-5" />
              <span>No credit card required</span>
            </div>
            <div className="flex items-center gap-2">
              <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 w-5 h-5" />
              <span>Export to Excel/PDF</span>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}


      {/* Value Proposition Grid (Bento) */}
      <section id="features" className="py-32 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6">Built for Chaos Control</h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              We handle the complex constraints that drive manual schedulers crazy.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-auto md:h-[600px]">
            {/* Large Left Card */}
            <div className="md:col-span-2 md:row-span-2 bg-white border border-gray-200 rounded-[2rem] p-10 flex flex-col justify-between relative overflow-hidden group hover:border-primary/20 transition-all duration-500 shadow-sm">
              <div className="relative z-10">
                <div className="w-14 h-14 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-6 text-2xl">
                  ⚡
                </div>
                <h3 className="text-3xl font-bold mb-4 text-slate-900">Instant AI Resolution.</h3>
                <p className="text-lg text-slate-600 max-w-md">
                  Our constraint solver analyzes millions of permutations to find the perfect fit for every teacher, room, and class block.
                </p>
              </div>
              {/* Abstract UI Representation */}
              <div className="absolute right-0 bottom-0 w-2/3 h-2/3 bg-white rounded-tl-[2.5rem] shadow-2xl border-t border-l border-slate-100 p-6 translate-x-10 translate-y-10 group-hover:translate-x-6 group-hover:translate-y-6 transition-transform duration-500">
                <div className="flex gap-2 mb-4">
                  <div className="h-3 w-3 rounded-full bg-red-400"></div>
                  <div className="h-3 w-3 rounded-full bg-yellow-400"></div>
                  <div className="h-3 w-3 rounded-full bg-green-400"></div>
                </div>
                <div className="space-y-3">
                  <div className="h-8 bg-slate-100 rounded-lg w-3/4 animate-pulse"></div>
                  <div className="h-8 bg-primary/10 rounded-lg w-full"></div>
                  <div className="h-8 bg-slate-100 rounded-lg w-5/6"></div>
                </div>
              </div>
            </div>

            {/* Top Right Card */}
            <div className="bg-gray-900 rounded-[2rem] p-10 text-white flex flex-col justify-center relative overflow-hidden hover:scale-[1.02] transition-transform duration-300 shadow-lg">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/30 blur-3xl rounded-full"></div>
              <FontAwesomeIcon icon={faUsers} className="w-10 h-10 text-primary mb-6" />
              <h3 className="text-2xl font-bold mb-2">Teacher Preference</h3>
              <p className="text-gray-400">Respects availability, preferred rooms, and load balancing automatically.</p>
            </div>

            {/* Bottom Right Card */}
            <div className="bg-blue-50 border border-blue-100 rounded-[2rem] p-10 flex flex-col justify-center relative overflow-hidden hover:scale-[1.02] transition-transform duration-300">
              <FontAwesomeIcon icon={faChartPie} className="w-10 h-10 text-blue-600 mb-6" />
              <h3 className="text-2xl font-bold mb-2 text-blue-900">Analytics Ready</h3>
              <p className="text-blue-700/80">Visual insights into room usage, teacher gaps, and class distribution.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-32 px-6 bg-white border-t border-gray-100">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">From Stress to Success</h2>
            <p className="text-xl text-gray-600">Three simple steps to your new schedule.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                icon: faSchool,
                title: "1. Define Structure",
                desc: "Set up your school's periods, days, and breaks. Import your teachers and subjects in one click."
              },
              {
                icon: faBolt,
                title: "2. Generate",
                desc: "Hit the magic button. Our AI runs thousands of scenarios to find the mathematically optimal schedule."
              },
              {
                icon: faCalendarCheck,
                title: "3. Refine & Export",
                desc: "Make manual tweaks with drag-and-drop if needed, then export to PDF, Excel, or your SIS."
              }
            ].map((step, i) => (
              <div key={i} className="relative group">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-primary text-2xl mb-8 group-hover:scale-110 transition-transform duration-300">
                  <FontAwesomeIcon icon={step.icon} />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">{step.title}</h3>
                <p className="text-gray-600 leading-relaxed">{step.desc}</p>
                {i !== 2 && (
                  <div className="hidden md:block absolute top-8 left-20 w-[calc(100%-3rem)] h-[2px] bg-gradient-to-r from-slate-200 to-transparent"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>



      {/* AI Architecture */}
      <section id="ai-architecture" className="py-32 px-6 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-blue-50 to-transparent rounded-full blur-3xl -z-10 opacity-50"></div>
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center gap-16">
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-primary text-sm font-semibold mb-6">
                <FontAwesomeIcon icon={faRobot} className="w-4 h-4" />
                <span>Proprietary Technology</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Not just rules. <br />
                <span className="text-primary">True Intelligence.</span>
              </h2>
              <p className="text-lg text-slate-600 mb-8 leading-relaxed">
                While other schedulers typically crash when restrictions get tight, Schedool's engine adapts. We use a hybrid genetic algorithm capable of evaluating
                <span className="font-bold text-slate-900"> ~50,000 permutations per second</span> to find the one that makes everyone happy.
              </p>

              <div className="space-y-6">
                {[
                  { title: "Hard & Soft Constraints", desc: "Prioritizes mandatory rules (like Room Capacity) while maximizing preferences (like Morning Classes)." },
                  { title: "Conflict Look-Ahead", desc: "Predicts and avoids bottlenecks before they happen, ensuring 100% room utilization." },
                  { title: "Fairness Balancing", desc: "Ensures no teacher gets stuck with all the 'bad' slots. Distribution is mathematically proven to be equitable." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0 text-blue-600">
                      <FontAwesomeIcon icon={faCheckCircle} className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-900 text-lg mb-1">{item.title}</h4>
                      <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 relative">
              {/* Visual representation of AI processing */}
              <div className="relative z-10 bg-slate-900 rounded-3xl p-8 border border-slate-800 shadow-2xl">
                <div className="flex items-center justify-between mb-8 border-b border-slate-800 pb-4">
                  <div className="flex gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="text-xs font-mono text-slate-500">engine_core.py</div>
                </div>

                <div className="space-y-4 font-mono text-sm">
                  <div className="flex justify-between text-slate-400">
                    <span>&gt; Initializing population...</span>
                    <span className="text-green-500">Done (0.4s)</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>&gt; Checking room conflicts...</span>
                    <span className="text-green-500">0 found</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>&gt; Optimizing teacher gaps...</span>
                    <span className="text-blue-400 animate-pulse">Processing...</span>
                  </div>

                  <div className="h-px bg-slate-800 my-4"></div>

                  <div className="bg-slate-800/50 rounded-lg p-4">
                    <div className="flex justify-between mb-2">
                      <span className="text-slate-400">Score</span>
                      <span className="text-green-400 font-bold">98.5%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full w-[98.5%]"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative elements behind */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/20 blur-2xl rounded-full animate-pulse"></div>
              <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/20 blur-2xl rounded-full animate-pulse delay-1000"></div>
            </div>
          </div>
        </div>
      </section>



      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 text-gray-400 py-20 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="text-center md:text-left">
            <div className="text-2xl font-bold text-gray-900 mb-2">Schedool</div>
            <p className="text-sm">Making school management human again.</p>
          </div>
          <div className="flex gap-8 text-sm font-medium">
            <a href="#" className="hover:text-primary transition-colors">Privacy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms</a>
            <a href="#" className="hover:text-primary transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  );
}
//   return (
//     <main style={{backgroundColor: '#F5F5F5'}}>
//       {/* Navbar */}
//       <nav className="flex items-center justify-between px-8 py-6" style={{backgroundColor: '#D9D9D9'}}>
//         <div className="text-5xl font-bold text-black">Schedool</div>
//         <div className="flex items-center gap-8">
//           <a href="#about" className="text-xl text-black hover:text-gray-200">about</a>
//           <a href="#contact" className="text-xl text-black hover:text-gray-200">contact</a>
//           <button className="px-6 py-2 text-white rounded-md hover:opacity-90" style={{backgroundColor: '#000000'}}>
//             Sign-up
//           </button>
//         </div>
//       </nav>

//       <section className="flex flex-col items-start justify-center min-h-screen px-8">
//         <h1 className="text-8xl font-bold mb-6 text-black">Schedool</h1>
//         <p className="text-xl text-gray-600 mb-8">
//           Automate scheduling process from<br />weeks to a day
//         </p>
//         <Link href="/login">
//           <button className="px-8 py-3 text-white text-lg rounded-md hover:opacity-90 font-bold" style={{backgroundColor: '#EF7722'}}>
//             Get started
//           </button>
//         </Link>
//       </section>
//     </main>
//   );
// }

// color codes used: black 000000, FFFFFF, 3584E4, BDD3FF, EAF7FF

// app/page.tsx
