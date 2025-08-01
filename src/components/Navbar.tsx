'use client'

import { NavLink } from 'react-router-dom'

const navigation = [
  { name: 'Home', to: '/' },
  { name: 'About', to: '/about' },
  { name: 'Projects', to: '/projects' },
  { name: 'Blog', to: '/blog' },
]

export default function Navbar() {
  return (
    <header className="bg-white shadow fixed top-0 inset-x-0 z-50">
      <nav className="container mx-auto flex items-center justify-between px-4 py-4">
        {/* Site Name / Logo */}
        <NavLink to="/" className="text-xl font-bold text-indigo-600">
          rsmb.tv
        </NavLink>

        {/* Navigation Links */}
        <ul className="flex gap-6 list-none">
          {navigation.map((item) => (
            <li key={item.name}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  isActive
                    ? 'text-indigo-600 underline underline-offset-4 font-medium'
                    : 'text-gray-700 hover:text-indigo-500 font-medium'
                }
              >
                {item.name}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  )
}
