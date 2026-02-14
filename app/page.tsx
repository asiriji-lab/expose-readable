// import Link from "next/link";

// app/page.tsx
import { redirect } from 'next/navigation';

export default function Home() {
  redirect('/login');
}

// export default function Home() {
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
