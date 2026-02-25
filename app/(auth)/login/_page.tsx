import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faUser } from '@fortawesome/free-solid-svg-icons'

export default function Login() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        
       {/* User Icon */}
<div className="flex justify-center mb-4">
  <FontAwesomeIcon icon={faUser} className="fa-2xl text-gray-400" />
</div>

        <h1 className="text-2xl font-bold mb-2 text-center text-black">Schedool</h1>
        <p className="text-sm text-gray-600 mb-6 text-center">Login</p>
        
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-black">Enter Email</label>
            <input 
              type="email" 
              className="w-full px-4 py-2 text-black border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Enter your email"
            />
          </div>
          
          <button 
            type="button"
            className="w-full py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Login
          </button>
          
          <p className="text-center text-sm text-gray-600">Don't have an account yet?</p>
          
          <Link href="/register">
            <button 
              type="button"
              className="w-full py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
            >
              Register
            </button>
          </Link>
        </form>
      </div>
    </div>
  );
}