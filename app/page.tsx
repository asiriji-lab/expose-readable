// import Link from "next/link";

// app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/register');
}
