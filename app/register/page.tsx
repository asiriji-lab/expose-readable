import Link from 'next/link'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCircleUser } from '@fortawesome/free-solid-svg-icons'

export default function Register() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-md w-96">
        
        {/* User Icon */}
<div className="flex justify-center mb-4">
  <FontAwesomeIcon icon={faCircleUser} style={{fontSize: '60px'}} className="text-gray-400" />
</div>

        <h1 className="text-2xl font-bold mb-6 text-center text-black">Registration</h1>
        
        <form className="space-y-4">
          {/* Email Address */}
          <div>
            <label className="block text-sm font-medium mb-2 text-black">Email Address</label>
            <input 
              type="email" 
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400"
              placeholder="Enter Email"
            />
          </div>
          
          {/* First Name and Last Name - Side by Side */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-black">First Name</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400"
                placeholder="First Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-black">Last Name</label>
              <input 
                type="text" 
                className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400"
                placeholder="Last Name"
              />
            </div>
          </div>
          
          {/* Class (student) */}
          <div>
            <label className="block text-sm font-medium mb-2 text-black">Class (student)</label>
            <input 
              type="text" 
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400"
              placeholder="class"
            />
          </div>
          
          {/* Password */}
          <div>
            <label className="block text-sm font-medium mb-2 text-black">Password</label>
            <input 
              type="password" 
              className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder:text-gray-400"
              placeholder="password"
            />
          </div>
          
          {/* Type of account - Radio buttons */}
          <div>
            <label className="block text-sm font-medium mb-2 text-black">Type of account</label>
            <div className="flex gap-6">
              <label className="flex items-center">
                <input type="radio" name="accountType" value="admin" className="mr-2" defaultChecked />
                Admin
              </label>
              <label className="flex items-center">
                <input type="radio" name="accountType" value="teacher" className="mr-2" />
                Teacher
              </label>
              <label className="flex items-center">
                <input type="radio" name="accountType" value="student" className="mr-2" />
                Student
              </label>
            </div>
          </div>
          
          {/* Register Button */}
          <Link href="/login">
            <button 
              type="button"
              className="w-full py-3 bg-blue-500 text-white rounded-md hover:bg-blue-600 mt-6"
            >
              Register
            </button>
          </Link>
        </form>
      </div>
    </div>
  );
}