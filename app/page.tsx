import Link from "next/link";

export default function Home() {
  return (
    <main style={{backgroundColor: '#EAF7FF'}}>
      {/* Navbar */}
      <nav className="flex items-center justify-between px-8 py-6" style={{backgroundColor: '#3584E4'}}>
        <div className="text-2xl font-bold text-white">Schedool</div>
        <div className="flex items-center gap-8">
          <a href="#about" className="text-xl text-white hover:text-gray-200">about</a>
          <a href="#contact" className="text-xl text-white hover:text-gray-200">contact</a>
          <button className="px-6 py-2 text-black rounded-md hover:opacity-90" style={{backgroundColor: '#BDD3FF'}}>
            Sign-up
          </button>
        </div>
      </nav>

      <section className="flex flex-col items-start justify-center min-h-screen px-8">
        <h1 className="text-8xl font-bold mb-6 text-black">Schedool</h1>
        <p className="text-xl text-gray-600 mb-8">
          Automate scheduling process from<br />weeks to a day
        </p>
        <Link href="/login">
          <button className="px-8 py-3 text-black text-lg rounded-md hover:opacity-90" style={{backgroundColor: '#BDD3FF'}}>
            Get started
          </button>
        </Link>
      </section>
    </main>
  );
}

// color codes used: black 000000, FFFFFF, 3584E4, BDD3FF, EAF7FF