// src/components/PasswordInput.jsx
import { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const PasswordInput = ({ value, onChange, placeholder, id, name, className = '' }) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        id={id}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className={`${className} pr-10 text-gray-900`}
        required
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 m-0 p-0 bg-transparent border-none shadow-none outline-none text-gray-400 hover:text-gray-600 focus:outline-none focus:text-gray-600"
        style={{ boxShadow: 'none', background: 'none', border: 'none' }}
        onClick={() => setShowPassword(!showPassword)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? (
          <FaEyeSlash className="w-5 h-5" />
        ) : (
          <FaEye className="w-5 h-5" />
        )}
      </button>
    </div>
  );
};

export default PasswordInput;